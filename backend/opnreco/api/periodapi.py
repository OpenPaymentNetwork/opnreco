
from decimal import Decimal
from opnreco.models import perms
from opnreco.models.db import AccountEntry
from opnreco.models.db import FileMovement
from opnreco.models.db import now_func
from opnreco.models.db import OwnerLog
from opnreco.models.db import Period
from opnreco.models.db import Reco
from opnreco.models.db import Statement
from opnreco.models.site import FileResource
from opnreco.models.site import PeriodResource
from opnreco.param import get_offset_limit
from opnreco.param import parse_amount
from opnreco.reassign import AccountEntryReassignOp
from opnreco.reassign import MovementReassignOp
from opnreco.reassign import pull_recos
from opnreco.reassign import pull_unreco
from opnreco.reassign import push_recos
from opnreco.reassign import push_unreco
from opnreco.serialize import serialize_period
from opnreco.viewcommon import add_open_period
from opnreco.viewcommon import compute_period_totals
from opnreco.viewcommon import configure_dblog
from opnreco.viewcommon import get_loop_map
from opnreco.viewcommon import get_peer_map
from opnreco.viewcommon import handle_invalid
from opnreco.viewcommon import open_end_period_exists
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import and_
from sqlalchemy import case
from sqlalchemy import func
from sqlalchemy import literal
from sqlalchemy import or_
import colander
import datetime
import logging

log = logging.getLogger(__name__)
zero = Decimal('0')
null = None


@view_config(
    name='period-list',
    context=FileResource,
    permission=perms.view_file,
    renderer='json')
def period_list_api(context, request):
    """Return a page of periods for a ploop.
    """
    params = request.params
    file = context.file
    offset, limit = get_offset_limit(params)

    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession

    future = datetime.datetime.utcnow() + datetime.timedelta(days=366 * 100)

    query = (
        dbsession.query(Period)
        .filter(
            Period.owner_id == owner_id,
            Period.file_id == file.id,
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

    # Get the next_start_date, which is null if the last period is endless.
    endless_c = case([(Period.end_date == null, 1)], else_=None)
    last_end_row = (
        dbsession.query(
            func.max(Period.end_date).label('end_date'),
            func.count(endless_c).label('endless'),
        )
        .filter(
            Period.owner_id == owner_id,
            Period.file_id == file.id,
        )
        .one())
    if last_end_row.endless:
        next_start_date = None
    else:
        next_start_date = last_end_row.end_date + datetime.timedelta(days=1)

    return {
        'periods': periods,
        'rowcount': totals_row.rowcount,
        'next_start_date': next_start_date,
    }


def get_delete_conflicts(dbsession, period):
    """Get an object that describes why a period can't be deleted (yet).

    Return None or {
        'statement_count': N,
    }
    """
    if period.end_date is None:
        return {'end_date_required': True}

    statement_count = (
        dbsession.query(func.count(1))
        .select_from(Statement)
        .filter(
            Statement.period_id == period.id,
        )
        .scalar())

    if statement_count:
        return {'statement_count': statement_count}

    return None


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
                        FileMovement.vault_delta == 0,
                        FileMovement.wallet_delta == 0,
                    ), null),
                    (Reco.id == null, 1),
                ], else_=null)).label('unreconciled'),
        )
        .select_from(FileMovement)
        .outerjoin(Reco, Reco.id == FileMovement.reco_id)
        .filter(
            FileMovement.owner_id == owner_id,
            FileMovement.period_id == period_id,
        )
        .one())

    account_entry_counts = (
        dbsession.query(
            func.count(AccountEntry.reco_id).label('reconciled'),
            func.count(1).label('all'),
        )
        .filter(
            AccountEntry.owner_id == owner_id,
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

    file = period.file
    if file.loop_id != '0':
        loops = get_loop_map(
            request=request, need_loop_ids=set([file.loop_id]), final=True)
    else:
        loops = {}

    delete_conflicts = get_delete_conflicts(dbsession=dbsession, period=period)

    res = {
        'now': now,
        'period': serialize_period(period, end_amounts=end_amounts),
        'peer': peers[period.peer_id],
        'loop': loops.get(file.loop_id),  # None for loop_id == '0'
        'totals': totals,
        'counts': counts,
        'delete_conflicts': delete_conflicts,
    }

    return res


def day_intersects(day, range_start, range_end, is_start):
    """Make a SQL expr that checks whether a day intersects with a date range.
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


def detect_date_overlap(dbsession, period, new_start_date, new_end_date):
    """Find overlapping periods for a new date range.

    Return the first overlapping period.
    """

    def has_overlap():
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

    overlap_row = (
        dbsession.query(Period.id)
        .filter(
            Period.owner_id == period.owner_id,
            Period.file_id == period.file_id,
            Period.id != period.id,
            has_overlap(),
        )
        .order_by(Period.start_date)
        .first())

    return overlap_row


class AmountInput(colander.SchemaType):
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
    start_circ = colander.SchemaNode(AmountInput())
    start_surplus = colander.SchemaNode(AmountInput())
    pull = colander.SchemaNode(colander.Boolean(), missing=False)
    close = colander.SchemaNode(colander.Boolean(), missing=False)


class PeriodAddSchema(colander.Schema):
    start_date = colander.SchemaNode(colander.Date(), missing=None)
    end_date = colander.SchemaNode(colander.Date(), missing=None)
    pull = colander.SchemaNode(colander.Boolean(), missing=False)


@view_config(
    name='save',
    context=PeriodResource,
    permission=perms.edit_period,
    renderer='json')
def period_save(context, request):
    """Change the period."""
    period = context.period

    schema = PeriodSaveSchema().bind(currency=period.file.currency)
    try:
        appstruct = schema.deserialize(request.json)
    except colander.Invalid as e:
        handle_invalid(e, schema=schema)

    return edit_period(
        request=request,
        period=period,
        appstruct=appstruct,
        event_type='period_save')


@view_config(
    name='period-add',
    context=FileResource,
    permission=perms.edit_file,
    renderer='json')
def period_add_api(context, request):
    """Add a period."""
    file = context.file

    schema = PeriodAddSchema().bind(currency=file.currency)
    try:
        appstruct = schema.deserialize(request.json)
    except colander.Invalid as e:
        handle_invalid(e, schema=schema)

    owner_id = request.owner.id

    period = Period(
        owner_id=owner_id,
        file_id=file.id,
        start_date=appstruct['start_date'],
        end_date=appstruct['end_date'],
        closed=False,
    )

    balances = get_prev_end_balances(request=request, next_period=period)
    appstruct['start_circ'] = period.start_circ = balances['circ']
    appstruct['start_surplus'] = period.start_surplus = balances['surplus']
    appstruct['close'] = False

    return edit_period(
        request=request,
        period=period,
        appstruct=appstruct,
        event_type='period_add',
        adding_period=True)


def edit_period(request, period, appstruct, event_type, adding_period=False):
    """Edit a period. Used for both adding and saving periods."""
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

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
    overlap_row = detect_date_overlap(
        dbsession=dbsession,
        period=period,
        new_start_date=start_date,
        new_end_date=end_date)
    if overlap_row is not None:
        raise HTTPBadRequest(json_body={
            'error': 'date_overlap',
            'error_description': (
                'The date range specified overlaps another period.'),
        })

    if close and (start_date is None or end_date is None):
        raise HTTPBadRequest(json_body={
            'error': 'dates_required',
            'error_description': (
                "Start and end dates are required "
                "for closing the period."),
        })

    period.start_date = start_date
    period.end_date = end_date
    period.start_circ = start_circ
    period.start_surplus = start_surplus

    if adding_period:
        dbsession.add(period)
        dbsession.flush()  # Assign period.id

    move_counts = {}

    movement_op = MovementReassignOp(owner=owner)
    account_entry_op = AccountEntryReassignOp()

    if close:
        configure_dblog(request, event_type='push_unreco')

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
            configure_dblog(request, event_type='pull_unreco')
            move_counts['pull_unreco_movements'] = (
                pull_unreco(
                    request=request, period=period, op=movement_op))
            move_counts['pull_unreco_account_entries'] = (
                pull_unreco(
                    request=request, period=period, op=account_entry_op))

        configure_dblog(request, event_type='push_recos')
        move_counts['pull_recos'] = (
            pull_recos(request=request, period=period))

    totals = compute_period_totals(
        dbsession=dbsession,
        owner_id=owner_id,
        period_ids=[period.id])[period.id]

    if close:
        period.end_circ = totals['end']['circ']
        period.end_surplus = totals['end']['surplus']
        period.closed = True

    # If the user is editing the period (not adding) and there is no
    # longer an open-ended period, create it now.
    if not adding_period and end_date is not None:
        if not open_end_period_exists(request=request, file_id=period.file_id):
            next_period = add_open_period(
                request=request,
                file_id=period.file_id,
                event_type='add_period_on_edit')
            # Pull unreconciled items into the automatically created period.
            # (Feature requested by Lexi.)
            configure_dblog(request, event_type='pull_unreco')
            move_counts['pull_next_unreco_movements'] = (
                pull_unreco(
                    request=request,
                    period=next_period,
                    op=movement_op))
            move_counts['pull_next_unreco_account_entries'] = (
                pull_unreco(
                    request=request,
                    period=next_period,
                    op=account_entry_op))

    dbsession.add(OwnerLog(
        owner_id=owner_id,
        personal_id=request.personal_id,
        event_type=event_type,
        content={
            'period_id': period.id,
            'file_id': period.file_id,
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
            Period.file_id == prev_period.file_id,
            Period.start_date > prev_period.end_date,
        )
        .order_by(Period.start_date)
        .first())

    if next_period is not None and not next_period.closed:
        next_period.start_circ = totals['end']['circ']
        next_period.start_surplus = totals['end']['surplus']
        dbsession.add(OwnerLog(
            owner_id=owner_id,
            personal_id=request.personal_id,
            event_type='update_next_period',
            content={
                'prev_period_id': prev_period.id,
                'period_id': next_period.id,
                'file_id': next_period.file_id,
                'start_circ': next_period.start_circ,
                'start_surplus': next_period.start_surplus,
            },
        ))


def get_prev_end_balances(request, next_period):
    """Get the end balances from the previous period.

    Return {'circ': end_circ or zero, 'surplus': end_surplus or zero}
    """
    if next_period.start_date is not None:
        dbsession = request.dbsession
        owner = request.owner
        owner_id = owner.id
        assert owner_id == next_period.owner_id

        prev_period = (
            dbsession.query(Period)
            .filter(
                Period.owner_id == owner_id,
                Period.file_id == next_period.file_id,
                Period.end_date < next_period.start_date,
            )
            .order_by(Period.end_date.desc())
            .first())

        if prev_period is not None:
            if prev_period.closed:
                return {
                    'circ': prev_period.end_circ,
                    'surplus': prev_period.end_surplus,
                }
            prev_period_id = prev_period.id
            totals = compute_period_totals(
                dbsession=dbsession,
                owner_id=owner_id,
                period_ids=[prev_period_id])[prev_period_id]
            return {
                'circ': totals['end']['circ'],
                'surplus': totals['end']['surplus'],
            }

    return {
        'circ': zero,
        'surplus': zero,
    }


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
        personal_id=request.personal_id,
        event_type='period_reopen',
        content={
            'period_id': period.id,
            'file_id': period.file_id,
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


@view_config(
    name='delete',
    context=PeriodResource,
    permission=perms.edit_period,
    renderer='json')
def period_delete(context, request):
    period = context.period

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    delete_conflicts = get_delete_conflicts(
        dbsession=dbsession, period=period)

    if delete_conflicts:
        raise HTTPBadRequest(json_body={
            'error': 'period_delete_conflict',
            'error_description': (
                "The period can not be deleted for the following "
                "reasons: %s" % delete_conflicts),
        })

    configure_dblog(request, event_type='period_delete')

    move_counts = {}

    movement_op = MovementReassignOp(owner=owner, include_ineligible=True)
    account_entry_op = AccountEntryReassignOp(include_ineligible=True)

    # Push all the unreconciled movements and account entries in this period
    # to other open periods of the same peer loop.
    move_counts['push_unreco_movements'] = push_unreco(
        request=request, period=period, op=movement_op)
    move_counts['push_unreco_account_entries'] = push_unreco(
        request=request, period=period, op=account_entry_op)
    # Push all the reconciled items as well.
    push_recos(request=request, period=period)

    dbsession.add(OwnerLog(
        owner_id=owner_id,
        personal_id=request.personal_id,
        event_type='period_delete',
        content={
            'period_id': period.id,
            'file_id': period.file_id,
            'start_date': period.start_date,
            'start_circ': period.start_circ,
            'start_surplus': period.start_surplus,
            'end_date': period.end_date,
            'end_circ': period.end_circ,
            'end_surplus': period.end_surplus,
        }))

    dbsession.delete(period)

    return {}
