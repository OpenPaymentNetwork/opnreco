
from opnreco.models import perms
from opnreco.models.db import TransferRecord
from opnreco.models.db import VerificationResult
from opnreco.models.site import API
from opnreco.syncbase import SyncBase
from opnreco.syncbase import VerificationFailure
from opnreco.util import to_datetime
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.httpexceptions import HTTPInsufficientStorage
from pyramid.view import view_config
import datetime
import uuid
import logging

log = logging.getLogger(__name__)


@view_config(
    name='verify',
    context=API,
    permission=perms.use_app,
    renderer='json')
class VerifyAPI(SyncBase):
    """Verify existing OPN transfer records have not changed."""
    write_enabled = False

    def __call__(self):
        request = self.request
        dbsession = request.dbsession
        owner = request.owner

        self.now = datetime.datetime.utcnow()
        self.expires = self.now + datetime.timedelta(days=7)
        self.change_log = []

        # Expire old verification records.
        (dbsession.query(VerificationResult)
            .filter(VerificationResult.owner_id == owner.id)
            .filter(VerificationResult.expires <= self.now)
            .delete())

        ivr, created = self.get_ivr()
        transfers_download = self.download_batch(
            sync_ts_iso=ivr.last_sync_ts.isoformat() + 'Z',
            sync_transfer_id=ivr.last_sync_transfer_id,
            count_remain=created)

        try:
            self.import_transfer_records(transfers_download)
        except VerificationFailure as e:
            # HTTP error 507 is reasonably close to
            # 'data verification error on the server'. HTTP error 507
            # is also obscure enough that it probably won't be
            # triggered by any other error.
            raise HTTPInsufficientStorage(json_body={
                'error': 'verification_failure',
                'error_description': str(e),
            })

        self.log_download(
            ivr=ivr, created=created, transfers_download=transfers_download)

        if transfers_download['more']:
            # Note: avoid division by zero.
            progress_percent = min(99, int(
                100.0 * ivr.sync_done / ivr.sync_total
                if ivr.sync_total else 0.0))
        else:
            try:
                self.verify_final(ivr)
            except VerificationFailure as e:
                raise HTTPInsufficientStorage(json_body={
                    'error': 'verification_failure',
                    'error_description': str(e),
                })
            progress_percent = 100

        return {
            'verification_id': ivr.verification_id,
            'sync_done': ivr.sync_done,
            'sync_total': ivr.sync_total,
            'progress_percent': progress_percent,
            'change_count': self.change_count,
            'download_count': len(transfers_download['results']),
            'more': transfers_download['more'],
            'first_sync_ts': transfers_download['first_sync_ts'],
            'last_sync_ts': transfers_download['last_sync_ts'],
        }

    def get_ivr(self):
        """Get the initial VerificationResult record.

        Return (ivr, created).
        """
        request = self.request
        dbsession = request.dbsession
        owner = request.owner

        verification_id = request.json['verification_id']
        if not verification_id:
            # Start a new verification operation.
            verification_id = '%s.%s' % (
                datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S'),
                uuid.uuid4())

            ivr = VerificationResult(
                owner_id=owner.id,
                verification_id=verification_id,
                initial=True,
                last_sync_ts=datetime.datetime(1970, 1, 1),
                last_sync_transfer_id=None,
                sync_done=0,
                verified={},
                expires=self.expires,
            )
            dbsession.add(ivr)
            created = True

        else:
            # Continue a verification operation.
            verification_id = str(verification_id)
            ivr = (
                dbsession.query(VerificationResult)
                .filter(
                    VerificationResult.owner_id == owner.id,
                    VerificationResult.verification_id == verification_id,
                    VerificationResult.initial,
                )
                .first())
            if ivr is None:
                raise HTTPBadRequest(json_body={
                    'error': 'verification_id_not_found',
                })
            created = False

        return ivr, created

    def log_download(self, ivr, created, transfers_download):
        """Log the results of the transfer download."""
        request = self.request
        dbsession = request.dbsession
        owner = request.owner

        len_results = len(transfers_download['results'])
        verified = {
            item['id']: None
            for item in transfers_download['results']}

        for entry in self.change_log:
            transfer_id = entry.get('transfer_id')
            if transfer_id and transfer_id in verified:
                transfer_changes = verified[transfer_id]
                if transfer_changes is None:
                    verified[transfer_id] = transfer_changes = []
                entry_copy = {}
                entry_copy.update(entry)
                del entry_copy['transfer_id']
                transfer_changes.append(entry_copy)

        if created:
            ivr.first_sync_ts = to_datetime(
                transfers_download['first_sync_ts'])
            ivr.sync_total = len_results + transfers_download['remain']
            ivr.sync_done = len_results
            ivr.verified = verified
        else:
            ivr.sync_done += len_results
            dbsession.add(VerificationResult(
                owner_id=owner.id,
                verification_id=ivr.verification_id,
                initial=False,
                verified=verified,
                expires=self.expires,
            ))

        ivr.last_sync_ts = to_datetime(
            transfers_download['last_sync_ts'])
        ivr.last_sync_transfer_id = (
            transfers_download['results'][-1]['id'])

    def verify_final(self, ivr):
        """Verify the entire download.
        """
        request = self.request
        dbsession = request.dbsession
        owner = request.owner

        # Look for transfers
        # downloaded previously that were not included in the
        # download.
        rows = (
            dbsession.query(TransferRecord.transfer_id)
            .filter(TransferRecord.owner_id == owner.id)
            .all())
        stored_transfer_ids = set(row[0] for row in rows)

        rows = (
            dbsession.query(VerificationResult.verified)
            .filter(
                VerificationResult.owner_id == owner.id,
                VerificationResult.verification_id == ivr.verification_id,
            )
            .all())
        verified_transfer_ids = set.union(*(set(row[0]) for row in rows))

        missing_transfer_ids = (
            stored_transfer_ids.difference(verified_transfer_ids))

        if missing_transfer_ids:
            missing_list = sorted(missing_transfer_ids)
            transfer_id = missing_list[0]
            # Note that it's possible for clients to trigger
            # this error inappropriately by downloading
            # only part of the history while claiming all of
            # the history was downloaded. Is that a serious issue?
            msg = (
                "Verification failure in transfer %s. "
                "The transfer appears to be missing from OPN. "
                "Total missing transfers: %d, verification ID: %s" % (
                    transfer_id,
                    len(missing_list),
                    ivr.verification_id,
                ))
            log.error(msg)
            raise VerificationFailure(msg, transfer_id=transfer_id)


@view_config(
    name='verify-details',
    context=API,
    permission=perms.use_app,
    renderer='json')
def get_verify_details(context, request):
    """Get details from a verification result."""
    verification_id = str(request.params.get('verification_id', ''))
    offset = int(request.params.get('offset', 0))

    dbsession = request.dbsession
    owner = request.owner

    rows = (
        dbsession.query(VerificationResult.verified)
        .filter(
            VerificationResult.owner_id == owner.id,
            VerificationResult.verification_id == verification_id,
        )
        .order_by(VerificationResult.id)
        .offset(offset)
        .limit(2)
        .all())

    if not rows:
        return {}
    return {
        'verified': rows[0][0],
        'more': len(rows) > 1,
    }
