
from opnreco.models import perms
from opnreco.models.db import AccountEntry
from opnreco.models.db import Movement
from opnreco.models.db import now_func
from opnreco.models.db import OwnerLog
from opnreco.models.db import Period
from opnreco.models.db import Reco
from opnreco.models.db import Statement
from opnreco.models.site import API
from opnreco.models.site import PeriodResource
from opnreco.param import get_offset_limit
from opnreco.param import parse_amount
from opnreco.param import parse_ploop_key
from opnreco.serialize import serialize_period
from opnreco.viewcommon import add_open_period
from opnreco.viewcommon import compute_period_totals
from opnreco.viewcommon import get_loop_map
from opnreco.viewcommon import get_peer_map
from opnreco.viewcommon import get_period_for_day
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import and_
from sqlalchemy import BigInteger
from sqlalchemy import case
from sqlalchemy import cast
from sqlalchemy import Date
from sqlalchemy import func
from sqlalchemy import literal
from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy import union_all
import colander
import datetime
import logging

log = logging.getLogger(__name__)


null = None


@view_config(
    name='period-list',
    context=API,
    permission=perms.use_app,
    renderer='json')
def period_list_api(request):
    """Return a page of periods for a ploop.
    """
    params = request.params
    peer_id, loop_id, currency = parse_ploop_key(params.get('ploop_key'))
    offset, limit = get_offset_limit(params)

    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession

    future = datetime.datetime.utcnow() + datetime.timedelta(days=366 * 100)

    query = (
        dbsession.query(Period)
        .filter(
            Period.owner_id == owner_id,
            Period.peer_id == peer_id,
            Period.loop_id == loop_id,
            Period.currency == currency,
        )
        .order_by(func.coalesce(Period.start_date, future).desc())
    )

    totals_row = (
        dbsession.query(
            func.count(1).label('rowcount'),
        )
        .select_from(query.subquery('subq'))
        .one())

    list_query = query.offset(offset)
    if limit is not None:
        list_query = list_query.limit(limit)
    period_rows = list_query.all()

    all_period_ids = [period.id for period in period_rows]

    statement_rows = (
        dbsession.query(
            Statement.period_id,
            func.count(1).label('count'),
        )
        .filter(
            Statement.owner_id == owner_id,
            Statement.period_id.in_(all_period_ids),
        )
        .group_by(Statement.period_id)
        .all())

    # Compute the end_circ and end_surplus for periods that haven't computed
    # them yet.
    partial_ids = [
        period.id for period in period_rows
        if period.end_circ is None or period.end_surplus is None]
    if partial_ids:
        totals = compute_period_totals(
            dbsession=dbsession,
            owner_id=owner_id,
            period_ids=partial_ids)

        end_amounts_map = {
            period_id: {
                'circ': total['end']['circ'],
                'surplus': total['end']['surplus'],
            } for (period_id, total) in totals.items()}

    else:
        end_amounts_map = {}

    statement_map = {row.period_id: row.count for row in statement_rows}

    periods = []
    for p in period_rows:
        period_id = p.id
        period_state = serialize_period(
            p, end_amounts=end_amounts_map.get(p.id))
        period_state['statement_count'] = statement_map.get(period_id, 0)
        periods.append(period_state)

    return {
        'periods': periods,
        'rowcount': totals_row.rowcount,
    }


@view_config(
    name='state',
    context=PeriodResource,
    permission=perms.view_period,
    renderer='json')
def period_state_api(context, request):
    """Return info about the period, its peer, and its loop."""
    period = context.period

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    period_id = period.id

    totals = compute_period_totals(
        dbsession=dbsession,
        owner_id=owner_id,
        period_ids=[period_id])[period_id]

    now = dbsession.query(now_func).scalar()

    end_amounts = {
        'circ': totals['end']['circ'],
        'surplus': totals['end']['surplus'],
    }

    movement_counts = (
        dbsession.query(
            func.count(
                case([
                    (Reco.id == null, null),
                    (Reco.internal, 1),
                ], else_=null)).label('internal'),
            func.count(
                case([
                    (Reco.id == null, null),
                    (~Reco.internal, 1),
                ], else_=null)).label('external'),
            func.count(
                case([
                    (and_(
                        # Ignore movements not eligible for reconciliation.
                        Movement.vault_delta == 0,
                        Movement.wallet_delta == 0,
                    ), null),
                    (Reco.id == null, 1),
                ], else_=null)).label('unreconciled'),
        )
        .select_from(Movement)
        .outerjoin(Reco, Reco.id == Movement.reco_id)
        .filter(
            Movement.owner_id == owner_id,
            Movement.peer_id == period.peer_id,
            Movement.loop_id == period.loop_id,
            Movement.currency == period.currency,
            Movement.period_id == period_id,
        )
        .one())

    account_entry_counts = (
        dbsession.query(
            func.count(AccountEntry.reco_id).label('reconciled'),
            func.count(1).label('all'),
        )
        .filter(
            AccountEntry.owner_id == owner_id,
            AccountEntry.peer_id == period.peer_id,
            AccountEntry.loop_id == period.loop_id,
            AccountEntry.currency == period.currency,
            AccountEntry.period_id == period_id,
        )
        .one())

    counts = {
        'internal_movements_reconciled': movement_counts.internal,
        'external_movements_reconciled': movement_counts.external,
        'movements_unreconciled': movement_counts.unreconciled,
        'account_entries_reconciled': account_entry_counts.reconciled,
        'account_entries_unreconciled': (
            account_entry_counts.all - account_entry_counts.reconciled),
    }

    peers = get_peer_map(
        request=request, need_peer_ids=set([period.peer_id]), final=True)

    if period.loop_id != '0':
        loops = get_loop_map(
            request=request, need_loop_ids=set([period.loop_id]), final=True)
    else:
        loops = {}

    res = {
        'now': now,
        'period': serialize_period(period, end_amounts=end_amounts),
        'peer': peers[period.peer_id],
        'loop': loops.get(period.loop_id),  # None for loop_id == '0'
        'totals': totals,
        'counts': counts,
    }

    return res


class CurrencyInput(colander.SchemaType):
    def serialize(self, node, appstruct):
        if appstruct is colander.null:
            return colander.null
        return str(appstruct)

    def deserialize(self, node, cstruct):
        if not cstruct:
            return colander.null

        currency = node.bindings['currency']
        value = parse_amount(cstruct, currency)
        if value is None:
            raise colander.Invalid(node, '"%s" is not a number' % cstruct)

        return value


class PeriodSaveSchema(colander.Schema):
    start_date = colander.SchemaNode(colander.Date(), missing=None)
    end_date = colander.SchemaNode(colander.Date(), missing=None)
    start_circ = colander.SchemaNode(CurrencyInput())
    start_surplus = colander.SchemaNode(CurrencyInput())
    pull = colander.SchemaNode(colander.Boolean(), missing=False)
    close = colander.SchemaNode(colander.Boolean(), missing=False)


def day_intersects(day, range_start, range_end, is_start):
    """Make a SQL expr that checks whether a day intersects with a range.
    """
    if is_start:
        no_bound_test = (range_start == null)
    else:
        no_bound_test = (range_end == null)

    return or_(
        and_(
            # Yes if the range is unlimited, regardless of the day.
            range_start == null,
            range_end == null),
        and_(
            # Yes if the day is not given and the range has no boundary
            # at the specified endpoint (the start or the end).
            day == null,
            no_bound_test),
        and_(
            # Yes if the day is given, the range has a start, and
            # the day is at the start or later.
            day != null,
            range_start != null,
            range_end == null,
            day >= range_start),
        and_(
            # Yes if the day is given, the range has an end, and
            # the day is at the end or earlier.
            day != null,
            range_start == null,
            range_end != null,
            day <= range_end),
        and_(
            # Yes if the day is given, the range is fully bounded, and
            # the day is within the range.
            day != null,
            range_start != null,
            range_end != null,
            day >= range_start,
            day <= range_end),
    )


def detect_date_conflict(dbsession, period, new_start_date, new_end_date):
    """Find conflicting periods for a new date range.

    Return the first conflicting period.
    """

    def has_conflict():
        """Make a SQL expression that checks whether the new range intersects
        with an existing range.
        """
        new_start_date1 = (
            literal(None) if new_start_date is None else new_start_date)
        new_end_date1 = (
            literal(None) if new_end_date is None else new_end_date)

        return or_(
            day_intersects(
                # Yes if the new start date intersects with the period.
                new_start_date1,
                Period.start_date,
                Period.end_date,
                True),
            day_intersects(
                # Yes if the new end date intersects with the period.
                new_end_date1,
                Period.start_date,
                Period.end_date,
                False),
            day_intersects(
                # Yes if the period start date intersects with the new range.
                Period.start_date,
                new_start_date1,
                new_end_date1,
                True),
            day_intersects(
                # Yes if the period end date intersects with the new range.
                Period.end_date,
                new_start_date1,
                new_end_date1,
                False),
        )

    conflict_row = (
        dbsession.query(Period.id)
        .filter(
            Period.owner_id == period.owner_id,
            Period.peer_id == period.peer_id,
            Period.currency == period.currency,
            Period.loop_id == period.loop_id,
            Period.id != period.id,
            has_conflict(),
        )
        .order_by(Period.start_date)
        .first())

    return conflict_row


@view_config(
    name='save',
    context=PeriodResource,
    permission=perms.edit_period,
    renderer='json')
def period_save(context, request):
    """Change the period."""

    period = context.period
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    period_id = period.id

    schema = PeriodSaveSchema().bind(currency=period.currency)
    try:
        appstruct = schema.deserialize(request.json)
    except colander.Invalid as e:
        raise HTTPBadRequest(json_body={
            'error': 'invalid',
            'error_description': '; '.join(
                "%s (%s)" % (v, k)
                for (k, v) in sorted(e.asdict().items())),
        })

    start_date = appstruct['start_date']
    end_date = appstruct['end_date']
    start_circ = appstruct['start_circ']
    start_surplus = appstruct['start_surplus']
    pull = appstruct['pull']
    close = appstruct['close']

    if (start_date is not None
            and end_date is not None
            and start_date > end_date):
        start_date, end_date = end_date, start_date

    # Ensure the date range does not overlap any other periods for the
    # same peer loop.
    conflict_row = detect_date_conflict(
        dbsession=dbsession,
        period=period,
        new_start_date=start_date,
        new_end_date=end_date)
    if conflict_row is not None:
        raise HTTPBadRequest(json_body={
            'error': 'date_overlap',
            'error_description': (
                'The date range provided overlaps another period.'),
        })

    if close and (start_date is None or end_date is None):
        raise HTTPBadRequest(json_body={
            'error': 'dates_required',
            'error_description': (
                "The start and end dates are required "
                "for closing the period."),
        })

    period.start_date = start_date
    period.end_date = end_date
    period.start_circ = start_circ
    period.start_surplus = start_surplus

    move_counts = {}

    movement_op = MovementReassignOp(owner=owner)
    account_entry_op = AccountEntryReassignOp()

    if close:
        dbsession.query(
            func.set_config(
                'opnreco.movement.event_type', 'push_unreco', True),
            func.set_config(
                'opnreco.account_entry.event_type', 'push_unreco', True),
        ).one()

        # Push unreconciled movements and account entries in this period
        # to other open periods of the same peer loop.
        move_counts['push_unreco_movements'] = push_unreco(
            request=request, period=period, op=movement_op)
        move_counts['push_unreco_account_entries'] = push_unreco(
            request=request, period=period, op=account_entry_op)

    if pull:
        # Pull movements, account entries, and recos from other open
        # periods of the same peer loop into this period
        # if the date range fits. (Don't pull unreconciled movements
        # and account entries when closing.)

        if not close:
            dbsession.query(
                func.set_config(
                    'opnreco.movement.event_type', 'pull_unreco', True),
                func.set_config(
                    'opnreco.account_entry.event_type', 'pull_unreco', True),
            ).one()

            move_counts['pull_unreco_movements'] = (
                pull_unreco_and_ineligible(
                    request=request, period=period, op=movement_op))
            move_counts['pull_unreco_account_entries'] = (
                pull_unreco_and_ineligible(
                    request=request, period=period, op=account_entry_op))

        dbsession.query(
            func.set_config(
                'opnreco.movement.event_type', 'pull_recos', True),
            func.set_config(
                'opnreco.account_entry.event_type', 'pull_recos', True),
        ).one()

        move_counts['pull_recos'] = (
            pull_recos(request=request, period=period))

    totals = compute_period_totals(
        dbsession=dbsession,
        owner_id=owner_id,
        period_ids=[period_id])[period_id]

    if close:
        period.end_circ = totals['end']['circ']
        period.end_surplus = totals['end']['surplus']
        period.closed = True

    dbsession.add(OwnerLog(
        owner_id=owner_id,
        event_type='period_save',
        content={
            'period_id': period.id,
            'peer_id': period.peer_id,
            'loop_id': period.loop_id,
            'currency': period.currency,
            'start_date': period.start_date,
            'start_circ': period.start_circ,
            'start_surplus': period.start_surplus,
            'end_date': period.end_date,
            'end_circ': period.end_circ,
            'end_surplus': period.end_surplus,
            'close': close,
            'pull': pull,
        }))

    update_next_period(request=request, prev_period=period, totals=totals)

    return {
        'period': serialize_period(period),
        'move_counts': move_counts,
    }


def update_next_period(request, prev_period, totals):
    """If the next period is still open, update its start balances."""
    if prev_period.end_date is None:
        # No period can exist after prev_period until end_date is set.
        return

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    assert owner_id == prev_period.owner_id

    next_period = (
        dbsession.query(Period)
        .filter(
            Period.owner_id == owner_id,
            Period.peer_id == prev_period.peer_id,
            Period.loop_id == prev_period.loop_id,
            Period.currency == prev_period.currency,
            Period.start_date > prev_period.end_date,
        )
        .order_by(Period.start_date)
        .first())

    if next_period is not None and not next_period.closed:
        next_period.start_circ = totals['end']['circ']
        next_period.start_surplus = totals['end']['surplus']
        dbsession.add(OwnerLog(
            owner_id=owner_id,
            event_type='update_next_period',
            content={
                'prev_period_id': prev_period.id,
                'period_id': next_period.id,
                'peer_id': next_period.peer_id,
                'loop_id': next_period.loop_id,
                'currency': next_period.currency,
                'start_circ': next_period.start_circ,
                'start_surplus': next_period.start_surplus,
            },
        ))


def make_day_period_cte(days, period_list, default_period='in_progress'):
    """Create a CTE (common table expr) that maps a date to a period ID.

    Provide a list of days to include in the CTE and the candidate periods.

    Return a tuple:
    - day_periods: [(day, period_id)]
    - day_period_cte
    - missing_periods, a boolean that is true when some of the days
      don't map to any period.
    """
    # Choose a period for the movements, entries, or recos on a given date.
    day_periods = []  # [(date, period_id)]
    missing_period = False
    for day in days:
        period = get_period_for_day(period_list, day, default=default_period)
        if period is None:
            missing_period = True
        else:
            day_periods.append((day, period.id))

    if day_periods:
        # Turn day_periods into day_period_cte, a common table expression
        # that contains a simple mapping of date to period ID.
        # See: https://stackoverflow.com/questions/44140632

        # Optimization to reduce the size of the statement:
        # Type cast only for first row;
        # for other rows the database will infer.
        stmts = [
            select([
                cast(literal(d), Date).label('day'),
                cast(literal(pid), BigInteger).label('period_id'),
            ])
            for (d, pid) in day_periods[:1]]
        stmts.extend(
            select([literal(d), literal(pid)])
            for (d, pid) in day_periods[1:])
        day_period_cte = union_all(*stmts).cte(name='day_period_cte')

    else:
        # There are no periods for any of the days.
        # Use a table with zero rows as day_period_cte.
        day_period_cte = (
            select([
                cast(literal(None), Date).label('day'),
                cast(literal(None), BigInteger).label('period_id'),
            ]).where(literal(1) == literal(0)).cte(name='day_period_cte'))

    return day_periods, day_period_cte, missing_period


def get_tzname(owner):
    return owner.tzname or 'America/New_York'


class MovementReassignOp:
    """Operation config for (push|pull)_unreco to reassign movements.
    """
    def __init__(self, owner):
        self.table = Movement
        self.date_c = func.date(func.timezone(
            get_tzname(owner),
            func.timezone('UTC', Movement.ts)
        ))
        self.plural = 'movements'
        self.nonzero_filter = or_(
            Movement.vault_delta != 0, Movement.wallet_delta != 0)


class AccountEntryReassignOp:
    """Operation config for (push|pull)_unreco to reassign account entries.
    """
    def __init__(self):
        self.table = AccountEntry
        self.date_c = AccountEntry.entry_date
        self.plural = 'account_entries'
        self.nonzero_filter = AccountEntry.delta != 0


def push_unreco(request, period, op):
    """Push unreconciled movements or entries to the next open period.

    Create a new period if necessary.

    Items that ineligible for reconciliation should be treated
    as reconciled, and reconciled items should not be pushed when
    closing a file, so this function does not push them.
    """
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    assert period.owner_id == owner_id

    item_filter = and_(
        op.table.owner_id == owner_id,
        op.table.period_id == period.id,
        op.table.reco_id == null,
        # Zero-value items (such as note issuance) are ineligible for
        # reconciliation, so treat them as reconciled and don't push them.
        op.nonzero_filter,
    )

    # List the dates of all unreconciled items in the period.
    unreco_query = (
        dbsession.query(
            op.date_c.label('day'),
            op.table.id.label('item_id'),
        )
        .filter(item_filter)
    )
    unreco_rows = unreco_query.all()

    if not unreco_rows:
        # There are no unreconciled items in the period.
        return 0

    # List the other open periods for the peer.
    period_list = (
        dbsession.query(Period)
        .filter(
            Period.owner_id == owner_id,
            Period.peer_id == period.peer_id,
            Period.loop_id == period.loop_id,
            Period.currency == period.currency,
            ~Period.closed,
            Period.id != period.id)
        .all())

    # List the items to reassign.
    days = set()
    item_ids = []
    for day, item_id in unreco_rows:
        days.add(day)
        if item_id is not None:
            item_ids.append(item_id)

    # Map the days to periods.
    day_periods, day_period_cte, missing_period = make_day_period_cte(
        days=sorted(days),
        period_list=period_list)

    # If no period is available for some of the items,
    # create a new period.
    if missing_period:
        new_period = add_open_period(
            dbsession=dbsession,
            owner_id=owner_id,
            peer_id=period.peer_id,
            loop_id=period.loop_id,
            currency=period.currency,
            event_type='add_period_for_push_unreco_%s' % op.plural)
        new_period_id = new_period.id
    else:
        new_period_id = None

    # Reassign the unreconciled items.
    subq = (
        dbsession.query(day_period_cte.c.period_id)
        .filter(day_period_cte.c.day == op.date_c)
        .as_scalar())
    (dbsession.query(op.table)
        .filter(item_filter)
        .update(
            {'period_id': func.coalesce(subq, new_period_id)},
            synchronize_session='fetch'))

    dbsession.add(OwnerLog(
        owner_id=owner_id,
        event_type='push_unreco_%s' % op.plural,
        content={
            'period_id': period.id,
            'peer_id': period.peer_id,
            'loop_id': period.loop_id,
            'currency': period.currency,
            'item_ids': item_ids,
            'day_periods': day_periods,
            'new_period_id': new_period_id,
        }))

    return len(item_ids)


def pull_unreco_and_ineligible(request, period, op):
    """Pull unreconciled items from other open periods into this period.

    Items ineligible for reconciliation should be treated
    as reconciled, and reconciled items should be pulled,
    so this function also pulls items ineligible for reconciliation.
    """
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    assert period.owner_id == owner_id

    item_filter = and_(
        op.table.owner_id == owner_id,
        op.table.peer_id == period.peer_id,
        op.table.currency == period.currency,
        op.table.loop_id == period.loop_id,
        op.table.period_id != period.id,
        op.table.reco_id == null,
        ~Period.closed,
        # Note: don't use nonzero_filter here because we need to
        # include items ineligible for reconciliation in the pull.
    )

    # List the dates of all unreconciled items in other open periods
    # for the same peer loop.
    day_rows = (
        dbsession.query(op.date_c)
        .join(Period, Period.id == op.table.period_id)
        .filter(item_filter)
        .distinct().all()
    )

    if not day_rows:
        # There are no items to pull in.
        return 0

    # List the dates of the items to pull in.
    reassign_days = []
    period_list = [period]
    for (day,) in day_rows:
        if get_period_for_day(period_list, day, default=None) is period:
            reassign_days.append(day)

    if not reassign_days:
        # None of the items found should be pulled in to this period.
        return 0

    # Map the reassignable items to this period.
    day_periods, day_period_cte, missing_period = make_day_period_cte(
        days=sorted(reassign_days),
        period_list=period_list,
        default_period=None)

    # Make a subquery that lists the items to reassign.
    ids_query = (
        select([op.table.id])
        .select_from(
            op.table.__table__
            .join(Period, Period.id == op.table.period_id)
            .join(day_period_cte, day_period_cte.c.day == op.date_c)
        )
        .where(item_filter)
    )

    item_ids = [item_id for (item_id,) in dbsession.execute(ids_query)]

    # Reassign items.
    (dbsession.query(op.table)
        .filter(op.table.id.in_(ids_query))
        .update(
            {'period_id': period.id},
            synchronize_session='fetch'))

    dbsession.add(OwnerLog(
        owner_id=owner_id,
        event_type='pull_unreco_%s' % op.plural,
        content={
            'period_id': period.id,
            'peer_id': period.peer_id,
            'loop_id': period.loop_id,
            'currency': period.currency,
            'item_ids': item_ids,
            'day_periods': day_periods,
        }))

    return len(item_ids)


def pull_recos(request, period):
    """Pull recos from other open periods into this period.
    """
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    assert period.owner_id == owner_id

    reco_filter = and_(
        Reco.owner_id == owner_id,
        Reco.period_id != period.id,
        Period.peer_id == period.peer_id,
        Period.currency == period.currency,
        Period.loop_id == period.loop_id,
        ~Period.closed,
    )

    entry_date_c = (
        dbsession.query(func.min(AccountEntry.entry_date))
        .filter(AccountEntry.reco_id == Reco.id)
        .as_scalar()
    )

    movement_date_c = (
        dbsession.query(
            func.date(func.timezone(
                get_tzname(owner),
                func.timezone('UTC', func.min(Movement.ts))
            ))
        )
        .filter(Movement.reco_id == Reco.id)
        .as_scalar()
    )

    reco_date_c = func.coalesce(entry_date_c, movement_date_c)

    # List the dates of all recos in other open periods
    # for the same peer loop.
    day_rows = (
        dbsession.query(reco_date_c)
        .select_from(Reco)
        .join(Period, Period.id == Reco.period_id)
        .filter(reco_filter)
        .distinct().all()
    )

    if not day_rows:
        # There are no recos to pull in.
        return 0

    # List the dates of the recos to pull in.
    reassign_days = []
    period_list = [period]
    for (day,) in day_rows:
        if get_period_for_day(period_list, day, default=None) is period:
            reassign_days.append(day)

    if not reassign_days:
        # None of the recos found should be pulled in to this period.
        return 0

    # Map the reassignable recos to this period.
    day_periods, day_period_cte, missing_period = make_day_period_cte(
        days=sorted(reassign_days),
        period_list=period_list,
        default_period=None)

    # Make a subquery that lists the recos to reassign.
    ids_query = (
        select([Reco.id])
        .select_from(
            Reco.__table__
            .join(Period, Period.id == Reco.period_id)
            .join(day_period_cte, day_period_cte.c.day == reco_date_c)
        )
        .where(reco_filter)
    )

    reco_ids = [reco_id for (reco_id,) in dbsession.execute(ids_query)]

    # Reassign recos.
    (dbsession.query(Reco)
        .filter(Reco.id.in_(ids_query))
        .update(
            {'period_id': period.id},
            synchronize_session='fetch'))

    # Reassign the period_id of affected movements.
    (dbsession.query(Movement)
        .filter(Movement.reco_id.in_(ids_query))
        .update(
            {'period_id': period.id},
            synchronize_session='fetch'))

    # Reassign the period_id of affected account entries.
    (dbsession.query(AccountEntry)
        .filter(AccountEntry.reco_id.in_(ids_query))
        .update(
            {'period_id': period.id},
            synchronize_session='fetch'))

    dbsession.add(OwnerLog(
        owner_id=owner_id,
        event_type='pull_recos',
        content={
            'period_id': period.id,
            'peer_id': period.peer_id,
            'loop_id': period.loop_id,
            'currency': period.currency,
            'reco_ids': reco_ids,
            'day_periods': day_periods,
        }))

    return len(reco_ids)


@view_config(
    name='reopen',
    context=PeriodResource,
    permission=perms.reopen_period,
    renderer='json')
def period_reopen(context, request):
    period = context.period

    period.closed = False
    # Force recomputation of the end_circ and end_surplus amounts.
    period.end_circ = None
    period.end_surplus = None

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    dbsession.add(OwnerLog(
        owner_id=owner_id,
        event_type='period_reopen',
        content={
            'period_id': period.id,
            'peer_id': period.peer_id,
            'loop_id': period.loop_id,
            'currency': period.currency,
            'start_date': period.start_date,
            'start_circ': period.start_circ,
            'start_surplus': period.start_surplus,
            'end_date': period.end_date,
            'end_circ': period.end_circ,
            'end_surplus': period.end_surplus,
        }))

    return {
        'period': serialize_period(period),
    }
