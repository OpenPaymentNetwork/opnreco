
from defusedxml.common import EntitiesForbidden
from opnreco.autorecostmt import auto_reco_statement
from opnreco.models import perms
from opnreco.models.db import AccountEntry
from opnreco.models.db import Movement
from opnreco.models.db import now_func
from opnreco.models.db import OwnerLog
from opnreco.models.db import Period
from opnreco.models.db import Statement
from opnreco.models.site import PeriodResource
from opnreco.param import amount_re
from opnreco.param import parse_amount
from opnreco.reassign import reassign_statement_period
from opnreco.viewcommon import configure_dblog
from opnreco.viewcommon import handle_invalid
from opnreco.viewcommon import list_assignable_periods
from pyramid.decorator import reify
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.response import Response
from pyramid.view import view_config
from sqlalchemy import case
from sqlalchemy import func
from xlrd.formula import cellname
from xlrd.xldate import xldate_as_tuple
import base64
import colander
import datetime
import dateutil
import defusedxml
import logging
import xlrd

log = logging.getLogger(__name__)

defusedxml.defuse_stdlib()


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
        .outerjoin(AccountEntry, AccountEntry.statement_id == Statement.id)
        .filter(
            Statement.owner_id == owner_id,
            Statement.peer_id == period.peer_id,
            Statement.loop_id == period.loop_id,
            Statement.currency == period.currency,
            Statement.period_id == period.id,
        )
        .group_by(Statement.id)
        .order_by(Statement.id)
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


def serialize_entry(entry):
    return {
        'id': str(entry.id),
        'peer_id': entry.peer_id,
        'period_id': str(entry.period_id),
        'sheet': entry.sheet,
        'row': entry.row,
        'entry_date': entry.entry_date,
        'loop_id': entry.loop_id,
        'currency': entry.currency,
        'delta': entry.delta,
        'description': entry.description,
        'reco_id': None if entry.reco_id is None else str(entry.reco_id),
    }


def get_delete_conflicts(dbsession, statement):
    """Get an object that describes why a statement can't be deleted (yet).

    Return None or {
        'entries_in_closed_period': N,
    }
    """
    entries_in_closed_period = (
        dbsession.query(func.count(1))
        .select_from(AccountEntry)
        .join(Period, Period.id == AccountEntry.period_id)
        .filter(
            AccountEntry.statement_id == statement.id,
            Period.closed)
        .scalar())

    if entries_in_closed_period:
        return {'entries_in_closed_period': entries_in_closed_period}

    return None


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
            AccountEntry.sheet,
            AccountEntry.row,
            AccountEntry.id)
        .all())
    entries = [serialize_entry(row) for row in entry_rows]

    # periods is the list of periods the statement can be assigned to.
    periods = list_assignable_periods(
        dbsession=dbsession, owner_id=owner_id, period=period)

    delete_conflicts = get_delete_conflicts(
        dbsession=dbsession, statement=statement)

    return {
        'statement': serialize_statement(statement),
        'entries': entries,
        'periods': periods,
        'delete_conflicts': delete_conflicts,
    }


@view_config(
    name='statement-download',
    context=PeriodResource,
    permission=perms.view_period,
    renderer='json')
def statement_download_api(context, request):
    subpath = request.subpath
    if subpath:
        statement_id_input = subpath[0]
    else:
        statement_id_input = ''
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
                % statement_id
            ),
        })

    content = statement.content

    if content is None:
        raise HTTPBadRequest(json_body={
            'error': 'statement_has_no_upload',
            'error_description': (
                "Statement %s was not uploaded."
                % statement_id
            ),
        })

    headers = {
        'Content-Disposition': 'attachment; filename="%s"' % (
            statement.filename),
        'Content-Type': statement.content_type,
        'Content-Length': '%d' % len(content),
    }

    return Response(content, headers=headers)


class StatementSaveSchema(colander.Schema):
    id = colander.SchemaNode(colander.Integer())
    source = colander.SchemaNode(
        colander.String(),
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
        handle_invalid(e, schema=schema)

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
        old_period_id = statement.period_id
        statement.period_id = appstruct['period_id']

        # Change the period of the statement's account entries and recos that
        # should move with the statement.
        configure_dblog(
            request=request, event_type='reassign_statement_period')

        reassign_statement_period(
            dbsession=dbsession,
            statement=statement,
            old_period_id=old_period_id,
            new_period_id=statement.period_id)

    dbsession.add(OwnerLog(
        owner_id=owner_id,
        personal_id=request.personal_id,
        event_type='statement_save',
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
        handle_invalid(e, schema=schema)

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

    delete_conflicts = get_delete_conflicts(
        dbsession=dbsession, statement=statement)

    if delete_conflicts:
        raise HTTPBadRequest(json_body={
            'error': 'statement_delete_conflict',
            'error_description': (
                "The statement can not be deleted for the following "
                "reasons: %s" % delete_conflicts),
        })

    # Indicate that entries are being deleted and movements are being
    # changed because the statement is being deleted.
    configure_dblog(
        request=request, event_type='statement_delete')

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

    request.dbsession.add(OwnerLog(
        owner_id=owner_id,
        personal_id=request.personal_id,
        event_type='statement_delete',
        remote_addr=request.remote_addr,
        user_agent=request.user_agent,
        content=appstruct,
    ))

    return {}


class AccountEntryEditSchema(colander.Schema):
    # Validate these fields only lightly. The code will do its own
    # parsing and validation.
    id = colander.SchemaNode(colander.Integer(), missing=None)
    statement_id = colander.SchemaNode(colander.Integer())
    delta = colander.SchemaNode(
        colander.String(),
        validator=colander.All(
            colander.Length(max=50),
            colander.Regex(amount_re, msg="The amount is not valid"),
        ))
    entry_date = colander.SchemaNode(
        colander.String(),
        validator=colander.Length(max=50))
    sheet = colander.SchemaNode(
        colander.String(),
        missing='',
        validator=colander.Length(max=50))
    row = colander.SchemaNode(
        colander.Integer(),
        missing=None)
    description = colander.SchemaNode(
        colander.String(),
        missing='',
        validator=colander.Length(max=1000))


@view_config(
    name='entry-save',
    context=PeriodResource,
    permission=perms.edit_period,
    renderer='json')
def entry_save(context, request):
    """Save changes to an account entry."""
    period = context.period
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    schema = AccountEntryEditSchema()
    try:
        appstruct = schema.deserialize(request.json)
    except colander.Invalid as e:
        handle_invalid(e, schema=schema)

    statement = (
        dbsession.query(Statement)
        .filter(
            Statement.owner_id == owner_id,
            Statement.peer_id == period.peer_id,
            Statement.currency == period.currency,
            Statement.loop_id == period.loop_id,
            Statement.id == appstruct['statement_id'],
        )
        .first())
    if statement is None:
        raise HTTPBadRequest(json_body={
            'error': 'statement_not_found',
            'error_description': (
                "Statement %s not found." % appstruct['statement_id'])
        })

    delta_input = appstruct['delta']
    try:
        appstruct['delta'] = parse_amount(
            delta_input, currency=period.currency)
    except Exception as e:
        raise HTTPBadRequest(json_body={
            'error': 'amount_parse_error',
            'error_description': (
                "Unable to parse amount '%s': %s" % (delta_input, e))
        })

    date_input = appstruct['entry_date']
    try:
        appstruct['entry_date'] = dateutil.parser.parse(date_input).date()
    except Exception as e:
        raise HTTPBadRequest(json_body={
            'error': 'date_parse_error',
            'error_description': (
                "Unable to parse date '%s': %s" % (date_input, e))
        })

    attrs = ('delta', 'entry_date', 'sheet', 'row', 'description')

    if appstruct['id']:
        configure_dblog(
            request=request, account_entry_event_type='entry_edit')

        entry = (
            dbsession.query(AccountEntry)
            .filter(
                AccountEntry.owner_id == owner_id,
                AccountEntry.statement_id == statement.id,
                AccountEntry.id == appstruct['id'],
            )
            .first())

        if entry is None:
            raise HTTPBadRequest(json_body={
                'error': 'account_entry_not_found',
                'error_description': (
                    'The specified account entry is not found.'),
            })

        if entry.reco_id is not None and entry.delta != appstruct['delta']:
            raise HTTPBadRequest(json_body={
                'error': 'amount_immutable_with_reco',
                'error_description': (
                    'The amount of an account entry can not change once it '
                    'has been reconciled. If you need to change the amount, '
                    'remove the reconciliation of the entry.'),
            })

        for attr in attrs:
            setattr(entry, attr, appstruct[attr])
        dbsession.flush()

    else:
        configure_dblog(
            request=request, account_entry_event_type='entry_add')

        entry = AccountEntry(
            owner_id=owner_id,
            peer_id=statement.peer_id,
            period_id=period.id,
            statement_id=statement.id,
            loop_id=statement.loop_id,
            currency=statement.currency,
            reco_id=None,
            **{attr: appstruct[attr] for attr in attrs})
        dbsession.add(entry)
        dbsession.flush()  # Assign entry.id

    return {'entry': serialize_entry(entry)}


class AccountEntryDeleteSchema(colander.Schema):
    id = colander.SchemaNode(colander.Integer())
    statement_id = colander.SchemaNode(colander.Integer())


@view_config(
    name='entry-delete',
    context=PeriodResource,
    permission=perms.edit_period,
    renderer='json')
def entry_delete(context, request):
    """Delete an account entry."""
    period = context.period
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    schema = AccountEntryDeleteSchema()
    try:
        appstruct = schema.deserialize(request.json)
    except colander.Invalid as e:
        handle_invalid(e, schema=schema)

    statement = (
        dbsession.query(Statement)
        .filter(
            Statement.owner_id == owner_id,
            Statement.peer_id == period.peer_id,
            Statement.currency == period.currency,
            Statement.loop_id == period.loop_id,
            Statement.id == appstruct['statement_id'],
        )
        .first())
    if statement is None:
        raise HTTPBadRequest(json_body={
            'error': 'statement_not_found',
            'error_description': (
                "Statement %s not found." % appstruct['statement_id'])
        })

    configure_dblog(
        request=request, account_entry_event_type='entry_delete')

    entry = (
        dbsession.query(AccountEntry)
        .filter(
            AccountEntry.owner_id == owner_id,
            AccountEntry.statement_id == statement.id,
            AccountEntry.id == appstruct['id'],
        )
        .first())

    if entry is None:
        raise HTTPBadRequest(json_body={
            'error': 'account_entry_not_found',
            'error_description': (
                'The specified account entry is not found.'),
        })

    if entry.reco_id is not None:
        raise HTTPBadRequest(json_body={
            'error': 'no_delete_reconciled_entry',
            'error_description': (
                'The specified account entry is reconciled and can not '
                'be deleted unless the reconciliation is removed first.'),
        })

    dbsession.delete(entry)
    dbsession.flush()

    return {}


class StatementAddBlankSchema(colander.Schema):
    source = colander.SchemaNode(
        colander.String(),
        validator=colander.Length(max=100))


@view_config(
    name='statement-add-blank',
    context=PeriodResource,
    permission=perms.edit_period,
    renderer='json')
def statement_add_blank(context, request):
    """Add a blank statement."""
    period = context.period
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    schema = StatementAddBlankSchema()
    try:
        appstruct = schema.deserialize(request.json)
    except colander.Invalid as e:
        handle_invalid(e, schema=schema)

    statement = Statement(
        owner_id=owner_id,
        period_id=period.id,
        peer_id=period.peer_id,
        loop_id=period.loop_id,
        currency=period.currency,
        source=appstruct['source'],
    )
    dbsession.add(statement)
    dbsession.flush()  # Assign statement.id

    dbsession.add(OwnerLog(
        owner_id=owner_id,
        personal_id=request.personal_id,
        event_type='statement_add_blank',
        remote_addr=request.remote_addr,
        user_agent=request.user_agent,
        content={
            'statement_id': statement.id,
            'source': appstruct['source'],
        },
    ))

    return {
        'statement': serialize_statement(statement),
    }


class StatementUploadSchema(colander.Schema):
    b64 = colander.SchemaNode(colander.String())
    name = colander.SchemaNode(
        colander.String(),
        validator=colander.Length(max=1000))
    size = colander.SchemaNode(
        colander.Integer(),
        missing=None)
    type = colander.SchemaNode(
        colander.String(),
        validator=colander.Length(max=1000))


@view_config(
    name='statement-upload',
    context=PeriodResource,
    permission=perms.edit_period,
    renderer='json')
class StatementUploadAPI:
    """Upload a statement."""
    excel_types = (
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )

    excel_extensions = ('.xls', '.xlsx')

    def __init__(self, context, request):
        self.context = context
        self.request = request
        self.currency = context.period.currency
        self.statement = None

    def __call__(self):
        request = self.request
        dbsession = request.dbsession
        owner = request.owner
        owner_id = owner.id

        schema = StatementUploadSchema()
        try:
            self.appstruct = appstruct = schema.deserialize(request.json)
        except colander.Invalid as e:
            handle_invalid(e, schema=schema)

        name = appstruct['name']
        pos = name.rfind('.')
        if pos >= 0:
            ext = name[pos:].lower()
        else:
            ext = ''

        content_type = appstruct['type'].split(';')[0]
        if content_type in self.excel_types or ext in self.excel_extensions:
            self.handle_excel()

        if self.statement is None:
            raise HTTPBadRequest(json_body={
                'error': 'file_type_not_supported',
                'error_description': (
                    "File type not supported: %s (%s)" %
                    (ext, appstruct['type'])
                ),
            })

        # Auto-reconcile the statement to the extent possible.
        configure_dblog(request=request, event_type='statement_auto_reco')
        auto_reco_statement(
            dbsession=dbsession,
            owner=owner,
            period=self.context.period,
            statement=self.statement)

        entry_count = (
            dbsession.query(func.count(1))
            .select_from(AccountEntry)
            .filter(AccountEntry.statement_id == self.statement.id)
            .scalar())

        dbsession.add(OwnerLog(
            owner_id=owner_id,
            personal_id=request.personal_id,
            event_type='statement_upload',
            remote_addr=request.remote_addr,
            user_agent=request.user_agent,
            content={
                'statement_id': self.statement.id,
                'filename': appstruct['name'],
                'content_type': appstruct['type'],
                'size': appstruct['size'],
                'entry_count': entry_count,
            },
        ))

        return {'statement': serialize_statement(self.statement)}

    @reify
    def content(self):
        return base64.decodestring(self.appstruct['b64'].encode('ascii'))

    def add_statement(self, source):
        appstruct = self.appstruct
        period = self.context.period
        dbsession = self.request.dbsession
        owner = self.request.owner
        owner_id = owner.id

        name = appstruct['name']
        # Drop directory names from the name.
        for sep in ('\\', '/'):
            pos = name.rfind(sep)
            if pos >= 0:
                name = name[pos + 1:]

        configure_dblog(
            request=self.request, account_entry_event_type='upload')

        statement = Statement(
            owner_id=owner_id,
            period_id=period.id,
            peer_id=period.peer_id,
            loop_id=period.loop_id,
            currency=period.currency,
            source=source,
            upload_ts=now_func,
            filename=name,
            content_type=appstruct['type'],
            content=self.content,
        )
        dbsession.add(statement)
        dbsession.flush()  # Assign statement.id

        self.statement = statement
        return statement

    def handle_excel(self):
        period = self.context.period
        dbsession = self.request.dbsession
        owner = self.request.owner
        owner_id = owner.id

        content = self.content
        try:
            book = xlrd.open_workbook(file_contents=content)
        except EntitiesForbidden:
            raise HTTPBadRequest(json_body={
                'error': 'xee_forbidden',
                'error_description': (
                    "Please upload a file with no complex XML entities."),
            })

        statement = self.add_statement("Spreadsheet")

        for sheetx, sheet in enumerate(book.sheets()):
            # Look for a heading row.
            # The heading must contain at least "date" and "amount".
            column_names = None
            heading_rowx = -1
            for rowx, row in enumerate(sheet.get_rows()):
                texts = [str(cell.value).lower() for cell in row]
                if 'date' in texts and 'amount' in texts:
                    # Found the heading.
                    column_names = tuple(texts)
                    heading_rowx = rowx
            if not column_names:
                # No heading row found. Assume default columns.
                column_names = ('date', 'amount', 'description')

            if 'date' not in column_names or 'amount' not in column_names:
                # Skip this sheet.
                continue

            sheet_name = sheet.name.strip() or str(sheetx + 1)
            if sheet_name.lower().startswith('sheet'):
                # Remove the redundant word.
                sheet_name = sheet_name[5:].strip()

            # Parse the sheet and add AccountEntry rows.
            for rowx, row in enumerate(sheet.get_rows()):
                if rowx <= heading_rowx:
                    continue

                attrs = {
                    'sheet': sheet_name,
                    'row': rowx + 1,
                }
                for colx, cell in enumerate(row):
                    if not cell.value:
                        continue
                    column_name = column_names[colx]
                    try:
                        info = self.parse_excel_cell(book, cell, column_name)
                    except Exception as e:
                        raise HTTPBadRequest(json_body={
                            'error': 'parse_error',
                            'error_description': (
                                "Unable to parse %s cell %s on sheet %s. "
                                "Cell contents: '%s', error: %s, %s" % (
                                    column_name,
                                    cellname(rowx, colx),
                                    sheet_name,
                                    cell.value,
                                    type(e),
                                    e,
                                )
                            ),
                        })
                    else:
                        if info:
                            k, v = info
                            attrs[k] = v

                if 'delta' not in attrs or 'entry_date' not in attrs:
                    # Empty or incomplete row.
                    continue

                if not attrs['delta']:
                    # Ignore zero amount rows.
                    continue

                dbsession.add(AccountEntry(
                    owner_id=owner_id,
                    peer_id=period.peer_id,
                    period_id=period.id,
                    statement_id=statement.id,
                    loop_id=period.loop_id,
                    currency=period.currency,
                    reco_id=None,
                    **attrs))

    def parse_excel_cell(self, book, cell, column_name):
        """Return (AccountEntry attr, value) or None.

        Raise an exception in the event of a parse error.
        """
        if column_name in ('date', 'entry date', 'entry_date'):
            if isinstance(cell.value, (int, float)):
                tup = xldate_as_tuple(cell.value, book.datemode)
                parsed = datetime.date(*tup[:3])
            else:
                parsed = dateutil.parser.parse(
                    str(cell.value)).date()
            return 'entry_date', parsed

        if column_name in ('amount', 'delta'):
            parsed = parse_amount(str(cell.value), currency=self.currency)
            return 'delta', parsed

        if column_name in ('description', 'desc'):
            return 'description', str(cell.value)

        return None
