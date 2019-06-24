
from opnreco.models import perms
from opnreco.models.db import OPNDownload
from opnreco.models.db import OwnerLog
from opnreco.models.site import API
from opnreco.syncbase import SyncBase
from opnreco.syncbase import VerificationFailure
from opnreco.util import to_datetime
from pyramid.httpexceptions import HTTPInsufficientStorage
from pyramid.view import view_config
import datetime
import logging
import pytz

log = logging.getLogger(__name__)


@view_config(
    name='sync',
    context=API,
    permission=perms.use_app,
    renderer='json')
class SyncAPI(SyncBase):
    write_enabled = True

    def set_tzname(self):
        """If the owner doesn't have a tzname yet, try to set it."""
        request = self.request
        owner = self.owner

        if not owner.tzname:
            try:
                params = self.request.json
            except Exception:
                params = {}
            tzname = params.get('tzname', '').strip()
            if tzname and tzname in pytz.all_timezones:
                owner.tzname = tzname
                request.dbsession.add(OwnerLog(
                    owner_id=owner.id,
                    personal_id=request.personal_id,
                    event_type='tzname_init',
                    remote_addr=request.remote_addr,
                    user_agent=request.user_agent,
                    content={
                        'tzname': tzname,
                    },
                ))

    def __call__(self):
        request = self.request
        owner = self.owner

        if not self.interpreters:
            # No files have been set up for the owner. Don't bother
            # syncing until the first file is created.
            return {
                'progress_percent': 100,
                'change_count': 0,
                'download_count': 0,
                'more': False,
                'first_sync_ts': '1970-01-01T00:00:00Z',
                'last_sync_ts': '1970-01-01T00:00:00Z',
            }

        self.set_tzname()

        if owner.first_sync_ts is None:
            # Start a new sync. Download transfers created or changed
            # after 5 minutes before the last sync. (Add 5 minutes in
            # case some transfers showed up out of order.)
            if owner.last_sync_ts is not None:
                sync_ts = (
                    owner.last_sync_ts - datetime.timedelta(seconds=60 * 5))
            else:
                sync_ts = datetime.datetime(1970, 1, 1)
            sync_transfer_id = None
            count_remain = True
        else:
            # A sync was started but not finished. Download the next batch.
            sync_ts = owner.last_sync_ts
            sync_transfer_id = owner.last_sync_transfer_id
            count_remain = False
        sync_ts_iso = sync_ts.isoformat() + 'Z'

        transfers_download = self.download_batch(
            sync_ts_iso=sync_ts_iso,
            sync_transfer_id=sync_transfer_id,
            count_remain=count_remain)

        dbsession = request.dbsession
        more = transfers_download['more']
        now = datetime.datetime.utcnow()

        if more:
            len_results = len(transfers_download['results'])
            if owner.first_sync_ts is None:
                owner.first_sync_ts = to_datetime(
                    transfers_download['first_sync_ts'])
                owner.sync_total = len_results + transfers_download['remain']
                owner.sync_done = len_results
            else:
                owner.sync_done += len_results
            owner.last_sync_ts = to_datetime(
                transfers_download['last_sync_ts'])
            owner.last_sync_transfer_id = (
                transfers_download['results'][-1]['id'])
            # Note: avoid division by zero.
            progress_percent = min(99, int(
                100.0 * owner.sync_done / owner.sync_total
                if owner.sync_total else 0.0))
        else:
            owner.first_sync_ts = None
            owner.last_sync_transfer_id = None
            owner.last_sync_ts = now
            owner.sync_total = 0
            owner.sync_done = 0
            progress_percent = 100

        opn_download = OPNDownload(
            owner_id=owner.id,
            content={
                'transfers': transfers_download,
                'more': more,
            },
        )
        dbsession.add(opn_download)
        dbsession.flush()

        self.opn_download_id = opn_download.id

        dbsession.add(OwnerLog(
            owner_id=owner.id,
            personal_id=request.personal_id,
            event_type='opn_sync',
            remote_addr=request.remote_addr,
            user_agent=request.user_agent,
            content={
                'sync_ts': sync_ts_iso,
                'progress_percent': progress_percent,
                'change_count': len(self.change_log),
                'transfers': {
                    'ids': sorted(
                        t['id'] for t in transfers_download['results']),
                    'count': len(transfers_download['results']),
                    'more': more,
                    'first_sync_ts': transfers_download['first_sync_ts'],
                    'last_sync_ts': transfers_download['last_sync_ts'],
                }
            },
        ))

        try:
            self.import_transfer_records(transfers_download)
        except VerificationFailure as e:
            # HTTP Error 507 is reasonably close to 'data verification error'.
            raise HTTPInsufficientStorage(json_body={
                'error': 'verification_failure',
                'error_description': str(e),
            })

        return {
            'progress_percent': progress_percent,
            'change_count': len(self.change_log),
            'download_count': len(transfers_download['results']),
            'more': more,
            'first_sync_ts': transfers_download['first_sync_ts'],
            'last_sync_ts': transfers_download['last_sync_ts'],
        }
