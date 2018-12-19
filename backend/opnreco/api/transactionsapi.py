
from decimal import Decimal
from opnreco.models import perms
from opnreco.models.db import AccountEntry
from opnreco.models.db import Movement
from opnreco.models.db import now_func
from opnreco.models.db import Reco
from opnreco.models.db import TransferRecord
from opnreco.models.site import PeriodResource
from opnreco.param import get_offset_limit
from pyramid.view import view_config
from sqlalchemy import BigInteger
from sqlalchemy import case
from sqlalchemy import cast
from sqlalchemy import Date
from sqlalchemy import DateTime
from sqlalchemy import func
from sqlalchemy import Numeric
from sqlalchemy import String
import collections


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
    context=PeriodResource,
    permission=perms.view_period,
    renderer='json')
def transactions_api(context, request):
    period_id = context.period.id
    params = request.params
    offset, limit = get_offset_limit(params)

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    # Compose a big query that returns a combination of reconciled rows,
    # unreconciled account entries, and unreconciled movements.
    # (The big query causes all ordering and paging to be done in the
    # database, which is faster than retrieving rows first.)

    movement_delta = -(Movement.wallet_delta + Movement.vault_delta)
    reco_movement_delta = -(Movement.reco_wallet_delta + Movement.vault_delta)

    account_delta_c = (
        dbsession.query(func.sum(AccountEntry.delta))
        .filter(AccountEntry.reco_id == Reco.id)
        .as_scalar()
        .label('account_delta')
    )

    entry_date_c = (
        dbsession.query(func.min(AccountEntry.entry_date))
        .filter(AccountEntry.reco_id == Reco.id)
        .as_scalar()
        .label('entry_date')
    )

    ts_c = (
        dbsession.query(func.min(Movement.ts))
        .filter(Movement.reco_id == Reco.id)
        .as_scalar()
        .label('ts')
    )

    movement_delta_c = (
        dbsession.query(func.sum(movement_delta))
        .filter(Movement.reco_id == Reco.id)
        .as_scalar()
        .label('movement_delta')
    )

    reco_movement_delta_c = (
        dbsession.query(func.sum(reco_movement_delta))
        .filter(Movement.reco_id == Reco.id)
        .as_scalar()
        .label('reco_movement_delta')
    )

    # List the reconciled entries in the period.
    # Since recos can contain any number of account entries and movements,
    # list just the reco IDs, delta totals, and dates. Get the reco-specific
    # account entries and movements after ordering and pagination.
    query = (
        dbsession.query(
            Reco.id.label('reco_id'),
            cast(None, BigInteger).label('account_entry_id'),
            entry_date_c,
            account_delta_c,
            cast(None, BigInteger).label('movement_id'),
            ts_c,
            movement_delta_c,
            reco_movement_delta_c,
            cast(None, String).label('workflow_type'),
            cast(None, String).label('transfer_id'),
        )
        .filter(
            Reco.owner_id == owner_id,
            Reco.period_id == period_id,
            ~Reco.internal,
        )
    )

    query = query.union(
        # Include the unreconciled account entries.
        dbsession.query(
            AccountEntry.reco_id,
            AccountEntry.id.label('account_entry_id'),
            AccountEntry.entry_date,
            AccountEntry.delta.label('account_delta'),
            cast(None, BigInteger).label('movement_id'),
            cast(None, DateTime).label('ts'),
            cast(None, Numeric).label('movement_delta'),
            cast(None, Numeric).label('reco_movement_delta'),
            cast(None, String).label('workflow_type'),
            cast(None, String).label('transfer_id'),
        )
        .filter(
            AccountEntry.owner_id == owner_id,
            AccountEntry.period_id == period_id,
            AccountEntry.delta != 0,
            AccountEntry.reco_id == null,
        ),

        # Include the unreconciled movements.
        dbsession.query(
            Movement.reco_id,
            cast(None, BigInteger).label('account_entry_id'),
            cast(None, Date).label('entry_date'),
            cast(None, Numeric).label('account_delta'),
            Movement.id.label('movement_id'),
            Movement.ts,
            movement_delta.label('movement_delta'),
            reco_movement_delta.label('reco_movement_delta'),
            TransferRecord.workflow_type,
            TransferRecord.transfer_id,
        )
        .join(
            TransferRecord,
            TransferRecord.id == Movement.transfer_record_id)
        .filter(
            Movement.owner_id == owner_id,
            Movement.period_id == period_id,
            movement_delta != 0,
            Movement.reco_id == null,
        ),
    )

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

    subq = query.subquery('subq')
    main_rows_query = (
        dbsession.query(subq)
        .order_by(
            subq.c.entry_date,
            subq.c.ts,
            subq.c.account_entry_id,
            subq.c.movement_id,
        )
        .offset(offset)
    )
    if limit is not None:
        main_rows_query = main_rows_query.limit(limit)
    main_rows = main_rows_query.all()

    # Now main_rows contains the rows for the table.

    inc_records = []
    page_incs = {'account_delta': zero, 'reco_movement_delta': zero}
    dec_records = []
    page_decs = {'account_delta': zero, 'reco_movement_delta': zero}

    query_reco_ids = [r.reco_id for r in main_rows if r.reco_id is not None]
    # reco_movements_map: {reco_id: [Movement]}
    reco_movements_map = collections.defaultdict(list)
    # reco_entries_map: {reco_id: [AccountEntry]}
    reco_entries_map = collections.defaultdict(list)

    if query_reco_ids:
        # Some of the rows may contain multiple account entries or movements.
        # Fill reco_movements_map and reco_entries_map.
        rows = (
            dbsession.query(
                Movement.reco_id,
                Movement.id.label('movement_id'),
                Movement.ts,
                movement_delta.label('movement_delta'),
                reco_movement_delta.label('reco_movement_delta'),
                TransferRecord.workflow_type,
                TransferRecord.transfer_id,
            )
            .join(
                TransferRecord,
                TransferRecord.id == Movement.transfer_record_id)
            .filter(
                Movement.owner_id == owner_id,
                Movement.reco_id.in_(query_reco_ids),
            )
            .order_by(Movement.ts, Movement.id)
            .all())
        for row in rows:
            reco_movements_map[row.reco_id].append(row)

        rows = (
            dbsession.query(
                AccountEntry.reco_id,
                AccountEntry.id.label('account_entry_id'),
                AccountEntry.entry_date,
                AccountEntry.delta.label('account_delta'),
            )
            .filter(
                AccountEntry.owner_id == owner_id,
                AccountEntry.reco_id.in_(query_reco_ids),
            )
            .order_by(AccountEntry.entry_date, AccountEntry.id)
            .all())
        for row in rows:
            reco_entries_map[row.reco_id].append(row)

    for main_row in main_rows:
        account_delta = main_row.account_delta
        movement_delta = main_row.movement_delta
        d = (
            account_delta if account_delta is not None
            else movement_delta if movement_delta is not None
            else zero)
        inc = True if d > zero else False if d < zero else None

        if inc is not None:
            movement_id = main_row.movement_id
            account_entry_id = main_row.account_entry_id
            reco_id = main_row.reco_id
            reco_movement_delta = main_row.reco_movement_delta
            record = {
                'reco_id': None if reco_id is None else str(reco_id),
                'account_entry_id': (
                    None if account_entry_id is None
                    else str(account_entry_id)),
                'movement_id': (
                    None if movement_id is None
                    else str(movement_id)),
                'account_entries': [],
                'movements': [],
            }

            if reco_id is None:
                # Unreconciled rows contain a movement or account entry.
                if account_entry_id is not None:
                    record['account_entries'].append({
                        'id': str(account_entry_id),
                        'entry_date': main_row.entry_date,
                        'account_delta': account_delta,
                    })
                if movement_id is not None:
                    record['movements'].append({
                        'id': str(movement_id),
                        'ts': main_row.ts,
                        'movement_delta': movement_delta or '0',
                        'reco_movement_delta': reco_movement_delta or '0',
                        'workflow_type': main_row.workflow_type,
                        'transfer_id': main_row.transfer_id,
                    })
            else:
                # Reconciled rows have multiple (or zero) movements
                # and account entries. Include them.
                for row in reco_movements_map[reco_id]:
                    record['movements'].append({
                        'id': str(row.movement_id),
                        'ts': row.ts,
                        'movement_delta': row.movement_delta or '0',
                        'reco_movement_delta': row.reco_movement_delta or '0',
                        'workflow_type': row.workflow_type,
                        'transfer_id': row.transfer_id,
                    })
                for row in reco_entries_map[reco_id]:
                    record['account_entries'].append({
                        'id': str(row.account_entry_id),
                        'entry_date': row.entry_date,
                        'account_delta': row.account_delta,
                    })

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

    all_shown = totals_row.rowcount == len(main_rows)
    if all_shown:
        # Take an opportunity to test the total calculations.
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
