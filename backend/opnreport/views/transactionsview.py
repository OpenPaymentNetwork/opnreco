
from decimal import Decimal
from opnreport.models.db import AccountEntry
from opnreport.models.db import Movement
from opnreport.models.db import Reco
from opnreport.models.db import TransferRecord
from opnreport.models.db import now_func
from opnreport.models.site import API
from opnreport.param import get_request_file
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy import case
from sqlalchemy import cast
from sqlalchemy import DateTime
from sqlalchemy import literal_column
import re


null = None
zero = Decimal()


movement_delta = -(Movement.wallet_delta + Movement.vault_delta)
reco_movement_delta = -(Movement.reco_wallet_delta + Movement.vault_delta)


def start_query(dbsession):
    return dbsession.query(
        AccountEntry.id.label('account_entry_id'),
        AccountEntry.entry_date,
        AccountEntry.delta.label('account_delta'),
        Movement.id.label('movement_id'),
        Movement.ts,
        Movement.reco_id,
        movement_delta.label('movement_delta'),
        reco_movement_delta.label('reco_movement_delta'),
        TransferRecord.workflow_type,
        TransferRecord.transfer_id,
    )


@view_config(
    name='transactions',
    context=API,
    permission='use_app',
    renderer='json')
def transactions_view(request):
    file, peer, loop = get_request_file(request)
    params = request.params

    offset_str = params.get('offset', '')
    if not re.match(r'^[0-9]+$', offset_str):
        raise HTTPBadRequest(json_body={'error': 'offset required'})
    offset = max(int(offset_str), 0)

    limit_str = params.get('limit', '')
    if limit_str == 'none':
        limit = None
    else:
        if not re.match(r'^[0-9]+$', limit_str):
            raise HTTPBadRequest(json_body={'error': 'limit required'})
        limit = max(int(limit_str), 0)

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    movement_delta = -(Movement.wallet_delta + Movement.vault_delta)
    reco_movement_delta = -(Movement.reco_wallet_delta + Movement.vault_delta)
    queries = []

    # List the reconciled entries.
    queries.append(
        dbsession.query(
            Reco.id.label('reco_id'),
            func.min(AccountEntry.id).label('account_entry_id'),
            func.min(AccountEntry.entry_date).label('entry_date'),
            func.sum(AccountEntry.delta).label('account_delta'),
            func.min(Movement.id).label('movement_id'),
            func.min(Movement.ts).label('ts'),
            func.sum(movement_delta).label('movement_delta'),
            func.sum(reco_movement_delta).label('reco_movement_delta'),
            func.min(TransferRecord.workflow_type).label('workflow_type'),
            func.min(TransferRecord.transfer_id).label('transfer_id'),
        )
        .select_from(Reco)
        .outerjoin(AccountEntry, AccountEntry.reco_id == Reco.id)
        .outerjoin(Movement, Movement.reco_id == Reco.id)
        .outerjoin(TransferRecord, TransferRecord.id == null)
        .filter(
            Reco.owner_id == owner_id,
            ~Reco.internal,
            or_(
                Movement.file_id == file.id,
                AccountEntry.file_id == file.id,
            ),
        )
        .group_by(Reco.id)
    )

    # Include the unreconciled account entries.
    queries.append(
        dbsession.query(
            AccountEntry.reco_id,
            AccountEntry.id.label('account_entry_id'),
            AccountEntry.entry_date,
            AccountEntry.delta.label('account_delta'),
            Movement.id.label('movement_id'),
            Movement.ts.label('ts'),
            movement_delta.label('movement_delta'),
            reco_movement_delta.label('reco_movement_delta'),
            TransferRecord.workflow_type,
            TransferRecord.transfer_id,
        )
        .select_from(AccountEntry)
        .outerjoin(Movement, Movement.id == null)
        .outerjoin(TransferRecord, TransferRecord.id == null)
        .filter(
            AccountEntry.owner_id == owner_id,
            AccountEntry.file_id == file.id,
            AccountEntry.delta != 0,
            AccountEntry.reco_id == null,
        )
    )

    # Include the unreconciled movements.
    queries.append(
        dbsession.query(
            Movement.reco_id,
            AccountEntry.id.label('account_entry_id'),
            AccountEntry.entry_date,
            AccountEntry.delta.label('account_delta'),
            Movement.id.label('movement_id'),
            Movement.ts,
            movement_delta.label('movement_delta'),
            reco_movement_delta.label('reco_movement_delta'),
            TransferRecord.workflow_type,
            TransferRecord.transfer_id,
        )
        .select_from(Movement)
        .join(
            TransferRecord,
            TransferRecord.id == Movement.transfer_record_id)
        .outerjoin(AccountEntry, AccountEntry.id == null)
        .filter(
            Movement.owner_id == owner_id,
            Movement.file_id == file.id,

            # The peer_id, loop_id, and currency conditions are redudandant,
            # but they might help avoid accidents.
            Movement.peer_id == file.peer_id,
            Movement.loop_id == file.loop_id,
            Movement.currency == file.currency,

            movement_delta != 0,
            Movement.reco_id == null,
        )
    )

    query = queries[0].union(*queries[1:])
    total_cte = query.cte('total_cte')
    amount_expr = func.coalesce(
        total_cte.c.account_delta, total_cte.c.movement_delta)
    inc_row = amount_expr > 0
    dec_row = amount_expr < 0
    totals_row = (
        dbsession.query(
            now_func.label('now'),
            func.count(1).label('rowcount'),
            func.sum(case([
                (inc_row, total_cte.c.account_delta),
            ], else_=0)).label('inc_account_delta'),
            func.sum(case([
                (dec_row, total_cte.c.account_delta),
            ], else_=0)).label('dec_account_delta'),
            func.sum(case([
                (inc_row, total_cte.c.reco_movement_delta),
            ], else_=0)).label('inc_reco_movement_delta'),
            func.sum(case([
                (dec_row, total_cte.c.reco_movement_delta),
            ], else_=0)).label('dec_reco_movement_delta'),
        ).one())
    all_incs = {
        'account_delta': totals_row.inc_account_delta or zero,
        'reco_movement_delta': totals_row.inc_reco_movement_delta or zero,
    }
    all_decs = {
        'account_delta': totals_row.dec_account_delta or zero,
        'reco_movement_delta': totals_row.dec_reco_movement_delta or zero,
    }

    rows_query = query.order_by(
        AccountEntry.entry_date,
        Movement.ts,
        Movement.id,
    ).offset(offset)
    if limit is not None:
        rows_query = rows_query.limit(limit)
    rows = rows_query.all()

    inc_records = []
    page_incs = {'account_delta': zero, 'reco_movement_delta': zero}
    dec_records = []
    page_decs = {'account_delta': zero, 'reco_movement_delta': zero}

    for row in rows:
        account_delta = row.account_delta
        movement_delta = row.movement_delta
        d = (
            account_delta if account_delta is not None
            else movement_delta if movement_delta is not None
            else zero)
        inc = True if d > zero else False if d < zero else None

        if inc is not None:
            movement_id = row.movement_id
            account_entry_id = row.account_entry_id
            reco_id = row.reco_id
            reco_movement_delta = row.reco_movement_delta
            record = {
                'account_entry_id': (
                    None if account_entry_id is None
                    else str(account_entry_id)),
                'entry_date': row.entry_date,
                'account_delta': account_delta,
                'movement_id': (
                    None if movement_id is None
                    else str(movement_id)),
                'ts': row.ts,
                'reco_id': None if reco_id is None else str(reco_id),
                'movement_delta': movement_delta or '0',
                'reco_movement_delta': reco_movement_delta or '0',
                'workflow_type': row.workflow_type,
                'transfer_id': row.transfer_id,
            }
            if inc:
                inc_records.append(record)
                if account_delta:
                    page_incs['account_delta'] += account_delta
                if reco_movement_delta:
                    page_incs['reco_movement_delta'] += reco_movement_delta
            else:
                dec_records.append(record)
                if account_delta:
                    page_decs['account_delta'] += account_delta
                if reco_movement_delta:
                    page_decs['reco_movement_delta'] += reco_movement_delta

    all_shown = totals_row.rowcount == len(rows)
    if all_shown:
        # Double check the total calculations.
        if page_incs != all_incs or page_decs != all_decs:
            raise AssertionError("All rows shown but total mismatch. %s" % {
                'page_incs': page_incs,
                'all_incs': all_incs,
                'page_decs': page_decs,
                'all_decs': all_decs,
            })

    return {
        'now': totals_row.now,
        'rowcount': totals_row.rowcount,
        'all_shown': all_shown,
        'inc_records': inc_records,
        'inc_totals': {
            'page': page_incs,
            'all': all_incs,
        },
        'dec_records': dec_records,
        'dec_totals': {
            'page': page_decs,
            'all': all_decs,
        },
    }
