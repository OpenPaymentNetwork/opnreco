
from opnreport.models.db import Exchange
from opnreport.models.db import Loop
from opnreport.models.db import Movement
from opnreport.models.db import MovementReco
from opnreport.models.db import Peer
from opnreport.models.db import Reco
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.httpexceptions import HTTPNotFound
from pyramid.view import view_config


@view_config(
    name='transfer-record',
    context=API,
    permission='use_app',
    renderer='json')
def transfer_record_view(request):
    subpath = request.subpath
    if not subpath:
        raise HTTPBadRequest()

    transfer_id = request.subpath[0].replace('-', '')
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    record = (
        dbsession.query(TransferRecord)
        .filter(
            TransferRecord.owner_id == owner_id,
            TransferRecord.transfer_id == transfer_id)
        .first())

    if record is None:
        raise HTTPNotFound(json_body={
            'error': 'transfer_not_found',
            'error_description': (
                'Transfer %s is not found in your OPN Reports database.'
                % transfer_id),
        })

    movement_rows = (
        dbsession.query(Movement, Reco)
        .outerjoin(MovementReco, MovementReco.movement_id == Movement.id)
        .outerjoin(Reco, Reco.id == MovementReco.reco_id)
        .filter(Movement.transfer_record_id == record.id)
        .all())

    need_peer_ids = set()
    need_loop_ids = set()
    for m, _reco in movement_rows:
        need_peer_ids.update([m.from_id, m.to_id, m.issuer_id])
        need_loop_ids.add(m.loop_id)
    need_peer_ids.discard(None)
    need_peer_ids.discard(owner_id)
    need_loop_ids.discard('0')

    peer_rows = (
        dbsession.query(
            Peer.peer_id,
            Peer.title,
            Peer.username,
            Peer.is_dfi_account,
        )
        .filter(
            Peer.owner_id == owner_id,
            Peer.peer_id.in_(need_peer_ids),
        ).all())

    peers = {row.peer_id: {
        'title': row.title,
        'username': row.username,
        'is_dfi_account': row.is_dfi_account,
    } for row in peer_rows}

    peers[owner_id] = {
        'title': owner.title,
        'username': owner.username,
        'is_dfi_account': False,
    }

    for peer_id in need_peer_ids.difference(peers):
        peers[peer_id] = {
            'title': '[Missing profile %s]' % peer_id,
            'username': None,
            'is_dfi_account': False,
        }

    peer_ordering = []
    for peer_id, peer_info in peers.items():
        if peer_id == owner_id:
            sort_key = (0,)
        else:
            title = peer_info['title']
            sort_key = (1, title.lower(), title, peer_id)
        peer_ordering.append((sort_key, peer_id))
    peer_ordering.sort()
    peer_order = [y for x, y in peer_ordering]
    peer_index = {x: i for (i, x) in enumerate(peer_order)}

    loop_rows = (
        dbsession.query(Loop.loop_id, Loop.title)
        .filter(
            Loop.owner_id == owner_id,
            Loop.loop_id.in_(need_loop_ids),
        ).all())

    loops = {row.loop_id: {'title': row.title} for row in loop_rows}

    # Create movement_groups in order to unite the doubled movement
    # rows into a single row.
    # movement_groups: {
    #    (number, orig_peer_id, loop_id, currency, issuer_id):
    #    [Movement, peer_reco, c_reco]
    # }
    movement_groups = {}
    for movement, reco in movement_rows:
        key = (
            movement.number,
            movement.orig_peer_id,
            movement.loop_id,
            movement.currency,
            movement.issuer_id)
        group = movement_groups.get(key)
        if group is None:
            movement_groups[key] = group = [movement, None, None]
        if movement.peer_id == 'c':
            group[2] = reco
        else:
            group[1] = reco

    def reco_to_json(r):
        if r is None:
            return {}
        return {
            'id': str(r.id),
            'auto': r.auto,
            'auto_edited': r.auto_edited,
        }

    movements_json = []
    for key, group in sorted(movement_groups.items()):
        number, peer_id, loop_id, currency, issuer_id = key
        movement, peer_reco, c_reco = group
        movements_json.append({
            'number': number,
            'peer_id': peer_id,
            'loop_id': loop_id,
            'currency': currency,
            'amount': str(movement.amount),
            'issuer_id': movement.issuer_id,
            'from_id': movement.from_id,
            'to_id': movement.to_id,
            'action': movement.action,
            'ts': movement.ts.isoformat() + 'Z',
            'wallet_delta': str(movement.wallet_delta),
            'vault_delta': str(movement.vault_delta),
            'peer_reco': reco_to_json(peer_reco),
            'c_reco': reco_to_json(c_reco),
        })

    exchange_rows = (
        dbsession.query(Exchange, Reco)
        .outerjoin(Reco, Reco.id == Exchange.reco_id)
        .filter(Exchange.transfer_record_id == record.id)
        .order_by(Exchange.id)
        .all())

    exchanges_json = []
    for exchange, reco in exchange_rows:
        exchanges_json.append({
            'wallet_delta': str(exchange.wallet_delta),
            'vault_delta': str(exchange.vault_delta),
            'reco': reco_to_json(reco),
        })

    return {
        'workflow_type': record.workflow_type,
        'start': record.start.isoformat() + 'Z',
        'timestamp': record.timestamp.isoformat() + 'Z',
        'currency': record.currency,
        'amount': str(record.amount),
        'next_activity': record.next_activity,
        'completed': record.completed,
        'canceled': record.canceled,
        'sender_id': record.sender_id,
        'sender_uid': record.sender_uid,
        'recipient_id': record.recipient_id,
        'recipient_uid': record.recipient_uid,
        'movements': movements_json,
        'exchanges': exchanges_json,
        'peers': peers,
        'peer_order': peer_order,
        'peer_index': peer_index,
        'loops': loops,
    }
