"""
Functions for reassigning batches of recos, movements, and account entries
to other open periods.
"""

import datetime

from opnreco.models.db import AccountEntry, FileMovement, OwnerLog, Period, Reco
from opnreco.viewcommon import add_open_period, get_period_for_day, get_tzname
from sqlalchemy import (
    BigInteger,
    Date,
    and_,
    cast,
    exists,
    func,
    literal,
    select,
    union_all,
)

null = None


class MovementReassignOp:
    """Operation config for (push|pull)_unreco to reassign movements."""

    def __init__(self, owner):
        self.table = FileMovement
        self.date_c = func.date(
            func.timezone(get_tzname(owner), func.timezone("UTC", FileMovement.ts))
        )
        self.id_c = FileMovement.movement_id
        self.plural = "movements"


class AccountEntryReassignOp:
    """Operation config for (push|pull)_unreco to reassign account entries."""

    def __init__(self):
        self.table = AccountEntry
        self.date_c = AccountEntry.entry_date
        self.id_c = AccountEntry.id
        self.plural = "account_entries"


def make_day_period_cte(days, period_list, default_endless=True):
    """Create a CTE (common table expr) that maps a date to a period ID.

    Provide a list of days to include in the CTE and the candidate periods.

    Return a tuple:
    - day_periods: [(day, period_id)]
    - day_period_cte
    - missing_periods, a boolean that is true when some of the days
      don't map to any period.
    """
    # Choose a period for the movements, entries, or recos on a given date.
    day_periods: list[tuple[datetime.date, int]] = []  # [(date, period_id)]
    missing_period = False
    for day in days:
        period = get_period_for_day(period_list, day, default_endless=default_endless)
        if period is None:
            missing_period = True
        else:
            day_periods.append((day, period.id))  # type: ignore

    if day_periods:
        # Turn day_periods into day_period_cte, a common table expression
        # that contains a simple mapping of date to period ID.
        # See: https://stackoverflow.com/questions/44140632

        # Optimization to reduce the size of the statement:
        # Type cast only for first row;
        # for other rows the database will infer.
        stmts = [
            select(
                cast(literal(d), Date).label("day"),
                cast(literal(pid), BigInteger).label("period_id"),
            )
            for (d, pid) in day_periods[:1]
        ]
        stmts.extend(select(literal(d), literal(pid)) for (d, pid) in day_periods[1:])
        day_period_cte = union_all(*stmts).cte(name="day_period_cte")

    else:
        # There are no periods for any of the days.
        # Use a table with zero rows as day_period_cte.
        day_period_cte = (
            select(
                cast(literal(None), Date).label("day"),
                cast(literal(None), BigInteger).label("period_id"),
            )
            .where(literal(1) == literal(0))
            .cte(name="day_period_cte")
        )

    return day_periods, day_period_cte, missing_period


def push_unreco(request, period, op):
    """Push the unreconciled movements or entries to other open periods.

    Create a new period if necessary.
    """
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    assert period.owner_id == owner_id

    item_filter = and_(
        op.table.owner_id == owner_id,
        op.table.file_id == period.file_id,
        op.table.period_id == period.id,
        op.table.reco_id == null,
    )

    # List the dates of all items in the period.
    unreco_query = dbsession.query(
        op.date_c.label("day"),
        op.id_c.label("item_id"),
    ).filter(item_filter)
    unreco_rows = unreco_query.all()

    if not unreco_rows:
        # There are no unreconciled items in the period.
        return 0

    # List the other open periods for the file.
    period_list = (
        dbsession.query(Period)
        .filter(
            Period.owner_id == owner_id,
            Period.file_id == period.file_id,
            ~Period.closed,
            Period.id != period.id,
        )
        .all()
    )

    # List the items to reassign.
    days = set()
    item_ids = []
    for day, item_id in unreco_rows:
        days.add(day)
        if item_id is not None:
            item_ids.append(item_id)

    # Map the days to periods.
    day_periods, day_period_cte, missing_period = make_day_period_cte(
        days=sorted(days), period_list=period_list
    )

    # If no period is available for some of the items,
    # create a new period.
    if missing_period:
        new_period = add_open_period(
            request=request,
            file_id=period.file_id,
            event_type="add_period_for_push_unreco_%s" % op.plural,
        )
        new_period_id = new_period.id
    else:
        new_period_id = None

    # Reassign the items.
    subq = (
        dbsession.query(day_period_cte.c.period_id)
        .filter(day_period_cte.c.day == op.date_c)
        .as_scalar()
    )
    (
        dbsession.query(op.table)
        .filter(item_filter)
        .update(
            {"period_id": func.coalesce(subq, new_period_id)},
            synchronize_session="fetch",
        )
    )

    dbsession.add(
        OwnerLog(
            owner_id=owner_id,
            personal_id=request.personal_id,
            event_type="push_unreco_%s" % op.plural,
            content={
                "period_id": period.id,
                "file_id": period.file_id,
                "item_ids": item_ids,
                "day_periods": day_periods,
                "new_period_id": new_period_id,
            },
        )
    )

    return len(item_ids)


def pull_unreco(request, period, op):
    """Pull unreconciled items from other open periods into this period."""
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    assert period.owner_id == owner_id

    item_filter = and_(
        op.table.owner_id == owner_id,
        op.table.file_id == period.file_id,
        op.table.period_id != period.id,
        op.table.reco_id == null,
        ~Period.closed,
    )

    # List the dates of all unreconciled items in other open periods
    # for the same peer loop.
    day_rows = (
        dbsession.query(op.date_c)
        .join(Period, Period.id == op.table.period_id)
        .filter(item_filter)
        .distinct()
        .all()
    )

    if not day_rows:
        # There are no items to pull in.
        return 0

    # List the dates of the items to pull in.
    reassign_days = []
    period_list = [period]
    for (day,) in day_rows:
        if get_period_for_day(period_list, day, default_endless=False) is period:
            reassign_days.append(day)

    if not reassign_days:
        # None of the items found should be pulled in to this period.
        return 0

    # Map the reassignable items to this period.
    day_periods, day_period_cte, missing_period = make_day_period_cte(
        days=sorted(reassign_days), period_list=period_list, default_endless=False
    )

    # Make a subquery that lists the items to reassign.
    ids_query = (
        select(op.id_c)
        .select_from(
            op.table.__table__.join(Period, Period.id == op.table.period_id).join(
                day_period_cte, day_period_cte.c.day == op.date_c
            )
        )
        .where(item_filter)
    )

    item_ids = [item_id for (item_id,) in dbsession.execute(ids_query)]

    # Reassign items.
    (
        dbsession.query(op.table)
        .filter(
            op.id_c.in_(ids_query),
            op.table.file_id == period.file_id,
        )
        .update({"period_id": period.id}, synchronize_session="fetch")
    )

    dbsession.add(
        OwnerLog(
            owner_id=owner_id,
            personal_id=request.personal_id,
            event_type="pull_unreco_%s" % op.plural,
            content={
                "period_id": period.id,
                "file_id": period.file_id,
                "item_ids": item_ids,
                "day_periods": day_periods,
            },
        )
    )

    return len(item_ids)


def pull_recos(request, period):
    """Pull recos from other open periods into this period."""
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    assert period.owner_id == owner_id

    # reco_filter finds the recos that might need to be pulled.
    reco_filter = and_(
        Reco.owner_id == owner_id,
        Reco.period_id != period.id,
        Period.file_id == period.file_id,
        ~Period.closed,
    )

    entry_date_c = (
        dbsession.query(func.min(AccountEntry.entry_date))
        .filter(AccountEntry.reco_id == Reco.id)
        .correlate(Reco)
        .as_scalar()
    )

    movement_date_c = (
        dbsession.query(
            func.date(
                func.timezone(
                    get_tzname(owner), func.timezone("UTC", func.min(FileMovement.ts))
                )
            )
        )
        .filter(FileMovement.reco_id == Reco.id)
        .correlate(Reco)
        .as_scalar()
    )

    # reco_date_c provides the date of each reco. Note that
    # some recos have no account entries or movements; they have a date
    # of None. We don't want to move those recos into this period.
    reco_date_c = func.coalesce(entry_date_c, movement_date_c)

    # List the dates of all recos in other open periods
    # for the same peer loop.
    day_rows = (
        dbsession.query(reco_date_c)
        .select_from(Reco)
        .join(Period, Period.id == Reco.period_id)
        .filter(reco_filter)
        .distinct()
        .all()
    )

    if not day_rows:
        # There are no recos to pull in.
        return 0

    # List the dates of the recos to pull in.
    reassign_days = []
    period_list = [period]
    for (day,) in day_rows:
        if (
            day is not None
            and get_period_for_day(period_list, day, default_endless=False) is period
        ):
            reassign_days.append(day)

    if not reassign_days:
        # None of the recos found should be pulled in to this period.
        return 0

    # Map the reassignable recos to this period.
    # (Recos for other periods will not be listed in day_period_cte.)
    day_periods, day_period_cte, missing_period = make_day_period_cte(
        days=sorted(reassign_days), period_list=period_list, default_endless=False
    )

    # List the recos to reassign.
    reco_id_rows = (
        dbsession.query(Reco.id)
        .join(Period, Period.id == Reco.period_id)
        .join(day_period_cte, day_period_cte.c.day == reco_date_c)
        .filter(reco_filter)
        .all()
    )

    reco_ids = [reco_id for (reco_id,) in reco_id_rows]

    # Reassign recos.
    (
        dbsession.query(Reco)
        .filter(Reco.id.in_(reco_ids))
        .update({"period_id": period.id}, synchronize_session="fetch")
    )

    # Reassign the period_id of affected movements.
    (
        dbsession.query(FileMovement)
        .filter(FileMovement.reco_id.in_(reco_ids))
        .update({"period_id": period.id}, synchronize_session="fetch")
    )

    # Reassign the period_id of affected account entries.
    (
        dbsession.query(AccountEntry)
        .filter(AccountEntry.reco_id.in_(reco_ids))
        .update({"period_id": period.id}, synchronize_session="fetch")
    )

    dbsession.add(
        OwnerLog(
            owner_id=owner_id,
            personal_id=request.personal_id,
            event_type="pull_recos",
            content={
                "period_id": period.id,
                "file_id": period.file_id,
                "reco_ids": reco_ids,
                "day_periods": day_periods,
            },
        )
    )

    return len(reco_ids)


def push_recos(request, period):
    """Push all the recos in a period to other open periods.

    Create a new period if necessary.

    This is done in preparation for deleting the period.
    """
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    assert period.owner_id == owner_id

    entry_date_c = (
        dbsession.query(func.min(AccountEntry.entry_date))
        .filter(AccountEntry.reco_id == Reco.id)
        .correlate(Reco)
        .as_scalar()
    )

    movement_date_c = (
        dbsession.query(
            func.date(
                func.timezone(
                    get_tzname(owner), func.timezone("UTC", func.min(FileMovement.ts))
                )
            )
        )
        .select_from(FileMovement)
        .filter(FileMovement.reco_id == Reco.id)
        .correlate(Reco)
        .as_scalar()
    )

    future = datetime.date.today() + datetime.timedelta(days=366 * 100)

    # reco_date_c provides the date of each reco.
    # Recos with no entries or movements have no date, so fall back to
    # an arbitrary date 100+ years in the future as the reco date.
    # The arbitrary date does not get stored (unless the user has created
    # a period for 100+ years in the future.)
    reco_date_c = func.coalesce(entry_date_c, movement_date_c, future)

    # List the dates of all recos in this period.
    reco_rows = (
        dbsession.query(reco_date_c, Reco.id)
        .select_from(Reco)
        .filter(Reco.period_id == period.id)
        .all()
    )

    if not reco_rows:
        # There are no reconciliations in the period.
        return 0

    # List the other open periods for the peer.
    period_list = (
        dbsession.query(Period)
        .filter(
            Period.owner_id == owner_id,
            Period.file_id == period.file_id,
            ~Period.closed,
            Period.id != period.id,
        )
        .all()
    )

    # List the recos to reassign.
    days = set()
    reco_ids = []
    for day, reco_id in reco_rows:
        days.add(day)
        if reco_id is not None:
            reco_ids.append(reco_id)

    # Map the days to periods.
    day_periods, day_period_cte, missing_period = make_day_period_cte(
        days=sorted(days), period_list=period_list
    )

    # If no period is available for some of the recos,
    # create a new period.
    if missing_period:
        new_period = add_open_period(
            request=request,
            file_id=period.file_id,
            event_type="add_period_for_push_reco",
            has_vault=period.has_vault,
        )
        new_period_id = new_period.id
    else:
        new_period_id = None

    # Reassign the recos.
    subq = (
        dbsession.query(day_period_cte.c.period_id)
        .filter(day_period_cte.c.day == reco_date_c)
        .as_scalar()
    )
    (
        dbsession.query(Reco)
        .filter(Reco.id.in_(reco_ids))
        .update(
            {"period_id": func.coalesce(subq, new_period_id)},
            synchronize_session="fetch",
        )
    )

    # Reassign the period_id of affected movements.
    subq = (
        dbsession.query(Reco.period_id)
        .filter(Reco.id == FileMovement.reco_id)
        .as_scalar()
    )
    (
        dbsession.query(FileMovement)
        .filter(FileMovement.reco_id.in_(reco_ids))
        .update({"period_id": subq}, synchronize_session="fetch")
    )

    # Reassign the period_id of affected account entries.
    subq = (
        dbsession.query(Reco.period_id)
        .filter(Reco.id == AccountEntry.reco_id)
        .as_scalar()
    )
    (
        dbsession.query(AccountEntry)
        .filter(AccountEntry.reco_id.in_(reco_ids))
        .update({"period_id": subq}, synchronize_session="fetch")
    )

    dbsession.add(
        OwnerLog(
            owner_id=owner_id,
            personal_id=request.personal_id,
            event_type="push_recos",
            content={
                "period_id": period.id,
                "file_id": period.file_id,
                "reco_ids": reco_ids,
                "day_periods": day_periods,
                "new_period_id": new_period_id,
            },
        )
    )

    return len(reco_ids)


def reassign_statement_period(dbsession, statement, old_period_id, new_period_id):
    """Reassign the account entries and recos in a statement to a new period."""
    # is_in_statement tests whether a reco is tied to a statement.
    is_in_statement = exists(
        select(AccountEntry.id).where(
            and_(
                AccountEntry.reco_id == Reco.id,
                AccountEntry.statement_id == statement.id,
            )
        )
    )

    move_reco_ids = select(Reco.id).where(
        and_(
            Reco.period_id == old_period_id,
            is_in_statement,
        )
    )

    # Reassign movements first because movement.period_id is not used
    # in move_reco_ids.
    (
        dbsession.query(FileMovement)
        .filter(FileMovement.reco_id.in_(move_reco_ids))
        .update({"period_id": new_period_id}, synchronize_session="fetch")
    )

    # Reassign the recos. This changes the results of the move_reco_ids
    # subquery.
    (
        dbsession.query(Reco)
        .filter(Reco.id.in_(move_reco_ids))
        .update({"period_id": new_period_id}, synchronize_session="fetch")
    )

    # Reassign the account entries.
    (
        dbsession.query(AccountEntry)
        .filter(
            AccountEntry.statement_id == statement.id,
            AccountEntry.period_id == old_period_id,
        )
        .update({"period_id": new_period_id}, synchronize_session="fetch")
    )
