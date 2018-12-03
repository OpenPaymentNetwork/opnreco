
from decimal import Decimal
from opnreport.models.db import Movement
from opnreport.models.db import now_func
from opnreport.models.db import Reco
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.param import get_request_file
from opnreport.viewcommon import compute_file_totals
from pyramid.view import view_config
from sqlalchemy import and_
from sqlalchemy import func
from sqlalchemy import or_
import collections

null = None
zero = Decimal()


@view_config(
    name='reco-report',
    context=API,
    permission='use_app',
    renderer='json')
def reco_report_view(request):
    file, peer, loop = get_request_file(request)

    file_id = file.id
    dbsession = request.dbsession
    owner_id = request.owner.id

    movement_delta = -(Movement.wallet_delta + Movement.vault_delta)

    movement_filter = and_(
        Movement.owner_id == owner_id,
        Movement.file_id == file_id,
        Movement.transfer_record_id == TransferRecord.id,
        movement_delta != 0,
    )

    now = dbsession.query(now_func).scalar()

    # workflow_type_rows lists the workflow types of movements
    # involved in this file. Derive the list from the unreconciled
    # movements and reconciled movements that require an account entry,
    # but not from the internally reconciled movements.
    workflow_type_rows = (
        dbsession.query(
            func.sign(movement_delta).label('sign'),
            TransferRecord.workflow_type,
        )
        .outerjoin(Reco, Reco.id == Movement.reco_id)
        .filter(
            movement_filter,
            or_(
                Movement.reco_id == null,
                ~Reco.internal,
            ))
        .group_by(
            func.sign(movement_delta),
            TransferRecord.workflow_type)
        .all())

    str_signs = {-1: '-1', 1: '1'}

    # Create workflow_types_pre:
    # {(str(sign), workflow_type): (circ, surplus, combined)}}
    workflow_types_pre = collections.defaultdict(Decimal)
    for r in workflow_type_rows:
        str_sign = str_signs[r.sign]
        workflow_type = r.workflow_type
        workflow_types_pre[(str(r.sign), r.workflow_type)] = (zero, zero, zero)

    # outstanding_rows lists the unreconciled movements.
    # Negate the amounts because we're showing compensating amounts.
    outstanding_rows = (
        dbsession.query(
            func.sign(movement_delta).label('sign'),
            TransferRecord.workflow_type,
            TransferRecord.transfer_id,
            (-Movement.vault_delta).label('circ_delta'),
            (-Movement.reco_wallet_delta).label('surplus_delta'),
            Movement.ts,
            Movement.id,
        )
        .filter(
            movement_filter,
            Movement.reco_id == null)
        .all())

    # Create outstanding_map:
    # {str(sign): {workflow_type: [{transfer_id, delta, ts, id}]}}.
    outstanding_map = {
        '-1': collections.defaultdict(list),
        '1': collections.defaultdict(list),
    }

    for r in outstanding_rows:
        str_sign = str_signs[r.sign]
        workflow_type = r.workflow_type
        circ_delta = r.circ_delta
        surplus_delta = r.surplus_delta
        combined_delta = circ_delta + surplus_delta
        outstanding_map[str_sign][workflow_type].append({
            'transfer_id': r.transfer_id,
            'circ': str(circ_delta) if circ_delta else '0',
            'surplus': str(surplus_delta) if surplus_delta else '0',
            'combined': str(combined_delta) if combined_delta else '0',
            'ts': r.ts.isoformat() + 'Z',
            'movement_id': str(r.id),
        })
        # Add the deltas to workflow_types_pre.
        cd0, sd0, td0 = workflow_types_pre[(str_sign, workflow_type)]
        workflow_types_pre[(str_sign, workflow_type)] = (
            cd0 + circ_delta,
            sd0 + surplus_delta,
            td0 + combined_delta)

    # # Include the effects of unreconciled account entries.
    # unreco_entry_rows = (
    #     dbsession.query(
    #         func.sign(AccountEntry.delta).label('sign'),
    #         func.sum(AccountEntry.delta).label('delta'),
    #     )
    #     .filter(
    #         AccountEntry.owner_id == owner_id,
    #         AccountEntry.file_id == file_id,
    #         AccountEntry.reco_id == null,
    #         AccountEntry.delta != zero,
    #     )
    #     .group_by(func.sign(AccountEntry.delta))
    #     .all())

    # for sign, delta in unreco_entry_rows:
    #     str_sign = str_signs[sign]
    #     workflow_type = '_account_credit' if sign > 0 else '_account_debit'
    #     workflow_types_pre[(str_sign, workflow_type)] = (
    #         zero,
    #         delta,
    #         delta,
    #     )

    # Convert outstanding_map from defaultdicts to dicts for JSON encoding.
    for sign, m in list(outstanding_map.items()):
        outstanding_map[sign] = dict(m)
        for lst in m.values():
            # Sort the outstanding list by timestamp.
            lst.sort(key=lambda x: x['ts'])

    # Convert workflow_types to JSON encoding:
    # {str(sign): {workflow_type: {'circ', 'surplus', 'combined'}}}
    workflow_types = {}
    for (str_sign, workflow_type), deltas in workflow_types_pre.items():
        d = workflow_types.get(str_sign)
        if d is None:
            workflow_types[str_sign] = d = {}
        cd, sd, td = deltas
        d[workflow_type] = {
            'circ': str(cd) if cd else '0',
            'surplus': str(sd) if sd else '0',
            'combined': str(td) if td else '0',
        }

    totals = compute_file_totals(
        dbsession=dbsession,
        owner_id=owner_id,
        file_ids=[file_id])[file_id]

    return {
        'now': now,
        'reconciled_totals': totals['reconciled_total'],
        'outstanding_totals': totals['end'],
        'workflow_types': workflow_types,
        'outstanding_map': outstanding_map,
    }
