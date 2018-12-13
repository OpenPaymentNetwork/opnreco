
from colander import Boolean
from colander import Date
from colander import Invalid
from colander import Schema
from colander import SchemaNode
from colander import SchemaType
from opnreco.models.db import AccountEntry
from opnreco.models.db import Movement
from opnreco.models.db import now_func
from opnreco.models.db import OwnerLog
from opnreco.models.db import Period
from opnreco.models.db import Statement
from opnreco.models.site import API
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
from sqlalchemy import cast
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
    name='periods',
    context=API,
    permission='use_app',
    renderer='json')
def periods_api(request):
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


def get_period(request):
    try:
        period_id = int(request.params['period_id'])
    except Exception:
        raise HTTPBadRequest(json_body={
            'error': 'bad_period_id',
        })

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    period = (
        dbsession.query(Period)
        .filter(
            Period.owner_id == owner_id,
            Period.id == period_id,
        )
        .first())
    if period is None:
        raise HTTPBadRequest(json_body={
            'error': 'period_not_found',
            'error_description': (
                "No period found for your profile with period ID %s"
                % period_id),
        })

    return period


@view_config(
    name='period',
    context=API,
    permission='use_app',
    renderer='json')
def period_api(request):
    """Return info about a period, its peer, and its loop."""
    period = get_period(request)

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
        'peer': peers.get(period.peer_id),
        'loop': loops.get(period.loop_id),
        'totals': totals,
    }

    return res


class CurrencyInput(SchemaType):
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
            raise Invalid(node, '"%s" is not a number' % cstruct)

        return value


class PeriodSaveSchema(Schema):
    start_date = SchemaNode(Date(), missing=None)
    end_date = SchemaNode(Date(), missing=None)
    start_circ = SchemaNode(CurrencyInput())
    start_surplus = SchemaNode(CurrencyInput())
    reassign = SchemaNode(Boolean(), missing=False)


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
        """Make a SQL expr that checks whether the new range intersects
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
    name='period-save',
    context=API,
    permission='use_app',
    renderer='json')
def period_save(context, request, close=False):
    period = get_period(request)

    if period.closed:
        raise HTTPBadRequest(json_body={
            'error': 'period_closed',
            'error_description': (
                "This period is closed. Reopen it if you need to change it."),
        })

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    period_id = period.id

    schema = PeriodSaveSchema().bind(currency=period.currency)
    try:
        appstruct = schema.deserialize(request.json)
    except Invalid as e:
        raise HTTPBadRequest(json_body={
            'error': 'invalid',
            'error_description': '; '.join(
                "%s (%s)" % (v, k)
                for (k, v) in sorted(e.asdict().items())),
        })

    start_date = appstruct['start_date']
    end_date = appstruct['end_date']
    start_circ = appstruct['start_circ']
    end_circ = appstruct['end_circ']
    pull = appstruct['pull']

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
            'error': 'date_conflict',
            'error_description': (
                'The date range provided conflicts with another period.'),
        })

    period.start_date = start_date
    period.end_date = end_date
    period.start_circ = start_circ
    period.end_circ = end_circ

    if close:
        push_unreconciled(request=request, period=period)

    if pull:
        pull_into(request=request, period=period, close=close)

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
        event_type='period-save',
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

    return serialize_period(period)


def push_unreconciled(request, period):
    """Push unreconciled movements and entries to the next open period.

    Create a new period if necessary.
    """
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    assert period.owner_id == owner_id

    # List the dates of all unreconciled movements and entries in the period.
    date_query = (
        dbsession.query(
            cast(Date, func.timezone(
                owner.tzname, func.timezone('UTC', Movement.ts)))).label('day')
        .filter(
            Movement.owner_id == owner_id,
            Movement.period_id == period.id,
            Movement.reco_id == null,
        )
    ).union(
        dbsession.query(AccountEntry.entry_date).label('day')
        .filter(
            AccountEntry.owner_id == owner_id,
            AccountEntry.period_id == period.id,
            AccountEntry.reco_id == null,
        )
    )

    day_rows = date_query.distinct().all()

    if not day_rows:
        # There are no unreconciled entries in the period.
        return

    # List the other existing periods for the peer.
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

    # Choose a new period for all movements and entries with a given date.
    date_rows = []  # [(date, period_id)]
    need_new = False
    for (day,) in day_rows:
        period = get_period_for_day(period_list, day)
        if period is None:
            need_new = True
        else:
            date_rows.append((day, period.id))

    # Turn date_rows into date_cte.
    # See: https://stackoverflow.com/questions/44140632

    # Optimization to reduce the size of the statement:
    # Make type cast only for first row;
    # for other rows the database will infer.
    stmts = [
        select([
            cast(literal(d), Date).label('day'),
            cast(literal(pid), BigInteger).label('period_id'),
        ])
        for (d, pid) in date_rows[:1]]
    stmts.extend(
        select([literal(d), literal(pid)])
        for (d, pid) in date_rows[1:])
    date_cte = union_all(*stmts).cte(name='date_cte')

    # If no period is available for some of the movements and entries,
    # create a new period.
    if need_new:
        new_period = add_open_period(
            dbsession=dbsession,
            owner_id=owner_id,
            peer_id=period.peer_id,
            loop_id=period.loop_id,
            currency=period.currency,
            event_type='add_period_for_push_unreconciled')
        new_period_id = new_period.id
    else:
        new_period_id

    # Reassign the unreconciled movements.
    subq = (
        dbsession.query(date_cte.c.period_id)
        .filter(
            date_cte.c.day == cast(Date, func.timezone(
                owner.tzname, func.timezone('UTC', Movement.ts))))
        .scalar())
    movement_results = (
        dbsession.query(Movement)
        .filter(
            Movement.owner_id == owner_id,
            Movement.period_id == period.id,
            Movement.reco_id == null,
        )
        .update({'period_id': func.coalesce(subq, new_period_id)}))

    # Reassign the unreconciled account entries.
    subq = (
        dbsession.query(date_cte.c.period_id)
        .filter(date_cte.c.day == AccountEntry.entry_date)
        .scalar())
    entry_results = (
        dbsession.query(AccountEntry)
        .filter(
            AccountEntry.owner_id == owner_id,
            AccountEntry.period_id == period.id,
            AccountEntry.reco_id == null,
        )
        .update({'period_id': func.coalesce(subq, new_period_id)}))

    log.debug(
        "push_unreconciled results: %s, %s",
        movement_results, entry_results)


def pull_into(request, period, close):
    """Pull recos (and unreconciled movements / account entries if open)
    from other open periods into this period.
    """
    pass
