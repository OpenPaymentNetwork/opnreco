
from decimal import Decimal
from opnreport.models.db import Mirror
from opnreport.models.db import Movement
from opnreport.models.db import MovementLog
from opnreport.models.db import MovementReco
from opnreport.models.db import now_func
from opnreport.models.db import OPNDownload
from opnreport.models.db import ProfileLog
from opnreport.models.db import Reco
from opnreport.models.db import TransferDownloadRecord
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.util import check_requests_response
from opnreport.util import to_datetime
from pyramid.decorator import reify
from pyramid.view import view_config
from sqlalchemy import or_
import collections
import datetime
import logging
import os
import requests

log = logging.getLogger(__name__)
zero = Decimal()
null = None


class SyncError(Exception):
    """Data synchronization error"""


@view_config(
    name='sync',
    context=API,
    permission='use_app',
    renderer='json')
class SyncView:
    """Sync with OPN.

    This view downloads all transfers and movements since the last sync.
    """
    def __init__(self, request):
        self.request = request
        self.profile = profile = request.profile
        self.profile_id = profile.id
        self.mirrors = {}  # {(target_id, loop_id, currency): mirror}
        self.api_url = os.environ['opn_api_url']

    def __call__(self):
        request = self.request
        profile = self.profile

        if profile.first_sync_ts is None:
            # Start a new sync. Download transfers created or changed
            # after 5 minutes before the last sync. (Add 5 minutes in
            # case some transfers showed up out of order.)
            if profile.last_sync_ts is not None:
                sync_ts = (
                    profile.last_sync_ts - datetime.timedelta(seconds=60 * 5))
            else:
                sync_ts = datetime.datetime(1970, 1, 1)
            sync_transfer_id = None
            count_remain = True
        else:
            # A sync was started but not finished. Download the next batch.
            sync_ts = profile.last_sync_ts
            sync_transfer_id = profile.last_sync_transfer_id
            count_remain = False
        sync_ts_iso = sync_ts.isoformat() + 'Z'

        url = '%s/wallet/history_sync' % self.api_url
        postdata = {
            'sync_ts': sync_ts_iso,
            'transfer_id': sync_transfer_id,
        }
        if count_remain:
            postdata['count_remain'] = 'true'

        r = requests.post(
            url,
            data=postdata,
            headers={'Authorization': 'Bearer %s' % request.access_token})
        check_requests_response(r)

        transfers_download = r.json()
        dbsession = request.dbsession
        more = transfers_download['more']
        now = datetime.datetime.utcnow()

        if more:
            len_results = len(transfers_download['results'])
            if profile.first_sync_ts is None:
                profile.first_sync_ts = to_datetime(
                    transfers_download['first_sync_ts'])
                profile.sync_total = len_results + transfers_download['remain']
                profile.sync_done = len_results
            else:
                profile.sync_done += len_results
            profile.last_sync_ts = to_datetime(
                transfers_download['last_sync_ts'])
            profile.last_transfer_id = (
                transfers_download['results'][-1]['id'])
            # Note: avoid division by zero.
            progress_percent = int(
                100.0 * profile.sync_done / profile.sync_total
                if profile.sync_total else 0.0)
        else:
            profile.first_sync_ts = None
            profile.last_sync_transfer_id = None
            profile.last_sync_ts = now
            profile.sync_total = 0
            profile.sync_done = 0
            progress_percent = 100

        opn_download = OPNDownload(
            profile_id=profile.id,
            content={
                'transfers': transfers_download,
                'more': more,
            },
        )
        dbsession.add(opn_download)
        dbsession.flush()

        self.opn_download_id = opn_download.id

        dbsession.add(ProfileLog(
            profile_id=profile.id,
            event_type='opn_sync',
            remote_addr=request.remote_addr,
            user_agent=request.user_agent,
            memo={
                'sync_ts': sync_ts_iso,
                'progress_percent': progress_percent,
                'transfers': {
                    'ids': sorted(
                        t['id'] for t in transfers_download['results']),
                    'count': len(transfers_download['results']),
                    'more': transfers_download['more'],
                    'first_sync_ts': transfers_download['first_sync_ts'],
                    'last_sync_ts': transfers_download['last_sync_ts'],
                }
            },
        ))

        self.import_transfer_records(transfers_download)
        self.update_mirrors()

        return {
            'count': len(transfers_download['results']),
            'more': more,
            'progress_percent': progress_percent,
            'last_sync_ts': transfers_download['last_sync_ts'],
        }

    def import_transfer_records(self, transfers_download):
        """Add and update TransferRecord rows."""
        dbsession = self.request.dbsession
        profile_id = self.profile_id

        transfer_ids = [item['id'] for item in transfers_download['results']]

        record_list = (
            dbsession.query(TransferRecord)
            .filter(TransferRecord.profile_id == profile_id)
            .filter(TransferRecord.file_id == null)
            .filter(TransferRecord.transfer_id.in_(transfer_ids))
            .all())

        record_map = {record.transfer_id: record for record in record_list}

        for item in transfers_download['results']:
            changed = []
            kw = {
                'workflow_type': item['workflow_type'],
                'start': to_datetime(item['start']),
                'timestamp': to_datetime(item['timestamp']),
                'next_activity': item['next_activity'],
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
                new_record = True
                record = TransferRecord(
                    transfer_id=transfer_id,
                    file_id=null,
                    profile_id=profile_id,
                    **kw)
                changed.append('new')
                dbsession.add(record)
                dbsession.flush()  # Assign record.id
                record_map[transfer_id] = record

            else:
                # Update a TransferRecord.
                new_record = False
                immutable_attrs = ('workflow_type', 'start')
                for attr in immutable_attrs:
                    if kw[attr] != getattr(record, attr):
                        raise SyncError(
                            "Transfer %s: Immutable attribute changed. "
                            "Old %s was %s, new %s is %s" %
                            (transfer_id, attr, repr(getattr(record, attr)),
                                attr, repr(kw[attr])))

                changed_map = {}
                for attr, value in sorted(kw.items()):
                    if getattr(record, attr) != value:
                        setattr(record, attr, value)
                        changed_map[attr] = value
                if changed_map:
                    changed.append(changed_map)

            dbsession.add(TransferDownloadRecord(
                opn_download_id=self.opn_download_id,
                transfer_record_id=record.id,
                transfer_id=transfer_id,
                changed=changed))

            if item['movements']:
                self.import_movements(record, item, new_record=new_record)

    def import_movements(self, record, item, new_record):
        transfer_id = item['id']
        dbsession = self.request.dbsession

        # Prepare movement_rows, a dict of movements already imported.
        rows = (
            dbsession.query(Movement)
            .filter_by(transfer_record_id=record.id)
            .all())
        # movement_rows: {(number, mirror_id): Movement}
        movement_rows = {(row.number, row.mirror_id): row for row in rows}

        for movement in item['movements']:
            number = movement.get('number')
            if not number:
                raise ValueError(
                    "The OPN service needs to be migrated to support "
                    "movement numbers. (OPN: upgrade and run bin/resummarize)")
            ts = to_datetime(movement['timestamp'])
            action = movement['action']

            by_mirror = self.summarize_movement(
                movement, transfer_id=transfer_id)

            # Add movement records based on the by_mirror dict.
            for mirror_id, delta in sorted(by_mirror.items()):
                old_movement = movement_rows.get((number, mirror_id))

                if old_movement is not None:
                    # The movement is already recorded.
                    # Verify it has not changed.
                    if old_movement.ts != ts:
                        raise ValueError(
                            "Movement %s in transfer %s has changed:"
                            "recorded timestamp is %s, new timestamp is %s" % (
                                number, transfer_id,
                                old_movement.ts.isoformat(), ts.isoformat()))
                    if old_movement.action != action:
                        raise ValueError(
                            "Movement %s in transfer %s has changed:"
                            "recorded action is %s, new action is %s" % (
                                number, transfer_id,
                                old_movement.action, action))
                    if old_movement.delta != delta:
                        raise ValueError(
                            "Movement %s in transfer %s has changed:"
                            "recorded delta is %s, new delta is %s" % (
                                number, transfer_id,
                                old_movement.delta, delta))
                    continue

                # Record the movement.
                row = Movement(
                    transfer_record_id=record.id,
                    number=number,
                    mirror_id=mirror_id,
                    action=action,
                    ts=ts,
                    delta=delta,
                )
                dbsession.add(row)
                dbsession.flush()  # Assign row.id

                movement_rows[(number, mirror_id)] = row

                dbsession.add(MovementLog(
                    movement_id=row.id,
                    event_type='download',
                    # Only the immutable attributes changed.
                    # There were no changes to mutable attributes.
                    changes={},
                ))

        self.autoreco(
            record=record,
            movements=movement_rows.values(),
            new_record=new_record)

    def summarize_movement(self, movement, transfer_id):
        """Summarize a movement: return {mirror_id: delta}"""
        number = movement['number']
        from_id = movement['from_id']
        to_id = movement['to_id']

        if not from_id:
            # Ignore issuance movements. They have no effect on
            # reconciliation.
            # (Note: sometimes issuance movements show notes from another
            # issuer, but that only indicates the issuer is holding another
            # issuer's notes and is giving them out.)
            return {}

        if not to_id:
            raise AssertionError(
                "Movement %s in transfer %s has no to_id"
                % (number, transfer_id))

        profile_id = self.profile_id
        by_mirror = collections.defaultdict(Decimal)  # {mirror_id: delta}

        for loop in movement['loops']:
            loop_id = loop['loop_id']
            currency = loop['currency']
            issuer_id = loop['issuer_id']

            if from_id == profile_id and to_id != profile_id:
                if from_id == issuer_id:
                    # OPN cash was put into circulation.
                    target_id = 'c'
                else:
                    # OPN cash was sent to an account or other wallet.
                    target_id = to_id
                delta = -Decimal(loop['amount'])

            elif to_id == profile_id and from_id != profile_id:
                if to_id == issuer_id:
                    # OPN cash was taken out of circulation.
                    target_id = 'c'
                else:
                    # OPN cash was received from an account
                    # or other wallet.
                    target_id = from_id
                delta = Decimal(loop['amount'])

            else:
                # Ignore movements from the profile to itself.
                continue

            mirror = self.prepare_mirror(target_id, loop_id, currency)
            by_mirror[mirror.id] += delta

        return by_mirror

    def prepare_mirror(self, target_id, loop_id, currency):
        key = (target_id, loop_id, currency)
        mirror = self.mirrors.get(key)
        if mirror is not None:
            return mirror

        dbsession = self.request.dbsession
        profile_id = self.profile_id
        mirror = (
            dbsession.query(Mirror)
            .filter_by(
                profile_id=profile_id,
                target_id=target_id,
                file_id=null,
                loop_id=loop_id,
                currency=currency,
            ).first()
        )
        if mirror is not None:
            self.mirrors[key] = mirror
        else:
            mirror = Mirror(
                profile_id=profile_id,
                target_id=target_id,
                file_id=null,
                loop_id=loop_id,
                currency=currency)
            dbsession.add(mirror)
            dbsession.flush()  # Assign mirror.id

            dbsession.add(ProfileLog(
                profile_id=self.profile_id,
                event_type='add_mirror',
                memo={
                    'mirror_id': mirror.id,
                    'target_id': target_id,
                    'loop_id': loop_id,
                    'currency': currency,
                }))

        return mirror

    @reify
    def account_map(self):
        # Get the map of accounts from /wallet/info.
        account_list = self.request.wallet_info['profile']['accounts']
        return {a['id']: a for a in account_list}

    def update_mirrors(self):
        """Update the target_title and loop_title of the profile's mirrors."""
        update_check_time = (
            datetime.datetime.utcnow() - datetime.timedelta(seconds=60 * 10))
        dbsession = self.request.dbsession
        headers = {'Authorization': 'Bearer %s' % self.request.access_token}
        seen = []

        while True:
            mirrors = (
                dbsession.query(Mirror)
                .filter_by(profile_id=self.profile_id)
                .filter(~Mirror.id.in_(seen))
                .filter(or_(
                    Mirror.last_update == null,
                    Mirror.last_update < update_check_time))
                .order_by(Mirror.id)
                .limit(100)
                .all())

            if not mirrors:
                break

            for mirror in mirrors:
                # Get the title of the target.
                target_title = None
                target_is_dfi_account = False
                if mirror.target_id == 'c':
                    target_title = self.profile.title
                else:
                    account = self.account_map.get(mirror.target_id)
                    if account:
                        target_is_dfi_account = True
                        target_title = '%s at %s' % (
                            account['redacted_account_num'],
                            account['rdfi_name'],
                        )
                        if account['alias']:
                            target_title += ' (%s)' % account['alias']
                    else:
                        url = '%s/p/%s' % (self.api_url, mirror.target_id)
                        r = requests.get(url, headers=headers)
                        if check_requests_response(r, raise_exc=False):
                            target_title = r.json()['title']

                if target_title:
                    if target_title != mirror.target_title:
                        mirror.target_title = target_title
                        dbsession.add(ProfileLog(
                            profile_id=self.profile_id,
                            event_type='update_mirror_target_title',
                            memo={
                                'mirror_id': mirror.id,
                                'target_id': mirror.target_id,
                                'target_title': target_title,
                            }))
                else:
                    # The error details were logged by
                    # check_requests_response().
                    log.warning(
                        "Unable to get the title of holder %s",
                        mirror.target_id)

                if target_is_dfi_account != mirror.target_is_dfi_account:
                    mirror.target_is_dfi_account = target_is_dfi_account
                    dbsession.add(ProfileLog(
                        profile_id=self.profile_id,
                        event_type='update_mirror_target_is_dfi_account',
                        memo={
                            'mirror_id': mirror.id,
                            'target_id': mirror.target_id,
                            'target_is_dfi_account': target_is_dfi_account,
                        }))

                if mirror.loop_id != '0':
                    # Get the title of the cash design.
                    url = '%s/design/%s' % (self.api_url, mirror.loop_id)
                    r = requests.get(url, headers=headers)
                    if check_requests_response(r, raise_exc=False):
                        title = r.json()['title']
                        if title != mirror.loop_title:
                            mirror.loop_title = title
                            dbsession.add(ProfileLog(
                                profile_id=self.profile_id,
                                event_type='update_mirror_loop_title',
                                memo={
                                    'mirror_id': mirror.id,
                                    'loop_id': mirror.loop_id,
                                    'title': title,
                                }))
                    else:
                        # The error details were logged by
                        # check_requests_response().
                        log.warning(
                            "Unable to get the title of cash loop %s",
                            mirror.loop_id)

                mirror.last_update = now_func

            dbsession.flush()
            seen.extend(m.id for m in mirrors)

    def autoreco(self, record, movements, new_record):
        """Auto-reconcile some of the movements in a TransferRecord.
        """
        dbsession = self.request.dbsession

        if new_record:
            # No recos exist yet for this TransferRecord.
            reco_rows = ()
            done_movement_ids = set()
        else:
            # List the existing recos for this TransferRecord.
            reco_rows = (
                dbsession.query(Movement.id, Reco.id)
                .join(
                    TransferRecord,
                    TransferRecord.id == Movement.transfer_record_id)
                .join(
                    MovementReco,
                    MovementReco.movement_id == Movement.id)
                .join(
                    Reco,
                    Reco.id == MovementReco.reco_id)
                .filter(TransferRecord.id == record.id)
                .all())
            done_movement_ids = set(row[0] for row in reco_rows)

        internal_seqs = find_internal_movements(
            movements=movements,
            done_movement_ids=done_movement_ids)

        added = False

        for mvlist in internal_seqs:
            if len(mvlist) < 2:
                continue

            conflict = False
            for movement in mvlist:
                if movement.id in done_movement_ids:
                    conflict = True
                    break

            if conflict:
                continue

            movement = mvlist[-1]
            reco = Reco(
                mirror_id=movement.mirror_id,
                entry_date=movement.ts.date(),
                auto=True,
            )
            dbsession.add(reco)
            dbsession.flush()
            reco_id = reco.id
            added = True

            for movement in mvlist:
                dbsession.add(MovementReco(
                    movement_id=movement.id,
                    reco_id=reco_id))
                dbsession.add(MovementLog(
                    movement_id=movement.id,
                    event_type='autoreco',
                    changes={'reco_id': reco_id},
                ))

        if added:
            dbsession.flush()


def find_internal_movements(movements, done_movement_ids):
    """Find internal movements that can be auto-reconciled.

    Automatic reconciliation looks for sequences of internal movements
    that balance out exactly and generates automatic reconciliation
    records for them.

    Detect internal movements by looking for either "hills" or
    "valleys". A "hill" is a sequence of increases followed by
    matching decreases. A "valley" is a sequence of decreases
    followed by matching increases.

    Do not auto-reconcile if:

    - The movements in the sequence have been reconciled already.
    - The movements don't appear to be internal (based on the action name).
    - The internal movements don't look like a balanced hill or valley.
    - The internal movements do not balance.

    We could theoretically auto-reconcile more complex movements (such
    as a balanced hill with dips), but that would probably generate
    some false positives.
    """

    # Group by mirror, filtering out movements that somehow moved nothing.
    groups = collections.defaultdict(list)
    for movement in movements:
        if movement.delta != zero:
            groups[movement.mirror_id].append(movement)

    # all_internal_seqs is a list of movement sequences that
    # constitute internal movements.
    # [[movement]]
    all_internal_seqs = []

    for mirror_id, group in groups.items():
        if len(group) < 2:
            # No hill or valley is possible.
            continue

        # Order the movements in the group.
        group.sort(key=lambda movement: movement.number)

        internal_seqs = find_internal_movements_for_mirror(
            group=group,
            done_movement_ids=done_movement_ids)
        if internal_seqs:
            all_internal_seqs.extend(internal_seqs)

    return all_internal_seqs


non_internal_actions = frozenset(('move',))


def find_internal_movements_for_mirror(group, done_movement_ids):
    # Note: group must be ordered.
    # internal_seqs: [[movement]]
    internal_seqs = []

    # hill_starts and valley_starts contain the candidate starts of
    # a hill or valley. They map an original amount to the
    # index in the groups list when the change happened.
    hill_starts = {}    # {original amount: group index}
    valley_starts = {}  # {original amount: group index}

    # hill_ends and valley_ends list the candidate ends of a balanced
    # hill or valley.
    hill_ends = []      # [(group index, new amount)]
    valley_ends = []    # [(group index, new amount)]

    # trend contains the current direction of movement: +1, -1, or 0
    # (where 0 means the trend has not yet been determined).
    trend = 0

    # prev_amount is the amount at the previous index.
    prev_amount = zero

    # min_start contains the first eligible start index of the next
    # hill or valley. It ensures hills and valleys can't overlap.
    min_start = [0]

    # find_hill() looks backward in hill_ends for a hill_start
    # value that matches. It finds the largest hill, if any,
    # and adds it to internal_seqs. find_valley() operates similarly.

    def find_hill():
        for end_index, amount in reversed(hill_ends):
            start_index = hill_starts.get(amount)
            if start_index is not None and start_index >= min_start[0]:
                # Found a hill!
                end_index_1 = end_index + 1
                mv_list = group[start_index:end_index_1]
                internal_seqs.append(mv_list)
                min_start[0] = end_index_1
                return

    def find_valley():
        for end_index, amount in reversed(valley_ends):
            start_index = valley_starts.get(amount)
            if start_index is not None and start_index >= min_start[0]:
                # Found a valley!
                end_index_1 = end_index + 1
                mv_list = group[start_index:end_index_1]
                internal_seqs.append(mv_list)
                min_start[0] = end_index_1
                return

    for index, movement in enumerate(group):
        delta = movement.delta
        new_amount = prev_amount + delta

        if (movement.id in done_movement_ids or
                movement.action in non_internal_actions):
            # This movement is already reconciled or internal,
            # so don't detect any hill or valley that crosses it,
            # but detect hills or valleys before or after.
            if trend == 1:
                # The trend was positive (or 0),
                # so there might be a valley.
                find_valley()
            elif trend == -1:
                # The trend was negative (or 0),
                # so there might be a hill.
                find_hill()
            hill_starts.clear()
            del hill_ends[:]
            valley_starts.clear()
            del valley_ends[:]
            trend = 0

        if delta > zero:
            if trend != 1:
                # The trend was negative (or 0),
                # so there might be a hill.
                find_hill()
                # Start looking for another hill.
                hill_starts.clear()
                del hill_ends[:]
                # The trend is now positive.
                trend = 1
            # This movement could be the end of a valley.
            if valley_starts:
                valley_ends.append((index, new_amount))
            # This movement could be the start of a hill.
            hill_starts[prev_amount] = index

        elif delta < zero:
            if trend != -1:
                # The trend was positive (or 0),
                # so there might be a valley.
                find_valley()
                # Start looking for another valley.
                valley_starts.clear()
                del valley_ends[:]
                # The trend is now negative.
                trend = -1
            # This movement could be the end of a hill.
            if hill_starts:
                hill_ends.append((index, new_amount))
            # This movement could be the start of a valley.
            valley_starts[prev_amount] = index

        prev_amount = new_amount

    # Find any remaining hill or valley.
    if trend > 0:
        find_valley()
    elif trend < 0:
        find_hill()

    return internal_seqs
