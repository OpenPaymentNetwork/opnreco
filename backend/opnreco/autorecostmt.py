
from opnreco.models.db import AccountEntry
from opnreco.models.db import Movement
from opnreco.models.db import Reco
from opnreco.models.db import TransferRecord
from opnreco.viewcommon import get_tzname
from sqlalchemy import and_
from sqlalchemy import func
import collections
import datetime

null = None
max_autoreco_delay = datetime.timedelta(days=7)


class SortableMatch:
    """A potential reconciliation match.

    Matches an account entry with an OPN movement. Scores the probability
    of a match. Provides a corresponding sort_key.
    """
    def __init__(self, row):
        self.delta = row.delta
        self.account_entry_id = account_entry_id = row.account_entry_id
        self.entry_date = entry_date = row.entry_date
        self.description = description = row.description
        self.movement_id = movement_id = row.movement_id
        self.movement_date = movement_date = row.movement_date
        self.transfer_id = transfer_id = row.transfer_id

        score = 0

        if transfer_id:
            clean_desc = description.replace('-', '')
            # Count how many characters of the transfer ID are found
            # in the description. Require at least 3 characters to improve
            # the score.
            maxlen = min(len(transfer_id), len(clean_desc))
            for length in range(maxlen, 2, -1):
                if transfer_id[:length] in clean_desc:
                    # This scoring function seems reasonable for
                    # matching 11 digit transfer IDs.
                    score += 1.5 ** length
                    break

        # The closer in time, the higher the score.
        score -= abs((entry_date - movement_date).days)

        self.score = score

        self.sort_key = (score, entry_date, account_entry_id, movement_id)


def auto_reco_statement(dbsession, owner, period, statement):
    """Add external reconciliations automatically for a statement."""

    movement_date_c = func.date(func.timezone(
        get_tzname(owner),
        func.timezone('UTC', Movement.ts)
    ))
    movement_delta = -(Movement.wallet_delta + Movement.vault_delta)

    # Build all_matches, a list of all possible reconciliations
    # of this statement with existing OPN movements.
    # This query is an intentional but filtered cartesian join between
    # the movement and account_entry tables.

    all_matches = (
        dbsession.query(
            AccountEntry.delta,
            AccountEntry.id.label('account_entry_id'),
            AccountEntry.entry_date,
            AccountEntry.description,
            Movement.id.label('movement_id'),
            movement_date_c.label('movement_date'),
            TransferRecord.transfer_id,
        )
        .join(Movement, and_(
            movement_delta == AccountEntry.delta,
            Movement.peer_id == AccountEntry.peer_id,
            Movement.loop_id == AccountEntry.loop_id,
            Movement.currency == AccountEntry.currency,
        ))
        .join(TransferRecord, TransferRecord.id == Movement.transfer_record_id)
        .filter(
            AccountEntry.owner_id == owner.id,
            AccountEntry.statement_id == statement.id,
            AccountEntry.reco_id == null,
            AccountEntry.delta != 0,
            Movement.owner_id == owner.id,
            Movement.period_id == period.id,
            Movement.reco_id == null,
        )
        .all())

    # Group the matches by amount in the 'by_amount' map.
    # by_amount: {amount: [SortableMatch]}
    by_amount = collections.defaultdict(list)

    for match in all_matches:
        if match.entry_date < match.movement_date:
            # The account entry happened before the movement, so
            # disqualify this match for autoreco.
            continue

        if match.entry_date > match.movement_date + max_autoreco_delay:
            # The account entry happened a long time after the
            # movement, so disqualify this match for autoreco.
            continue

        by_amount[match.delta].append(SortableMatch(match))

    # For each group of possible matches in by_amount, apply the best
    # matches first. As matches are chosen, later matches are disqualified
    # automatically because the movement_id has been added to the
    # movement_recos dict or the account_entry_id has been added to
    # the entry_recos dict.

    # Note: to minimize the number of database interactions, we create
    # all the recos at once and update the movements and account entries
    # afterward. This unfortunately leads to the need for the reco_index
    # concept (which is an index in the new_recos list) as opposed to
    # reco_id, since the reco_id is chosen later.
    # Fortunately, the reco_index does not live beyond this function.

    def sort_match(sortable_match):
        return sortable_match.sort_key

    new_reco_count = 0   # The number of Recos to create
    entry_recos = {}     # account_entry_id: reco_index
    movement_recos = {}  # movement_id: reco_index

    for match_list in by_amount.values():
        match_list.sort(key=sort_match, reverse=True)
        for match in match_list:
            if match.movement_id in movement_recos:
                # Already matched.
                continue
            if match.account_entry_id in entry_recos:
                # Already matched.
                continue
            reco_index = new_reco_count
            new_reco_count = reco_index + 1
            movement_recos[match.movement_id] = reco_index
            entry_recos[match.account_entry_id] = reco_index

    if not new_reco_count:
        return

    # Create a reco for each of the new matches.
    new_recos = []
    for i in range(new_reco_count):
        reco = Reco(
            owner_id=owner.id,
            period_id=period.id,
            reco_type='standard',
            internal=False,
        )
        dbsession.add(reco)
        new_recos.append(reco)

    # Assign the reco IDs.
    dbsession.flush()

    # Get the movements and assign their reco_ids.
    movements = (
        dbsession.query(Movement)
        .filter(Movement.id.in_(movement_recos.keys()))
        .all())
    for movement in movements:
        reco = new_recos[movement_recos[movement.id]]
        movement.reco_id = reco.id
        movement.period_id = period.id
    dbsession.flush()

    # Get the account entries and assign their reco_ids.
    entries = (
        dbsession.query(AccountEntry)
        .filter(AccountEntry.id.in_(entry_recos.keys()))
        .all())
    for entry in entries:
        reco = new_recos[entry_recos[entry.id]]
        entry.reco_id = reco.id
        entry.period_id = period.id
    dbsession.flush()
