
from opnreco.models.db import now_func
from opnreco.models.db import Period
from opnreco.models.db import Statement
from opnreco.models.site import API
from opnreco.param import get_offset_limit
from opnreco.param import parse_ploop_key
from opnreco.serialize import serialize_period
from opnreco.viewcommon import compute_period_totals
from opnreco.viewcommon import get_loop_map
from opnreco.viewcommon import get_peer_map
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import func
import datetime


@view_config(
    name='periods',
    context=API,
    permission='use_app',
    renderer='json')
def periods_view(request):
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
    name='period',
    context=API,
    permission='use_app',
    renderer='json')
def period_view(request):
    """Return info about a period, its peer, and its loop."""
    try:
        period_id = int(request.params['period_id'])
    except Exception:
        raise HTTPBadRequest(json_body={
            'error': 'bad_period_id',
        })

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    now = dbsession.query(now_func).scalar()

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

    totals = compute_period_totals(
        dbsession=dbsession,
        owner_id=owner_id,
        period_ids=[period.id])[period_id]

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
