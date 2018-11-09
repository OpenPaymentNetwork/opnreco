
from opnreport.models.db import AccountEntry
from opnreport.models.db import Movement
from opnreport.models.site import API
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import or_


@view_config(
    name='reco',
    context=API,
    permission='use_app',
    renderer='json')
def reco_view(context, request, complete=False):
    """Return the state of a reco or a movement proposed for a reco."""
    reco_id_input = request.params.get('reco_id')
    movement_id_input = request.params.get('movement_id')
    account_entry_id_input = request.params.get('account_entry_id')
    if (not reco_id_input
            and not movement_id_input
            and not account_entry_id_input):
        raise HTTPBadRequest(json_body={
            'error': 'reco_id, movement_id, or account_entry_id required'})

    try:
        reco_id = int(reco_id_input) if reco_id_input else None
        movement_id = int(movement_id_input) if movement_id_input else None
        account_entry_id = (
            int(account_entry_id_input) if account_entry_id_input else None)
    except ValueError:
        raise HTTPBadRequest(json_body={
            'error': 'bad input on reco_id, movement_id, or account_entry_id'})

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    if reco_id:
        movements = (
            dbsession.query(Movement)
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

        entries = (
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

    return {}
