
from opnreco.models import perms
from opnreco.models.db import AccountEntry
from opnreco.models.db import Statement
from opnreco.models.site import PeriodResource
from opnreco.serialize import serialize_period
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
import logging

log = logging.getLogger(__name__)


null = None


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
        .order_by(AccountEntry.entry_date, AccountEntry.id)
        .all())
    entries = [{
        'id': row.id,
        'peer_id': row.peer_id,
        'period_id': row.period_id,
        'statement_page': row.statement_page,
        'statement_line': row.statement_line,
        'entry_date': row.entry_date,
        'loop_id': row.loop_id,
        'currency': row.currency,
        'delta': row.delta,
        'description': row.description,
        'reco_id': row.reco_id,
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
