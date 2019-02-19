
from opnreco.models import perms
from opnreco.models.db import AccountEntry
from opnreco.models.db import Movement
from opnreco.models.db import Period
from opnreco.models.db import Reco
from opnreco.models.db import TransferRecord
from opnreco.models.db import VerificationResult
from opnreco.models.site import API
from opnreco.syncbase import SyncBase
from opnreco.syncbase import VerificationFailure
from opnreco.util import to_datetime
from pyramid.decorator import reify
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.httpexceptions import HTTPInsufficientStorage
from pyramid.view import view_config
from sqlalchemy import func
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
    batch_limit = 250

    def __call__(self):
        request = self.request
        dbsession = request.dbsession
        owner = request.owner

        self.now = datetime.datetime.utcnow()
        self.expires = self.now + datetime.timedelta(days=1)
        self.change_log = []

        # Expire old verification records.
        (dbsession.query(VerificationResult)
            .filter(VerificationResult.owner_id == owner.id)
            .filter(VerificationResult.expires <= self.now)
            .delete())

        try:
            ivr = self.ivr
            if request.json.get('verify_sync'):
                progress_percent, more = self.verify_sync()
            else:
                self.verify_internal()
                progress_percent = 100
                more = False
                ivr.sync_done = 0
                ivr.sync_total = 0
        except VerificationFailure as e:
            # HTTP error 507 is reasonably close to
            # 'data verification error on the server'. HTTP error 507
            # is also obscure enough that it probably won't be
            # triggered by any other error.
            raise HTTPInsufficientStorage(json_body={
                'error': 'verification_failure',
                'error_description': str(e),
            })

        return {
            'verification_id': ivr.verification_id,
            'sync_done': ivr.sync_done,
            'sync_total': ivr.sync_total,
            'progress_percent': progress_percent,
            'change_count': self.change_count,
            'more': more,
            'internal_ok': not not ivr.internal_result,
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
            created_ivr = True

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
            created_ivr = False

        return ivr, created_ivr

    @reify
    def ivr(self):
        ivr, created_ivr = self.get_ivr()
        self.created_ivr = created_ivr
        return ivr

    @reify
    def created_ivr(self):
        ivr, created_ivr = self.get_ivr()
        self.ivr = ivr
        return created_ivr

    def verify_sync(self):
        """Compare transfer records."""
        ivr = self.ivr
        created_ivr = self.created_ivr

        transfers_download = self.download_batch(
            sync_ts_iso=ivr.last_sync_ts.isoformat() + 'Z',
            sync_transfer_id=ivr.last_sync_transfer_id,
            count_remain=created_ivr)

        self.import_transfer_records(transfers_download)

        self.log_download(transfers_download=transfers_download)

        if transfers_download['more']:
            # Note: avoid division by zero.
            progress_percent = min(99, int(
                100.0 * ivr.sync_done / ivr.sync_total
                if ivr.sync_total else 0.0))
        else:
            self.verify_final()
            progress_percent = 100

        more = transfers_download['more']
        return progress_percent, more

    def log_download(self, transfers_download):
        """Log the results of the transfer download in a VerificationResult."""
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

        ivr = self.ivr
        if self.created_ivr:
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

    def verify_final(self):
        """Verify the entire download.
        """
        request = self.request
        dbsession = request.dbsession
        owner = request.owner
        ivr = self.ivr

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

        if request.json.get('verify_internal'):
            self.verify_internal()

    def verify_internal(self):
        """Verify the internal state of this tool."""

        # Ensure all standard recos sum to zero.
        request = self.request
        dbsession = request.dbsession
        owner = request.owner

        movement_delta_c = Movement.wallet_delta + Movement.vault_delta
        movement_subq = (
            dbsession.query(func.sum(movement_delta_c).label('delta'))
            .filter(Movement.reco_id == Reco.id)
            .correlate(Reco)
            .as_scalar())

        entry_subq = (
            dbsession.query(func.sum(AccountEntry.delta).label('delta'))
            .filter(AccountEntry.reco_id == Reco.id)
            .correlate(Reco)
            .as_scalar())

        row = (
            dbsession.query(Reco.id)
            .filter(
                Reco.owner_id == owner.id,
                Reco.reco_type == 'standard',
                movement_subq + entry_subq != 0,
            )
            .order_by(Reco.id)
            .first())

        if row is not None:
            [reco_id] = row
            msg = (
                "Reconciliation verification failure: "
                "standard reconciliation %s is unbalanced." % reco_id)
            raise VerificationFailure(msg, transfer_id=None)

        # Ensure the balance at the start of every period matches the end
        # of the previous period.

        periods = (
            dbsession.query(Period)
            .filter(Period.owner_id == owner.id)
            .order_by(
                Period.peer_id,
                Period.loop_id,
                Period.currency,
                Period.start_date)
            .all())

        prev_ploop = ()  # (peer_id, loop_id, currency)
        prev_period = None

        for period in periods:
            ploop = (period.peer_id, period.loop_id, period.currency)
            if ploop != prev_ploop:
                # Start of a new sequence
                prev_ploop = ploop
                prev_period = period
                continue

            if not prev_period.closed:
                # The previous balance is still fluctuating.
                prev_period = period
                continue

            if (period.start_circ != prev_period.end_circ or
                    period.start_surplus != prev_period.end_surplus):
                msg = (
                    "Period balance verification failure: "
                    "Period %s (start date %s) starts with balances of "
                    "%s (circulation) and %s (surplus), "
                    "but the previous period ends with "
                    "%s (circulation) and %s (surplus)." % (
                        period.id,
                        period.start_date.isoformat(),
                        period.start_circ, period.start_surplus,
                        prev_period.end_circ, prev_period.end_surplus,
                    ))
                raise VerificationFailure(msg, transfer_id=None)

            prev_period = period

        self.ivr.internal_result = {
            'recos_ok': True, 'periods_ok': True,
        }


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
