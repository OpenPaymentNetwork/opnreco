
from decimal import Decimal
from opnreport.models.db import MovementSummary
from opnreport.models.db import OPNDownload
from opnreport.models.db import ProfileEvent
from opnreport.models.db import RecoEntry
from opnreport.models.db import RecoEntryEvent
from opnreport.models.db import TransferDownloadRecord
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.util import check_requests_response
from opnreport.util import to_datetime
from pyramid.view import view_config
import collections
import datetime
import logging
import os
import requests

log = logging.getLogger(__name__)
zero = Decimal()


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
        self.profile = profile = request.profile
        self.profile_id = profile.id

    def __call__(self):
        request = self.request
        api_url = os.environ['opn_api_url']
        profile = self.profile

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

        dbsession.add(ProfileEvent(
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
        profile_id = self.profile_id

        transfer_ids = [item['id'] for item in transfers_download['results']]

        record_list = (
            dbsession.query(TransferRecord)
            .filter(TransferRecord.profile_id == profile_id)
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
                new_movement_list = item['movements']
                record = TransferRecord(
                    transfer_id=transfer_id,
                    profile_id=profile_id,
                    movement_lists=[new_movement_list],
                    **kw)
                changed.append('new')
                dbsession.add(record)
                dbsession.flush()  # Assign record.id
                record_map[transfer_id] = record
                added_movement_list = True

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

                new_movement_list = item['movements']
                if new_movement_list == record.movement_lists[-1]:
                    # No new movements.
                    added_movement_list = False
                    movement_list_index = len(record.movement_lists) - 1
                else:
                    # New movements.
                    movement_list_index = len(record.movement_lists)
                    record.movement_lists = (
                        record.movement_lists + [new_movement_list])
                    changed.append('movements')
                    added_movement_list = True

            dbsession.add(TransferDownloadRecord(
                opn_download_id=self.opn_download_id,
                transfer_record_id=record.id,
                transfer_id=transfer_id,
                movement_list_index=movement_list_index,
                changed=changed))

            if added_movement_list:
                self.add_movements(record)

    def add_movements(self, record):
        dbsession = self.request.dbsession
        profile_id = self.profile_id

        summaries = self.summarize_movements(record.movement_lists[-1])

        if len(record.movement_lists) > 1:
            # Convert the summaries into an offset of the previous summaries.
            old_summaries = self.summarize_movements(record.movement_lists[-2])
            for key, old_delta in old_summaries.items():
                new_delta = summaries.get(key, zero) - old_delta
                if new_delta:
                    summaries[key] = new_delta
                elif key in summaries:
                    del summaries[key]

        mss = []

        for key, delta in sorted(summaries.items()):
            account_id, loop_id, currency = key
            row = MovementSummary(
                transfer_record_id=record.id,
                profile_id=profile_id,
                account_id=account_id,
                movement_list_index=len(record.movement_lists) - 1,
                loop_id=loop_id,
                currency=currency,
                delta=delta,
                reco_entry_id=None)
            dbsession.add(row)
            mss.append(row)
        dbsession.flush()  # Assign ids to the MovementSummaries

        reco_entries = []

        # Add a RecoEntry for each movement summary.
        for ms in mss:
            reco_entry = RecoEntry(
                profile_id=profile_id,
                account_id=ms.account_id,
                movement_summary_id=ms.id,
            )
            dbsession.add(reco_entry)
            reco_entries.append(reco_entry)
        dbsession.flush()  # Assign ids to the RecoEntries

        for reco_entry in reco_entries:
            dbsession.add(RecoEntryEvent(
                reco_entry_id=reco_entry.id,
                event_type='opn_download',
                memo={'transfer_id': record.transfer_id}))

    def summarize_movements(self, movement_list):
        profile_id = self.profile_id

        # res: {(account_id or 'omnibus', loop_id, currency): delta}
        res = collections.defaultdict(Decimal)

        for movement in movement_list:
            from_id = movement['from_id']
            to_id = movement['to_id']
            for loop in movement['loops']:
                loop_id = loop['loop_id']
                currency = loop['currency']
                amount = loop['amount']
                issuer_id = loop['issuer_id']

                if not from_id or not to_id:
                    # Ignore issuance movements. They have no effect on
                    # reconciliation.
                    continue

                if from_id == profile_id and to_id != profile_id:
                    if from_id == issuer_id:
                        # OPN cash was put into circulation.
                        account_id = 'c'
                    else:
                        # OPN cash was sent to an account or other wallet.
                        account_id = to_id
                    key = (account_id, loop_id, currency)
                    res[key] -= Decimal(amount)
                elif to_id == profile_id and from_id != profile_id:
                    if to_id == issuer_id:
                        # OPN cash was taken out of circulation.
                        account_id = 'c'
                    else:
                        # OPN cash was received from an account
                        # or other wallet.
                        account_id = from_id
                    key = (account_id, loop_id, currency)
                    res[key] += Decimal(amount)

        return res
