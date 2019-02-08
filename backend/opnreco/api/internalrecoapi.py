
from decimal import Decimal
from opnreco.models import perms
from opnreco.models.db import Movement
from opnreco.models.db import now_func
from opnreco.models.db import Reco
from opnreco.models.db import TransferRecord
from opnreco.models.site import PeriodResource
from opnreco.param import get_offset_limit
from pyramid.view import view_config
from sqlalchemy import BigInteger
from sqlalchemy import cast
from sqlalchemy import func
from sqlalchemy import String
import collections


null = None
zero = Decimal()


@view_config(
    name='internal',
    context=PeriodResource,
    permission=perms.view_period,
    renderer='json')
def internal_recos_api(context, request):
    """Get a page listing some of the internal recos for a period."""
    period_id = context.period.id
    params = request.params
    offset, limit = get_offset_limit(params)

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    ts_c = (
        dbsession.query(func.min(Movement.ts))
        .filter(Movement.reco_id == Reco.id)
        .correlate(Reco)
        .as_scalar()
        .label('ts')
    )

    vault_delta_c = (
        dbsession.query(func.sum(Movement.vault_delta))
        .filter(Movement.reco_id == Reco.id)
        .correlate(Reco)
        .as_scalar()
        .label('vault_delta')
    )

    wallet_delta_c = (
        dbsession.query(func.sum(Movement.wallet_delta))
        .filter(Movement.reco_id == Reco.id)
        .correlate(Reco)
        .as_scalar()
        .label('wallet_delta')
    )

    movement_count_c = (
        dbsession.query(func.count(Movement.id))
        .filter(Movement.reco_id == Reco.id)
        .correlate(Reco)
        .as_scalar()
        .label('movement_count')
    )

    # List the internal reconciliations in the period.
    # Since recos can contain any number of account entries and movements,
    # list just the reco IDs, delta totals, and dates. Get the reco-specific
    # account entries and movements after ordering and pagination.
    query = (
        dbsession.query(
            Reco.id.label('reco_id'),
            cast(None, BigInteger).label('movement_id'),
            ts_c,
            vault_delta_c,
            wallet_delta_c,
            cast(None, String).label('workflow_type'),
            cast(None, String).label('transfer_id'),
        )
        .filter(
            Reco.owner_id == owner_id,
            Reco.period_id == period_id,
            Reco.internal,
            movement_count_c > 0,
        )
    )

    total_cte = query.cte('total_cte')
    totals_row = (
        dbsession.query(
            now_func.label('now'),
            func.count(1).label('rowcount'),
            func.sum(total_cte.c.vault_delta).label('vault_delta'),
            func.sum(total_cte.c.wallet_delta).label('wallet_delta'),
        ).one())
    all_totals = {
        'vault_delta': totals_row.vault_delta or zero,
        'wallet_delta': totals_row.vault_delta or zero,
    }

    subq = query.subquery('subq')
    main_rows_query = (
        dbsession.query(subq)
        .order_by(
            subq.c.ts,
            subq.c.reco_id,
        )
        .offset(offset)
    )
    if limit is not None:
        main_rows_query = main_rows_query.limit(limit)
    main_rows = main_rows_query.all()

    # Now main_rows contains the rows for the table.

    query_reco_ids = [r.reco_id for r in main_rows if r.reco_id is not None]
    # reco_movements_map: {reco_id: [Movement]}
    reco_movements_map = collections.defaultdict(list)

    if query_reco_ids:
        # Most of the rows contain multiple movements.
        # Fill reco_movements_map.
        rows = (
            dbsession.query(
                Movement.reco_id,
                Movement.id.label('movement_id'),
                Movement.ts,
                Movement.vault_delta,
                Movement.wallet_delta,
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

    page_records = []
    page_totals = {'vault_delta': zero, 'wallet_delta': zero}

    for main_row in main_rows:
        movement_id = main_row.movement_id
        reco_id = main_row.reco_id
        record = {
            'reco_id': str(reco_id),
            'movement_id': (
                None if movement_id is None
                else str(movement_id)),
            'movements': [],
        }

        for row in reco_movements_map[reco_id]:
            record['movements'].append({
                'id': str(row.movement_id),
                'ts': row.ts,
                'vault_delta': row.vault_delta or '0',
                'wallet_delta': row.wallet_delta or '0',
                'workflow_type': row.workflow_type,
                'transfer_id': row.transfer_id,
            })

        page_records.append(record)
        if main_row.vault_delta:
            page_totals['vault_delta'] += main_row.vault_delta
        if main_row.wallet_delta:
            page_totals['wallet_delta'] += main_row.wallet_delta

    all_shown = totals_row.rowcount == len(main_rows)

    return {
        'now': totals_row.now,
        'rowcount': totals_row.rowcount,
        'all_shown': all_shown,
        'records': page_records,
        'totals': {
            'page': page_totals,
            'all': all_totals,
        },
        'show_vault': context.period.has_vault,
    }
