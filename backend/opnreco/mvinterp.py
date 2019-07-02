
from decimal import Decimal
from opnreco.models.db import FileMovement
from opnreco.models.db import FileLoopConfig
from opnreco.models.db import OwnerLog
from opnreco.models.db import Period
from opnreco.models.db import Reco
from opnreco.viewcommon import add_open_period
from opnreco.viewcommon import configure_dblog
from opnreco.viewcommon import get_period_for_day
from pyramid.decorator import reify
import collections
import logging
import pytz

log = logging.getLogger(__name__)
zero = Decimal()
null = None


class VerificationFailure(Exception):
    """A transfer failed verification"""

    def __init__(self, msg, transfer_id):
        Exception.__init__(self, msg)
        self.transfer_id = transfer_id


class MovementInterpreter:
    """Interpret Movements for a file, creating FileMovements.

    Also auto-reconcile within transfers.
    """
    def __init__(self, request, file, change_log):
        self.request = request
        self.file = file
        self.owner_id = file.owner_id
        self.change_log = change_log

        # open_periods: {date: open Period}
        self.open_periods = {}

    @reify
    def timezone(self):
        """Get the pytz time zone for the owner.

        Default to the America/New_York time zone.
        """
        try:
            return pytz.timezone(self.owner.tzname or 'America/New_York')
        except Exception:
            return pytz.timezone('America/New_York')

    @reify
    def open_period_list(self):
        """Get the list of open Periods for the File."""
        return (
            self.request.dbsession.query(Period)
            .filter(
                Period.owner_id == self.owner_id,
                Period.file_id == self.file.id,
                ~Period.closed)
            .order_by(Period.id)
            .all())

    @reify
    def open_period_ids(self):
        """Get the set of open Period IDs for the File."""
        return set(period.id for period in self.open_period_list)

    @reify
    def loops_enabled(self):
        """Get {(loop_id, issuer_id): enabled}."""
        rows = (
            self.request.dbsession.query(FileLoopConfig)
            .filter(
                FileLoopConfig.owner_id == self.owner_id,
                FileLoopConfig.file_id == self.file.id,
            )
            .all())
        return {
            (row.loop_id, row.file_id): row.enabled
            for row in rows}

    def include_closed_loop(self, loop_id, issuer_id):
        """Return true if movements for the given loop_id + issuer_id combo
        should be reconciled in this file."""
        enabled = self.loops_enabled.get((loop_id, issuer_id))
        if enabled is not None:
            return enabled
        # Add a FileLoopConfig for a newly discovered
        # loop_id + issuer_id combo. Enable it if auto_enable_loops is true.
        enabled = self.file.auto_enable_loops
        row = FileLoopConfig(
            owner_id=self.owner_id,
            file_id=self.file.id,
            loop_id=loop_id,
            issuer_id=issuer_id,
            enabled=enabled)
        dbsession = self.request.dbsession
        dbsession.add(row)
        dbsession.flush()
        self.loops_enabled[(loop_id, issuer_id)] = enabled

        dbsession.add(OwnerLog(
            owner_id=self.owner_id,
            personal_id=self.request.personal_id,
            event_type='add_file_loop_config',
            content={
                'file_id': self.file.id,
                'loop_id': loop_id,
                'issuer_id': issuer_id,
                'enabled': enabled,
            }))

        return enabled

    def sync_file_movements(self, record, movements, is_new_record):
        """Add the FileMovements for the movements in a TransferRecord.

        Also auto-reconcile if at least 2 movements fit the File.
        """
        dbsession = self.request.dbsession

        file_movements = {}  # {movement_id: FileMovement}
        if is_new_record:
            file_movements = {}
        else:
            movement_ids = [movement.id for movement in movements]
            rows = (
                dbsession.query(FileMovement)
                .filter(
                    FileMovement.owner_id == self.owner_id,
                    FileMovement.file_id == self.file.id,
                    FileMovement.movement_id.in_(movement_ids),
                ).all())
            for file_movement in rows:
                file_movements[file_movement.movement_id] = file_movement

        to_reconcile = []  # [(file_movement, movement)]

        configured_logging = []

        def configure_logging():
            if not configured_logging:
                configure_dblog(
                    request=self.request,
                    movement_event_type='sync_file_movements')
                configured_logging.append(True)

        for movement in movements:
            file_movement = file_movements.get(movement.id)
            kw = self.interpret(movement)
            if kw and file_movement is None:
                # Add a file movement.
                configure_logging()

                day = movement.ts.replace(tzinfo=pytz.utc).astimezone(
                    self.timezone).date()
                period = self.get_open_period(day=day)

                file_movement = FileMovement(
                    owner_id=self.owner_id,
                    movement_id=movement.id,
                    file_id=self.file.id,
                    period_id=period.id,
                    **kw)
                dbsession.add(file_movement)

            elif (not kw and
                    file_movement is not None and
                    file_movement.reco_id is None and
                    file_movement.period_id in self.open_period_ids):
                # This movement no longer applies to the file
                # and the file movement is safe to delete, so delete it.
                configure_logging()
                dbsession.delete(file_movement, synchronize_session=True)
                file_movement = None

            elif (kw and
                    file_movement is not None and
                    file_movement.reco_id is None and
                    file_movement.period_id in self.open_period_ids):
                # Update the file movement if needed.
                if file_movement.peer_id != kw['peer_id']:
                    configure_logging()
                    file_movement.peer_id = kw['peer_id']
                if file_movement.wallet_delta != kw['wallet_delta']:
                    configure_logging()
                    file_movement.wallet_delta = kw['wallet_delta']
                    file_movement.surplus_delta = kw['surplus_delta']
                if file_movement.vault_delta != kw['vault_delta']:
                    configure_logging()
                    file_movement.vault_delta = kw['vault_delta']

            if file_movement is not None:
                to_reconcile.append((file_movement, movement))

        if len(to_reconcile) >= 2:
            # Auto-reconciliation within the transfer might be possible.
            configure_dblog(
                request=self.request, movement_event_type='autoreco')
            self.autoreco(
                record=record,
                movement_rows=to_reconcile,
                is_new_record=is_new_record)

    def interpret(self, movement):
        """Compute the FileMovement attrs for a Movement in this File.

        Return None if this movement has no effect on the reconciliation
        in this File.
        """
        from_id = movement.from_id
        if not from_id:
            # Issuance movement.
            return None

        file = self.file
        currency = movement.currency
        if currency != file.currency:
            # This movement is not applicable to this file.
            return None

        to_id = movement.to_id
        issuer_id = movement.issuer_id
        file_type = file.file_type
        owner_id = self.owner_id
        loop_id = movement.loop_id
        amount = movement.amount
        wallet_delta = zero
        vault_delta = zero

        if file_type == 'open_circ':
            # The file owner is an issuer of open loop notes.
            # This file reconciles an account with the circulation of
            # open loop notes issued by this issuer.
            if loop_id == '0':
                if from_id == owner_id and to_id != owner_id:
                    peer_id = to_id
                    if from_id == issuer_id:
                        # Notes were put into circulation.
                        vault_delta = -amount
                    else:
                        # Notes were sent to an account or other wallet.
                        wallet_delta = -amount
                elif to_id == owner_id and from_id != owner_id:
                    peer_id = from_id
                    if to_id == issuer_id:
                        # Notes were taken out of circulation.
                        vault_delta = amount
                    else:
                        # Notes were received from an account or other wallet.
                        wallet_delta = amount

        elif file_type == 'account':
            # The file owner has a linked account.
            # This file reconciles an account with the movement of notes
            # between the owner's wallet and the account.
            peer_id = file.peer_id
            if from_id == owner_id and to_id == peer_id:
                # Notes were sent to the account.
                wallet_delta = -amount
            elif from_id == peer_id and to_id == owner_id:
                # Notes were received from the account.
                wallet_delta = amount

        elif file_type == 'closed_circ':
            # The file owner is a distributor of closed loop notes.
            # This file reconciles an account with the distribution and
            # redemption of closed loop notes.
            if loop_id != '0':
                # Reconcile movement of specific closed loops
                # as vault movements.
                if self.include_closed_loop(loop_id, issuer_id):
                    if from_id == issuer_id and to_id != issuer_id:
                        peer_id = to_id
                        # Notes were put into circulation.
                        vault_delta = -amount
                    elif to_id == issuer_id and from_id != issuer_id:
                        peer_id = from_id
                        # Notes were taken out of circulation.
                        vault_delta = amount
            else:
                # Reconcile all movement of open loop notes to/from the
                # owner as wallet movements.
                if from_id == owner_id and to_id != owner_id:
                    # The owner sent open loop notes from the wallet.
                    peer_id = to_id
                    wallet_delta = -amount
                elif to_id == owner_id and from_id != owner_id:
                    # The owner receoved open loop notes into the wallet.
                    peer_id = from_id
                    wallet_delta = amount

        if not vault_delta and not wallet_delta:
            # This movement should not be reconciled in this file.
            return None

        return {
            'currency': currency,
            'loop_id': loop_id,
            'issuer_id': issuer_id,
            'transfer_record_id': movement.transfer_record_id,
            'ts': movement.ts,
            'peer_id': peer_id,
            'wallet_delta': wallet_delta,
            'vault_delta': vault_delta,
            'surplus_delta': -wallet_delta,
        }

    def get_open_period(self, day):
        """Get an open Period for a movement_date.
        """
        period = self.open_periods.get(day)
        if period is not None:
            return period

        open_period_list = self.open_period_list

        # See if any of the existing periods match.
        period = get_period_for_day(open_period_list, day)
        if period is not None:
            # Found a matching open period.
            self.periods[day] = period
            return period

        # Create a new open period.
        period = add_open_period(
            request=self.request,
            file_id=self.file.id,
            event_type='add_period_for_sync')

        self.open_period_list.append(period)
        self.open_periods[day] = period
        self.open_period_ids.add(period.id)
        self.change_log.append({
            'event_type': 'add_period',
            'period_id': period.id,
        })

        return period

    def autoreco(self, record, movement_rows, is_new_record):
        """Auto-reconcile some of the movements in a File + TransferRecord.
        """
        dbsession = self.request.dbsession

        if is_new_record:
            # No recos exist yet for this TransferRecord.
            reco_rows = ()
            done_movement_ids = set()
        else:
            # List the existing reconciled movements.
            reco_rows = (
                dbsession.query(FileMovement.movement_id)
                .filter(
                    FileMovement.file_id == self.file.id,
                    FileMovement.reco_id != null,
                    FileMovement.transfer_record_id == record.id,
                    )
                .all())
            done_movement_ids = set(row[0] for row in reco_rows)

        internal_seqs = find_internal_movements(
            movement_rows=movement_rows,
            done_movement_ids=done_movement_ids)

        added = False

        for mvlist in internal_seqs:
            if len(mvlist) < 2:
                continue

            conflict = False
            wallet_total = zero
            vault_total = zero
            for file_movement, movement in mvlist:
                if movement.id in done_movement_ids:
                    # This auto-reco would conflict with an existing reco.
                    # Don't create this auto-reco.
                    conflict = True
                    break
                wallet_total += file_movement.wallet_delta
                vault_total += file_movement.vault_delta

            if conflict:
                continue

            if wallet_total + vault_total != zero:
                raise AssertionError(
                    "find_internal_movements() returned an unbalanced "
                    "movement list for transfer %s: %s != %s" % (
                        record.transfer_id, wallet_total, -vault_total))

            reco = Reco(
                owner_id=self.owner_id,
                period_id=mvlist[0][0].period_id,
                reco_type='standard',
                internal=True)
            dbsession.add(reco)
            dbsession.flush()
            reco_id = reco.id
            added = True

            for file_movement, movement in mvlist:
                file_movement.reco_id = reco_id

        if added:
            self.change_log.append({
                'event_type': 'reco_add',
                'reco_id': reco_id,
            })
            dbsession.flush()


def find_internal_movements(movement_rows, done_movement_ids):
    """Find internal movements that can be auto-reconciled.

    Return [[(FileMovement, Movement)]].

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

    # Group by peer, loop_id, and currency,
    # filtering out movements that had no effect on the wallet or vault.
    # (Note that we specifically ignore Movement.orig_peer_id
    # because it is not relevant here.)
    # groups: {(peer_id, loop_id, currency): (FileMovement, Movement)}
    groups = collections.defaultdict(list)
    for row in movement_rows:
        file_movement, movement = row
        if file_movement.wallet_delta or file_movement.vault_delta:
            key = (file_movement.peer_id, movement.loop_id, movement.currency)
            groups[key].append(row)

    # all_internal_seqs is a list of movement sequences that
    # constitute internal movements.
    # all_internal_seqs: [[movement]]
    all_internal_seqs = []

    def get_row_sort_key(row):
        file_movement, movement = row
        return (movement.number, movement.amount_index)

    for key, group in groups.items():
        if len(group) < 2:
            # No hill or valley is possible.
            continue

        # Order the movements in the group.
        group.sort(key=get_row_sort_key)
        refine_movement_order(group)

        internal_seqs = find_internal_movements_for_group(
            group=group,
            done_movement_ids=done_movement_ids)
        if internal_seqs:
            all_internal_seqs.extend(internal_seqs)

    return all_internal_seqs


def refine_movement_order(group):
    """Refine the order of migrated movements in a group.

    This works around an issue in migrated movements. Movements
    created by migration (which had a blank action) sometimes had
    an identical timestamp and were added in the wrong order.
    Reorder the movements temporarily for the purpose of
    auto-reconciliation, but don't change the movements.

    The reordering tries to restore the hills or valleys that existed
    in the original sequence.
    """
    by_ts = collections.defaultdict(list)

    for index, row in enumerate(group):
        file_movement, movement = row
        if movement.action:
            # This is the end of the migrated movements for this transfer.
            break
        by_ts[movement.ts].append((index, row))

    if not by_ts:
        # Nothing to reorder.
        return

    for subgroup in by_ts.values():
        if len(subgroup) < 2:
            # Nothing to reorder.
            continue

        # This subgroup is eligible for reordering because all the movements
        # happened at the same time (in the same transaction). Look at the
        # next movement (in the group) after or before to determine whether
        # to form the concurrent movements into a hill or a valley.
        first_index = subgroup[0][0]
        last_index = subgroup[-1][0]
        make_valley = None

        if last_index + 1 < len(group):
            # Detect based on the next movement after the subgroup.
            file_movement, movement = group[last_index + 1]
            delta = file_movement.wallet_delta + file_movement.vault_delta
            if delta < zero:
                make_valley = False
            elif delta > zero:
                make_valley = True

        if make_valley is None and first_index > 0:
            # Detect based on the previous movement before the subgroup.
            file_movement, movement = group[first_index - 1]
            delta = file_movement.wallet_delta + file_movement.vault_delta
            if delta < zero:
                make_valley = True
            elif delta > zero:
                make_valley = False

        if make_valley is not None:
            # Reorder.
            # make_valley specifies whether to form a valley or a hill.

            def sort_key(item):
                index, row = item
                file_movement, movement = row
                delta = file_movement.wallet_delta + file_movement.vault_delta
                if make_valley:
                    forced_order = 0 if delta < zero else 1
                else:
                    forced_order = 0 if delta > zero else 1
                return (forced_order, index)

            new_order = list(subgroup)
            new_order.sort(key=sort_key)

            # Put the movements in the refined order.
            for old_item, new_item in zip(subgroup, new_order):
                index = old_item[0]
                row = new_item[1]
                group[index] = row


non_internal_actions = frozenset(('move',))


def find_internal_movements_for_group(group, done_movement_ids):
    # Note: group must be ordered by number and all movements
    # in the group must be for the same loop_id and currency.
    # internal_seqs: [[(FileMovement, Movement)]]
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

    for index, row in enumerate(group):
        file_movement, movement = row
        delta = file_movement.wallet_delta + file_movement.vault_delta
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
