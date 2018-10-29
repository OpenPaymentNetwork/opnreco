
from decimal import Decimal
from opnreport.models.db import AccountEntry
from opnreport.models.db import now_func
from opnreport.models.db import Reco
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.param import get_request_file
from opnreport.serialize import serialize_file
from opnreport.viewcommon import make_movement_cte
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

    movement_cte = make_movement_cte(
        dbsession=dbsession, file=file, owner_id=owner_id)

    movement_filter = and_(
        TransferRecord.owner_id == owner_id,
        movement_cte.c.transfer_record_id == TransferRecord.id,
        movement_cte.c.delta != 0,
    )

    # reconciled_delta is the total of reconciled DFI entries in this file.
    reconciled_delta = (
        dbsession.query(func.sum(AccountEntry.delta))
        .filter(
            AccountEntry.file_id == file_id,
            AccountEntry.reco_id != null)
        .scalar()) or 0

    now = dbsession.query(now_func).scalar()

    # workflow_type_rows lists the workflow types of movements
    # involved in this file. Derive the list from the unreconciled
    # movements and reconciled movements that require an account entry,
    # but not from the internally reconciled movements.
    workflow_type_rows = (
        dbsession.query(
            func.sign(-movement_cte.c.delta).label('sign'),
            TransferRecord.workflow_type,
        )
        .outerjoin(Reco, Reco.id == movement_cte.c.reco_id)
        .filter(
            movement_filter,
            or_(
                movement_cte.c.reco_id == null,
                ~Reco.internal,
            ))
        .group_by(
            func.sign(-movement_cte.c.delta),
            TransferRecord.workflow_type)
        .all())

    # Create workflow_types_pre: {(str(sign), workflow_type): delta}}
    workflow_types_pre = collections.defaultdict(Decimal)
    for r in workflow_type_rows:
        str_sign = str(r.sign)
        workflow_type = r.workflow_type
        workflow_types_pre[(str(r.sign), r.workflow_type)] = zero

    # outstanding_rows lists the unreconciled movements.
    # Negate the amounts because we're showing compensating amounts.
    outstanding_rows = (
        dbsession.query(
            func.sign(-movement_cte.c.delta).label('sign'),
            TransferRecord.workflow_type,
            TransferRecord.transfer_id,
            (-movement_cte.c.delta).label('delta'),
            movement_cte.c.ts,
            movement_cte.c.id,
        )
        .filter(
            movement_filter,
            movement_cte.c.reco_id == null)
        .all())

    # Create outstanding_map:
    # {str(sign): {workflow_type: [{transfer_id, delta, ts, id}]}}.
    outstanding_map = {
        '-1': collections.defaultdict(list),
        '1': collections.defaultdict(list),
    }
    for r in outstanding_rows:
        str_sign = str(r.sign)
        workflow_type = r.workflow_type
        outstanding_map[str_sign][workflow_type].append({
            'transfer_id': r.transfer_id,
            'delta': str(r.delta),
            'ts': r.ts.isoformat() + 'Z',
            'movement_id': str(r.id),
        })
        # Add the total of outstanding movements to workflow_types_pre.
        workflow_types_pre[(str_sign, workflow_type)] += r.delta

    # Convert outstanding_map from defaultdicts to dicts for JSON encoding.
    for sign, m in list(outstanding_map.items()):
        outstanding_map[sign] = dict(m)
        for lst in m.values():
            # Sort the outstanding list by timestamp.
            lst.sort(key=lambda x: x['ts'])

    # Convert workflow_types to JSON encoding:
    # {str(sign): {workflow_type: str(delta)}}
    workflow_types = {}
    for (str_sign, workflow_type), delta in workflow_types_pre.items():
        d = workflow_types.get(str_sign)
        if d is None:
            workflow_types[str_sign] = d = {}
        d[workflow_type] = str(delta) if delta else '0'

    reconciled_balance = file.start_balance + reconciled_delta
    outstanding_balance = reconciled_balance + sum(
        row.delta for row in outstanding_rows)

    return {
        'now': now,
        'file': serialize_file(file, peer, loop),
        'reconciled_balance': str(reconciled_balance),
        'outstanding_balance': str(outstanding_balance),
        'workflow_types': workflow_types,
        'outstanding_map': outstanding_map,
    }
