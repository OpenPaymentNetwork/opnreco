
from opnreco.models import perms
from opnreco.models.db import AccountEntry
from opnreco.models.db import Movement
from opnreco.models.db import now_func
from opnreco.models.db import OwnerLog
from opnreco.models.db import Period
from opnreco.models.db import Statement
from opnreco.models.site import PeriodResource
from opnreco.viewcommon import list_assignable_periods
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import case
from sqlalchemy import func
import colander
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
            Statement.filename,
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
        .order_by(Statement.source, Statement.upload_ts, Statement.id)
        .all()
    )

    statements = [{
        'id': str(row.id),
        'source': row.source,
        'filename': row.filename,
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


def serialize_statement(statement):
    return {
        'id': str(statement.id),
        'owner_id': statement.owner_id,
        'peer_id': statement.peer_id,
        'period_id': str(statement.period_id),
        'loop_id': statement.loop_id,
        'currency': statement.currency,
        'source': statement.source,
        'upload_ts': statement.upload_ts,
        'filename': statement.filename,
        'content_type': statement.content_type,
    }


def count_delete_conflicts(dbsession, statement):
    """Count the number of entries in a statement that belong to closed period.
    """
    return (
        dbsession.query(func.count(1))
        .select_from(AccountEntry)
        .join(Period, Period.id == AccountEntry.period_id)
        .filter(
            AccountEntry.statement_id == statement.id,
            Period.closed)
        .scalar())


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
            AccountEntry.page,
            AccountEntry.line,
            AccountEntry.id)
        .all())
    entries = [{
        'id': str(row.id),
        'peer_id': row.peer_id,
        'period_id': str(row.period_id),
        'page': row.page,
        'line': row.line,
        'entry_date': row.entry_date,
        'loop_id': row.loop_id,
        'currency': row.currency,
        'delta': row.delta,
        'description': row.description,
        'reco_id': None if row.reco_id is None else str(row.reco_id),
    } for row in entry_rows]

    # periods is the list of periods the statement can be assigned to.
    periods = list_assignable_periods(
        dbsession=dbsession, owner_id=owner_id, period=period)

    # Prevent statement deletion if any of the contained account entries
    # belong to a closed period.
    delete_conflicts = count_delete_conflicts(
        dbsession=dbsession, statement=statement)

    return {
        'statement': serialize_statement(statement),
        'entries': entries,
        'periods': periods,
        'delete_conflicts': delete_conflicts,
    }


class StatementSaveSchema(colander.Schema):
    id = colander.SchemaNode(colander.Integer())
    source = colander.SchemaNode(
        colander.String(),
        missing='',
        validator=colander.Length(max=100))
    period_id = colander.SchemaNode(colander.Integer(), missing=None)


@view_config(
    name='statement-save',
    context=PeriodResource,
    permission=perms.edit_period,
    renderer='json')
def statement_save(context, request):
    """Save changes to a statement."""
    period = context.period
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    schema = StatementSaveSchema()
    try:
        appstruct = schema.deserialize(request.json)
    except colander.Invalid as e:
        raise HTTPBadRequest(json_body={
            'error': 'invalid',
            'error_description': '; '.join(
                "%s (%s)" % (v, k)
                for (k, v) in sorted(e.asdict().items())),
        })

    statement = (
        dbsession.query(Statement)
        .filter(
            Statement.owner_id == owner_id,
            Statement.id == appstruct['id'],
            Statement.peer_id == period.peer_id,
            Statement.currency == period.currency,
            Statement.loop_id == period.loop_id,
        )
        .first())

    if statement is None:
        raise HTTPBadRequest(json_body={
            'error': 'statement_not_found',
            'error_description': (
                "Statement %s not found." % appstruct['id']),
        })

    new_period = None
    if statement.period_id != appstruct['period_id']:
        new_period = (
            dbsession.query(Period)
            .filter(
                Period.owner_id == owner_id,
                Period.peer_id == period.peer_id,
                Period.currency == period.currency,
                Period.loop_id == period.loop_id,
                ~Period.closed,
                Period.id == appstruct['period_id'],
            )
            .first())
        if new_period is None:
            raise HTTPBadRequest(json_body={
                'error': 'invalid_period_id',
                'error_description': (
                    "The selected period is closed or not available."),
            })

    changes = {}

    if statement.source != appstruct['source']:
        changes['source'] = appstruct['source']
        statement.source = appstruct['source']

    if new_period is not None:
        changes['period_id'] = appstruct['period_id']
        statement.period_id = appstruct['period_id']

    request.dbsession.add(OwnerLog(
        owner_id=owner.id,
        event_type='edit_statement',
        remote_addr=request.remote_addr,
        user_agent=request.user_agent,
        content=appstruct,
    ))

    return {
        'statement': serialize_statement(statement),
    }


class StatementDeleteSchema(colander.Schema):
    id = colander.SchemaNode(colander.Integer())


@view_config(
    name='statement-delete',
    context=PeriodResource,
    permission=perms.edit_period,
    renderer='json')
def statement_delete(context, request):
    """Delete a statement and the contained account entries."""
    period = context.period
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    schema = StatementDeleteSchema()
    try:
        appstruct = schema.deserialize(request.json)
    except colander.Invalid as e:
        raise HTTPBadRequest(json_body={
            'error': 'invalid',
            'error_description': '; '.join(
                "%s (%s)" % (v, k)
                for (k, v) in sorted(e.asdict().items())),
        })

    statement = (
        dbsession.query(Statement)
        .filter(
            Statement.owner_id == owner_id,
            Statement.id == appstruct['id'],
            Statement.peer_id == period.peer_id,
            Statement.currency == period.currency,
            Statement.loop_id == period.loop_id,
        )
        .first())

    if statement is None:
        raise HTTPBadRequest(json_body={
            'error': 'statement_not_found',
            'error_description': (
                "Statement %s not found." % appstruct['id']),
        })

    delete_conflicts = count_delete_conflicts(
        dbsession=dbsession, statement=statement)

    if delete_conflicts:
        raise HTTPBadRequest(json_body={
            'error': 'statement_has_closed_entries',
            'error_description': (
                "The statement can not be deleted because some of the "
                "entries belong to a closed period."),
        })

    # Indicate that entries are being deleted and movements are being
    # changed because the statement is being deleted.
    dbsession.query(
        func.set_config(
            'opnreco.movement.event_type', 'statement_delete', True),
        func.set_config(
            'opnreco.account_entry.event_type', 'statement_delete', True),
    ).one()

    # reco_ids represents the list of recos to empty.
    reco_ids = (
        dbsession.query(AccountEntry.reco_id)
        .filter(
            AccountEntry.statement_id == statement.id,
        )
        .distinct()
        .subquery(name='reco_ids_subq'))

    # Cancel the reco_id of movements reconciled with any entry
    # in the statement.
    (
        dbsession.query(Movement)
        .filter(
            Movement.reco_id.in_(reco_ids),
        )
        .update({
            'reco_id': None,
            # Also reset the reco_wallet_delta for each movement.
            'reco_wallet_delta': Movement.wallet_delta,
        }, synchronize_session='fetch'))

    # Delete the account entries, but leave the account entry logs.
    (
        dbsession.query(AccountEntry)
        .filter(
            AccountEntry.statement_id == statement.id,
        )
        .delete(synchronize_session='fetch'))

    # Delete the statement.
    (
        dbsession.query(Statement)
        .filter(
            Statement.id == statement.id,
        )
        .delete(synchronize_session='fetch'))

    return {}
