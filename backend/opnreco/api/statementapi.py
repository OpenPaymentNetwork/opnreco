
from opnreco.models import perms
from opnreco.models.db import AccountEntry
from opnreco.models.db import now_func
from opnreco.models.db import Statement
from opnreco.models.site import PeriodResource
from opnreco.serialize import serialize_period
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import case
from sqlalchemy import func
import logging

log = logging.getLogger(__name__)


null = None


@view_config(
    name='statements',
    context=PeriodResource,
    permission=perms.view_period,
    renderer='json')
def statements_api(context, request):
    """List all the statements for a period."""
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    period = context.period

    inc_case = case([(AccountEntry.delta > 0, AccountEntry.delta)], else_=None)
    dec_case = case([(AccountEntry.delta < 0, AccountEntry.delta)], else_=None)
    statement_rows = (
        dbsession.query(
            Statement.id,
            Statement.source,
            Statement.start_date,
            Statement.end_date,
            func.count(inc_case).label('inc_count'),
            func.count(dec_case).label('dec_count'),
            func.sum(inc_case).label('inc_total'),
            func.sum(dec_case).label('dec_total'),
        )
        .join(AccountEntry, AccountEntry.statement_id == Statement.id)
        .filter(
            Statement.owner_id == owner_id,
            Statement.peer_id == period.peer_id,
            Statement.loop_id == period.loop_id,
            Statement.currency == period.currency,
            Statement.period_id == period.id,
        )
        .group_by(Statement.id)
        .order_by(Statement.source, Statement.start_date, Statement.id)
        .all()
    )

    statements = [{
        'id': str(row.id),
        'source': row.source,
        'start_date': row.start_date,
        'end_date': row.end_date,
        'inc_count': row.inc_count,
        'dec_count': row.dec_count,
        'inc_total': row.inc_total,
        'dec_total': row.dec_total,
    } for row in statement_rows]

    now = dbsession.query(now_func).scalar()

    return {
        'now': now,
        'statements': statements,
    }


@view_config(
    name='statement',
    context=PeriodResource,
    permission=perms.view_period,
    renderer='json')
def statement_api(context, request):
    statement_id_input = request.params.get('statement_id')
    if not statement_id_input:
        raise HTTPBadRequest(json_body={'error': 'statement_id_required'})

    try:
        statement_id = int(statement_id_input)
    except ValueError:
        raise HTTPBadRequest(json_body={'error': 'bad_statement_id'})

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    period = context.period

    statement = (
        dbsession.query(Statement)
        .filter(
            Statement.owner_id == owner_id,
            Statement.id == statement_id,
            Statement.period_id == period.id,
        )
        .first())

    if statement is None:
        raise HTTPBadRequest(json_body={
            'error': 'statement_not_found',
            'error_description': (
                "Statement %s not found in this period."
                % statement_id_input
            ),
        })

    entry_rows = (
        dbsession.query(AccountEntry)
        .filter(
            AccountEntry.owner_id == owner_id,
            AccountEntry.statement_id == statement.id,
        )
        .order_by(
            AccountEntry.entry_date,
            AccountEntry.statement_page,
            AccountEntry.statement_line,
            AccountEntry.id)
        .all())
    entries = [{
        'id': str(row.id),
        'peer_id': row.peer_id,
        'period_id': str(row.period_id),
        'statement_page': row.statement_page,
        'statement_line': row.statement_line,
        'entry_date': row.entry_date,
        'loop_id': row.loop_id,
        'currency': row.currency,
        'delta': row.delta,
        'description': row.description,
        'reco_id': str(row.reco_id),
    } for row in entry_rows]

    return {
        'statement': {
            'id': str(statement.id),
            'owner_id': statement.owner_id,
            'peer_id': statement.peer_id,
            'period_id': str(statement.period_id),
            'loop_id': statement.loop_id,
            'currency': statement.currency,
            'start_date': statement.start_date,
            'end_date': statement.end_date,
            'source': statement.source,
        },
        'entries': entries,
        'period': serialize_period(context.period),
    }
