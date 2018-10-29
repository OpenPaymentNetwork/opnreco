
from decimal import Decimal
from opnreport.models.db import AccountEntry
from opnreport.models.db import Reco
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.param import get_request_file
from opnreport.viewcommon import make_movement_cte
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy import case
from sqlalchemy import cast
from sqlalchemy import DateTime
import re


null = None
zero = Decimal()


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
    if not re.match(r'^[0-9]+$', limit_str):
        raise HTTPBadRequest(json_body={'error': 'limit required'})
    limit = min(max(int(limit_str), 1), 1000)

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    movement_cte = make_movement_cte(
        dbsession=dbsession, file=file, owner_id=owner_id)

    # List all unreconciled account entries and some of the
    # reconciled account entries.
    query = (
        dbsession.query(
            AccountEntry.id.label('account_entry_id'),
            AccountEntry.entry_date,
            AccountEntry.delta.label('account_delta'),
            movement_cte.c.id.label('movement_id'),
            movement_cte.c.ts,
            movement_cte.c.reco_id,
            (-movement_cte.c.delta).label('delta'),
            TransferRecord.workflow_type,
            TransferRecord.transfer_id,
        )
        .outerjoin(Reco, Reco.id == AccountEntry.reco_id)
        .outerjoin(movement_cte, movement_cte.c.reco_id == Reco.id)
        .outerjoin(
            TransferRecord,
            TransferRecord.id == movement_cte.c.transfer_record_id)
        .filter(
            AccountEntry.file_id == file.id,
            AccountEntry.delta != 0,
            or_(Reco.id == null, ~Reco.internal),
        )
    )

    # List all movements in the file not reconciled with account entries.
    # Include some reconciled entries.
    query = query.union(
        dbsession.query(
            AccountEntry.id.label('account_entry_id'),
            AccountEntry.entry_date,
            AccountEntry.delta.label('account_delta'),
            movement_cte.c.id.label('movement_id'),
            movement_cte.c.ts,
            movement_cte.c.reco_id,
            (-movement_cte.c.delta).label('delta'),
            TransferRecord.workflow_type,
            TransferRecord.transfer_id,
        )
        .select_from(movement_cte)
        .join(
            TransferRecord,
            TransferRecord.id == movement_cte.c.transfer_record_id)
        .outerjoin(Reco, Reco.id == movement_cte.c.reco_id)
        .outerjoin(AccountEntry, AccountEntry.reco_id == Reco.id)
        .filter(
            AccountEntry.id == null,
            movement_cte.c.delta != 0,
            or_(Reco.id == null, ~Reco.internal),
        )
    )

    # TODO: expect a query parameter to provide the TZ offset.
    time_expr = func.timezone('US/Eastern', func.coalesce(
        cast(AccountEntry.entry_date, DateTime),
        func.timezone('UTC', movement_cte.c.ts),
    ))

    q_cte = query.cte('q_cte')
    inc_row = func.coalesce(q_cte.c.account_delta, q_cte.c.delta) > 0
    dec_row = func.coalesce(q_cte.c.account_delta, q_cte.c.delta) < 0
    totals_row = (
        dbsession.query(
            func.count(1).label('rowcount'),
            func.sum(case([
                (inc_row, q_cte.c.account_delta),
            ], else_=0)).label('inc_account_delta'),
            func.sum(case([
                (dec_row, q_cte.c.account_delta),
            ], else_=0)).label('dec_account_delta'),
            func.sum(case([
                (inc_row, q_cte.c.delta),
            ], else_=0)).label('inc_delta'),
            func.sum(case([
                (dec_row, q_cte.c.delta),
            ], else_=0)).label('dec_delta'),
        ).one())

    rows = (
        query.order_by(time_expr)
        .offset(offset)
        .limit(limit)
        .all())

    inc_records = []
    inc_totals = {'account_delta': zero, 'delta': zero}
    dec_records = []
    dec_totals = {'account_delta': zero, 'delta': zero}

    for row in rows:
        account_delta = row.account_delta
        delta = row.delta
        d = (
            account_delta if account_delta is not None
            else delta if delta is not None
            else zero)
        inc = True if d > zero else False if d < zero else None

        if inc is not None:
            record = {
                'account_entry_id': row.account_entry_id,
                'entry_date': row.entry_date,
                'account_delta': account_delta,
                'movement_id': row.movement_id,
                'ts': row.ts,
                'reco_id': row.reco_id,
                'delta': delta,
                'workflow_type': row.workflow_type,
                'transfer_id': row.transfer_id,
            }
            if inc:
                inc_records.append(record)
                if account_delta is not None:
                    inc_totals['account_delta'] += account_delta
                if delta is not None:
                    inc_totals['delta'] += delta
            else:
                dec_records.append(record)
                if account_delta is not None:
                    dec_totals['account_delta'] += account_delta
                if delta is not None:
                    dec_totals['delta'] += delta

    return {
        'rowcount': totals_row.rowcount,
        'inc_records': inc_records,
        'inc_totals': inc_totals,
        'dec_records': dec_records,
        'dec_totals': dec_totals,
    }
