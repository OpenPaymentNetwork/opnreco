
from opnreco.models.db import AccountEntry
from opnreco.models.db import Movement
from opnreco.models.db import Reco
from opnreco.models.db import TransferRecord
from sqlalchemy import and_
from sqlalchemy import func
import collections
import datetime

null = None
max_autoreco_delay = datetime.timedelta(days=7)


def get_tzname(owner):
    return owner.tzname or 'America/New_York'


def auto_reco_statement(dbsession, owner, period, statement):
    """Add external reconciliations automatically for a statement."""

    dbsession.query(func.set_config(
        'opnreco.movement.event_type', 'statement_auto_reco', True)).all()
    dbsession.query(func.set_config(
        'opnreco.account_entry.event_type', 'statement_auto_reco', True)).all()

    movement_date_c = func.date(func.timezone(
        get_tzname(owner),
        func.timezone('UTC', Movement.ts)
    ))
    movement_delta = -(Movement.wallet_delta + Movement.vault_delta)

    # Build all_matches, a list of all possible reconciliations
    # of this statement with existing OPN movements.
    # This is an intentional cartesian join.

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
    # by_amount: {amount: [match]}
    by_amount = collections.defaultdict(list)

    for match in all_matches:
        if match.entry_date < match.movement_date:
            # The account entry happened before the movement, so
            # disqualify this match for autoreco.
            continue

        if match.entry_date > match.movement_date + max_autoreco_delay:
            # The account entry happened more than a week after the
            # movement, so disqualify this match for autoreco.
            continue

        by_amount[match.delta].append(match)

    def rank_match(match):
        """Sort key function that ranks the best matches highest."""
        if match.transfer_id in match.description.replace('-', ''):
            # The transfer ID is in the description, so rank the match highly.
            score = 100
        else:
            score = 0

        # The closer in time, the higher the score.
        score -= abs((match.entry_date - match.movement_date).days)

        return (
            score, match.entry_date, match.account_entry_id, match.movement_id)

    # For each group of possible matches in by_amount, apply the best
    # matches first. As matches are chosen, later matches are disqualified
    # automatically because the movement_id has been added to the
    # movement_recos dict or the account_entry_id has been added to
    # the entry_recos dict.

    # Note: to minimize the number of database interactions, we create
    # all the recos at once and update the movements and account entries
    # afterward. This unfortunately leads to the need for reco_index
    # as opposed to reco_id, since the reco_id is chosen later.
    # Fortunately, the reco_index does not extend beyond this function.

    new_reco_count = 0   # The number of Recos to create
    entry_recos = {}     # account_entry_id: reco_index
    movement_recos = {}  # movement_id: reco_index

    for match_list in by_amount.values():
        match_list.sort(key=rank_match, reverse=True)
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

    if new_reco_count:

        # Create enough recos for all of the new matches.
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
