
from decimal import Decimal
from opnreport.models.db import AccountEntry
from opnreport.models.db import AccountEntryReco
from opnreport.models.db import Exchange
from opnreport.models.db import Movement
from opnreport.models.db import MovementReco
from opnreport.models.db import Reco
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.param import get_request_file
from opnreport.serialize import serialize_file
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

    if file.peer_id == 'c':
        movement_delta_c = Movement.vault_delta
        exchange_delta_c = Exchange.vault_delta
    else:
        movement_delta_c = Movement.wallet_delta
        exchange_delta_c = Exchange.wallet_delta

    file_id = file.id
    dbsession = request.dbsession
    owner_id = request.owner.id

    movement_filter = and_(
        TransferRecord.owner_id == owner_id,
        Movement.transfer_record_id == TransferRecord.id,
        Movement.peer_id == file.peer_id,
        Movement.loop_id == file.loop_id,
        Movement.currency == file.currency,
        movement_delta_c != 0,
    )

    # reconciled_delta is the total of reconciled DFI entries in this file.
    reconciled_delta = (
        dbsession.query(func.sum(AccountEntry.delta))
        .join(
            AccountEntryReco,
            AccountEntryReco.account_entry_id == AccountEntry.id)
        .filter(AccountEntry.file_id == file_id)
        .scalar()) or 0

    include_unreconciled = file.current

    # workflow_type_rows lists the workflow types of movements
    # involved in this file. Include manually
    # reconciled movements, but not the effects of automatically
    # reconciled movements. Include unreconciled movements if
    # looking at a 'current' file.
    if include_unreconciled:
        reco_filter = or_(Reco.file_id == null, Reco.file_id == file_id)
    else:
        reco_filter = (Reco.file_id == file_id)
    workflow_type_rows = (
        dbsession.query(
            func.sign(-movement_delta_c).label('sign'),
            TransferRecord.workflow_type,
        )
        .outerjoin(MovementReco, MovementReco.movement_id == Movement.id)
        .outerjoin(Reco, Reco.id == MovementReco.reco_id)
        .filter(
            movement_filter,
            reco_filter,
            or_(Reco.auto == null, ~Reco.auto))
        .group_by(
            func.sign(-movement_delta_c),
            TransferRecord.workflow_type)
        .all())

    # Create workflow_types_pre: {(str(sign), workflow_type): delta}}
    workflow_types_pre = collections.defaultdict(Decimal)
    for r in workflow_type_rows:
        str_sign = str(r.sign)
        workflow_type = r.workflow_type
        workflow_types_pre[(str(r.sign), r.workflow_type)] = zero

    if include_unreconciled:
        # outstanding_rows lists the movements not yet reconciled.
        # Negate the amounts because we're showing compensating amounts.
        outstanding_rows = (
            dbsession.query(
                func.sign(-movement_delta_c).label('sign'),
                TransferRecord.workflow_type,
                TransferRecord.transfer_id,
                (-movement_delta_c).label('delta'),
                TransferRecord.start,
                Movement.id,
            )
            .outerjoin(MovementReco, MovementReco.movement_id == Movement.id)
            .filter(
                movement_filter,
                MovementReco.reco_id == null)
            .all())

        # exchange_rows lists the exchanges not yet reconciled.
        # Don't negate the amounts.
        exchange_rows = (
            dbsession.query(
                func.sign(exchange_delta_c).label('sign'),
                TransferRecord.transfer_id,
                exchange_delta_c.label('delta'),
                TransferRecord.start,
                Exchange.id,
            )
            .filter(
                TransferRecord.owner_id == owner_id,
                Exchange.transfer_record_id == TransferRecord.id,
                Exchange.peer_id == file.peer_id,
                Exchange.loop_id == file.loop_id,
                Exchange.currency == file.currency,
                exchange_delta_c != 0,
                Exchange.reco_id == null)
            .all())

    else:
        outstanding_rows = ()
        exchange_rows = ()

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
            'ts': r.start.isoformat() + 'Z',
            'id': str(r.id),
        })
        # Add the total of outstanding movements to workflow_types_pre.
        workflow_types_pre[(str_sign, workflow_type)] += r.delta

    # Add the exchanges to outstanding_map and workflow_types_pre.
    for r in exchange_rows:
        str_sign = str(r.sign)
        workflow_type = '_exchange'
        outstanding_map[str_sign][workflow_type].append({
            'transfer_id': r.transfer_id,
            'delta': str(r.delta),
            'ts': r.start.isoformat() + 'Z',
            'id': str(r.id),
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
        'file': serialize_file(file, peer, loop),
        'reconciled_balance': str(reconciled_balance),
        'outstanding_balance': str(outstanding_balance),
        'workflow_types': workflow_types,
        'outstanding_map': outstanding_map,
    }
