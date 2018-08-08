
from opnreport.models.db import OPNDownload
from opnreport.models.db import ProfileLog
from opnreport.models.db import TransferDownloadRecord
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.util import check_requests_response
from opnreport.util import to_datetime
from pyramid.view import view_config
import datetime
import os
import requests
import logging

log = logging.getLogger(__name__)


class SyncError(Exception):
    """Data synchronization error"""


@view_config(
    name='download',
    context=API,
    permission='use_app',
    renderer='json')
class DownloadView:
    def __init__(self, request):
        self.request = request

    def __call__(self):
        request = self.request
        api_url = os.environ['opn_api_url']
        profile = request.profile

        # Download transfers created or changed since 5 minutes before the last
        # download. (Add 5 minutes in case some transfers showed up
        # out of order.)
        since_activity_ts = profile.last_download - datetime.timedelta(
            seconds=60 * 5)
        since_activity_ts_iso = since_activity_ts.isoformat() + 'Z'

        url = '%s/wallet/history_download' % api_url
        r = requests.post(
            url,
            data={'since_activity_ts': since_activity_ts_iso},
            headers={'Authorization': 'Bearer %s' % request.access_token})
        check_requests_response(r)

        transfers_download = r.json()
        dbsession = request.dbsession

        dbsession.add(ProfileLog(
            profile_id=profile.id,
            event_type='opn_download',
            remote_addr=request.remote_addr,
            user_agent=request.user_agent,
            memo={
                'since_activity_ts': since_activity_ts_iso,
                'transfers': {
                    'count': len(transfers_download['results']),
                    'more': transfers_download['more'],
                }
            },
        ))
        opn_download = OPNDownload(
            profile_id=profile.id,
            content={
                'transfers': transfers_download,
            },
        )
        dbsession.add(opn_download)
        dbsession.flush()
        self.opn_download_id = opn_download.id

        self.update_transfer_records(transfers_download)

        return transfers_download

    def update_transfer_records(self, transfers_download):
        """Add and update TransferRecord rows."""
        dbsession = self.request.dbsession
        profile = self.request.profile

        transfer_ids = [item['id'] for item in transfers_download['results']]

        record_list = (
            dbsession.query(TransferRecord)
            .filter(TransferRecord.profile_id == profile.id)
            .filter(TransferRecord.transfer_id.in_(transfer_ids))
            .all())

        record_map = {record.transfer_id: record for record in record_list}

        for item in transfers_download['results']:
            changed = []
            kw = {
                'workflow_type': item['workflow_type'],
                'start': to_datetime(item['start']),
                'timestamp': to_datetime(item['timestamp']),
                'activity_ts': to_datetime(item['activity_ts']),
                'completed': item['completed'],
                'canceled': item['canceled'],
                'sender_id': item['sender_id'] or None,
                'sender_uid': item['sender_uid'] or None,
                'sender_title': (item['sender_info'] or {}).get('title'),
                'recipient_id': item['recipient_id'] or None,
                'recipient_uid': item['recipient_uid'] or None,
                'recipient_title': (item['recipient_info'] or {}).get('title'),
            }

            transfer_id = item['id']
            record = record_map.get(transfer_id)
            if record is None:
                # Add a TransferRecord.
                movement_list_index = 0
                record = TransferRecord(
                    transfer_id=transfer_id,
                    profile_id=profile.id,
                    movement_lists=[item['movements']],
                    **kw)
                changed.append('new')
                dbsession.add(record)
                dbsession.flush()
                record_map[transfer_id] = record

            else:
                # Update a TransferRecord.
                immutable_attrs = ('workflow_type', 'start')
                for attr in immutable_attrs:
                    if kw[attr] != getattr(record, attr):
                        raise SyncError(
                            "Transfer %s: old %s was %s, new %s is %s" %
                            (transfer_id, getattr(record, attr), kw[attr]))

                for attr, value in sorted(kw.items()):
                    if getattr(record, attr) != value:
                        setattr(record, attr, value)
                        changed.append(attr)

                new_movements = item['movements']
                if new_movements == record.movement_lists[-1]:
                    # No new movements.
                    movement_list_index = len(record.movement_lists) - 1
                else:
                    # New movements.
                    movement_list_index = len(record.movement_lists)
                    record.movement_lists = (
                        record.movement_lists + [new_movements])
                    changed.append('movements')

            dbsession.add(TransferDownloadRecord(
                opn_download_id=self.opn_download_id,
                transfer_record_id=record.id,
                transfer_id=transfer_id,
                movement_list_index=movement_list_index,
                changed=changed))
