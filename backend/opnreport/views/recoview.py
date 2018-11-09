
from decimal import Decimal
from opnreport.models.db import AccountEntry
from opnreport.models.db import Movement
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.param import get_request_file
from opnreport.viewcommon import get_loop_map
from opnreport.viewcommon import list_circ_peer_ids
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import or_

zero = Decimal()


@view_config(
    name='reco-complete',
    context=API,
    permission='use_app',
    renderer='json')
def reco_complete_view(context, request):
    return reco_view(context, request, complete=True)


@view_config(
    name='reco',
    context=API,
    permission='use_app',
    renderer='json')
def reco_view(context, request, complete=False):
    """Return the state of a reco or a movement proposed for a reco."""

    file, _peer, _loop = get_request_file(request)

    reco_id_input = request.params.get('reco_id')
    movement_id_input = request.params.get('movement_id')
    account_entry_id_input = request.params.get('account_entry_id')

    try:
        reco_id = int(reco_id_input) if reco_id_input else None
        movement_id = int(movement_id_input) if movement_id_input else None
        account_entry_id = (
            int(account_entry_id_input) if account_entry_id_input else None)
    except ValueError:
        raise HTTPBadRequest(json_body={
            'error': 'bad reco_id, movement_id, or account_entry_id'})

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    if reco_id is not None:
        movement_rows = (
            dbsession.query(Movement, TransferRecord.transfer_id)
            .join(
                TransferRecord,
                TransferRecord.id == Movement.transfer_record_id)
            .filter(
                Movement.owner_id == owner_id,
                or_(
                    Movement.reco_id == reco_id,
                    Movement.circ_reco_id == reco_id),
            )
            .order_by(
                Movement.ts,
                Movement.transfer_record_id,
                Movement.number,
                Movement.amount_index,
                Movement.peer_id,
                Movement.loop_id,
                Movement.currency,
                Movement.issuer_id,
            )
            .all())

        account_entry_rows = (
            dbsession.query(AccountEntry)
            .filter(
                AccountEntry.owner_id == owner_id,
                AccountEntry.reco_id == reco_id,
            )
            .order_by(
                AccountEntry.entry_date,
                AccountEntry.id,
            )
            .all())

    elif movement_id is not None:
        account_entry_rows = ()
        movement_rows = (
            dbsession.query(Movement, TransferRecord.transfer_id)
            .join(
                TransferRecord,
                TransferRecord.id == Movement.transfer_record_id)
            .filter(
                Movement.owner_id == owner_id,
                Movement.id == movement_id,
            )
            .all())

    elif account_entry_id is not None:
        movement_rows = ()
        account_entry_rows = (
            dbsession.query(AccountEntry)
            .filter(
                AccountEntry.owner_id == owner_id,
                AccountEntry.id == account_entry_id,
            )
            .all())

    else:
        movement_rows = account_entry_rows = ()

    if file.peer_id == 'c':
        # Include circulation replenishments.
        circ_peer_ids = set(list_circ_peer_ids(
            dbsession=dbsession, owner_id=owner_id))

    movements_json = []
    need_loop_ids = set()

    for movement, transfer_id in movement_rows:

        need_loop_ids.add(movement.loop_id)

        if file.peer_id == 'c':
            if (
                (reco_id is not None and movement.circ_reco_id == reco_id)
                or (
                    movement.orig_peer_id in circ_peer_ids
                    and movement.wallet_delta < zero)):
                # Circulation replenishment movement.
                delta = movement.wallet_delta
            else:
                delta = movement.vault_delta
        else:
            delta = movement.wallet_delta

        movements_json.append({
            'id': movement.id,
            'ts': movement.ts,
            'loop_id': movement.loop_id,
            'currency': movement.currency,
            'delta': delta,
            'transfer_id': transfer_id,
            'number': movement.number,
        })

    loops = get_loop_map(
        request=request,
        need_loop_ids=need_loop_ids,
        complete=complete)

    return {
        'movements': movements_json,
        'loops': loops,
    }
