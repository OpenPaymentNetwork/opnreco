
from decimal import Decimal
from opnreport.models.db import CircReplReco
from opnreport.models.db import Loop
from opnreport.models.db import Movement
from opnreport.models.db import MovementReco
from opnreport.models.db import now_func
from opnreport.models.db import Peer
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.param import get_request_file
from opnreport.util import check_requests_response
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.httpexceptions import HTTPNotFound
from pyramid.view import view_config
import collections
import datetime
import os
import requests
import sqlalchemy.dialects.postgresql


@view_config(
    name='transfer-record-complete',
    context=API,
    permission='use_app',
    renderer='json')
def transfer_record_complete_view(context, request):
    return transfer_record_view(context, request, complete=True)


@view_config(
    name='transfer-record',
    context=API,
    permission='use_app',
    renderer='json')
def transfer_record_view(context, request, complete=False):
    """Prepare all the info for displaying a transfer record.

    Requires a subpath of (peer_key, file_id or 'current', transfer_id).
    Note that the file specified is used only to identify which
    reconciliation records to show.

    To optimize for performance, this view should not fetch peer and
    loop titles by default. It should fetch updates when accessed
    as 'transfer-record-complete'.
    """
    file, peer, loop = get_request_file(request)

    subpath = request.subpath
    if len(subpath) < 3:
        raise HTTPBadRequest()

    transfer_id_input = request.subpath[2]
    transfer_id = transfer_id_input.replace('-', '')
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    file_peer_id = file.peer_id
    circ_replenishments = []
    is_circ_replenishment = False

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
                % transfer_id_input),
        })

    # Note: there are effectively two copies of every row in the Movement
    # table because we store a movement row for both the peer and the 'c'
    # peer. Disambiguate.
    if file_peer_id == 'c':
        movement_filter = (Movement.peer_id == 'c')
    else:
        movement_filter = (Movement.peer_id != 'c')

    movement_rows = (
        dbsession.query(Movement, MovementReco.reco_id, CircReplReco)
        .filter(movement_filter)
        .outerjoin(MovementReco, MovementReco.movement_id == Movement.id)
        .outerjoin(CircReplReco, CircReplReco.movement_id == Movement.id)
        .filter(Movement.transfer_record_id == record.id)
        .order_by(
            Movement.number,
            Movement.amount_index,
            Movement.orig_peer_id,
            Movement.loop_id,
            Movement.currency,
            Movement.issuer_id,
        ).all())

    need_peer_ids = set()
    need_loop_ids = set()
    # peer_appearance: {peer_id: [(movement_number, amount_index)]}
    peer_appearance = collections.defaultdict(list)
    to_or_from = set()  # set of peer_ids listed in to_id or from_id
    for m, _, circ_reco_id in movement_rows:
        from_id = m.from_id
        to_id = m.to_id
        issuer_id = m.issuer_id
        ids = []
        if from_id:
            ids.append(from_id)
            to_or_from.add(from_id)
        if to_id:
            ids.append(to_id)
            to_or_from.add(to_id)
        if issuer_id:
            ids.append(issuer_id)
        need_peer_ids.update(ids)
        for peer_id in ids:
            peer_appearance[peer_id].append((m.number, m.amount_index))
        need_loop_ids.add(m.loop_id)

        if circ_reco_id:
            is_circ_replenishment = True

    need_peer_ids.discard(None)
    need_peer_ids.discard(owner_id)
    need_loop_ids.discard('0')

    peer_rows = (
        dbsession.query(
            Peer.peer_id,
            Peer.title,
            Peer.username,
            Peer.is_dfi_account,
            Peer.is_circ,
        )
        .filter(
            Peer.owner_id == owner_id,
            Peer.peer_id.in_(need_peer_ids),
        ).all())

    peers = {row.peer_id: {
        'title': row.title,
        'username': row.username,
        'is_dfi_account': row.is_dfi_account,
        'is_circ': row.is_circ,
    } for row in peer_rows}

    peers[owner_id] = {
        'title': owner.title,
        'username': owner.username,
        'is_dfi_account': False,
    }

    for peer_id in need_peer_ids.difference(peers):
        peers[peer_id] = {
            'title': '[Profile %s]' % peer_id,
            'username': None,
            'is_dfi_account': False,
        }

    if complete:
        # Update all of the peers involved in this transfer.
        peers.update(fetch_peers(request, peers))

    loop_rows = (
        dbsession.query(Loop.loop_id, Loop.title)
        .filter(
            Loop.owner_id == owner_id,
            Loop.loop_id.in_(need_loop_ids),
        ).all())

    loops = {row.loop_id: {'title': row.title} for row in loop_rows}

    if complete:
        # Update all of the loops involved in this transfer.
        loops.update(fetch_loops(request, loops))

    # # De-duplicate the movement rows. There are two copies of each movement,
    # # one with peer_id == 'c', the other with peer_id == orig_peer_id.
    # # movement_dedup: {
    # #    (number, amount_index, orig_peer_id, loop_id, currency, issuer_id):
    # #    [Movement, peer_reco_id, c_reco_id, circ_reco_id]
    # # }
    # movement_dedup = {}
    # for movement, reco_id, circ_reco_id in movement_rows:
    #     key = (
    #         movement.number,
    #         movement.amount_index,
    #         movement.orig_peer_id,
    #         movement.loop_id,
    #         movement.currency,
    #         movement.issuer_id)
    #     group = movement_dedup.get(key)
    #     if group is None:
    #         movement_dedup[key] = group = [movement, None, None, None]
    #     if movement.peer_id == 'c':
    #         group[2] = reco_id
    #         if circ_reco_id:
    #             group[3] = circ_reco_id
    #             is_circ_replenishment = True
    #     else:
    #         group[1] = reco_id

    movements_json = []
    # delta_totals: {(currency, loop_id): {'circ', 'vault', 'wallet'}}
    zero = Decimal()
    delta_totals = collections.defaultdict(lambda: {
        'circ': zero,
        'vault': zero,
        'wallet': zero,
    })

    if file_peer_id == 'c':
        recipient_peer = peers.get(record.recipient_id)
        if recipient_peer is not None and recipient_peer.get('is_circ'):
            # This transfer sent acquired notes to the circulation account,
            # replenishing the circulation value.
            is_circ_replenishment = True

    for movement, reco_id, c_reco_id in movement_rows:
        number = movement.number
        amount_index = movement.amount_index
        peer_id = movement.peer_id
        loop_id = movement.loop_id
        currency = movement.currency
        issuer_id = movement.issuer_id

        if file_peer_id == 'c' or movement.peer_id == file_peer_id:
            vault_delta = movement.vault_delta
            wallet_delta = movement.wallet_delta
            reco_applicable = not not (wallet_delta or vault_delta)
        else:
            # This movement is not applicable to this file.
            vault_delta = zero
            wallet_delta = zero
            reco_applicable = False

        if reco_applicable:
            if file_peer_id != 'c':
                # When reconciling DFI accounts (instead of circulation),
                # users don't reconcile with OPN wallets.
                peer_info = peers.get(peer_id)
                if peer_info and not peer_info['is_dfi_account']:
                    reco_applicable = False

        if is_circ_replenishment:
            # When replenishing circulation, treat movements from the
            # circulating issuer's wallet to the circulation account as a
            # circulation replenishment.
            if (movement.from_id == owner_id and
                    movement.to_id == record.recipient_id and
                    issuer_id != owner_id):
                circ_replenishments.append({
                    'loop_id': loop_id,
                    'currency': currency,
                    'amount': str(movement.amount or '0'),
                    'issuer_id': issuer_id,
                    'ts': movement.ts.isoformat() + 'Z',
                    'reco_id': circ_reco_id,
                })
                delta_totals[(currency, loop_id)]['circ'] += movement.amount
                # The movement from the wallet does not apply to
                # circulation account statements.
                reco_applicable = False

        movements_json.append({
            'number': number,
            'amount_index': amount_index,
            'peer_id': peer_id,
            'loop_id': loop_id,
            'currency': currency,
            'amount': str(movement.amount or '0'),
            'issuer_id': movement.issuer_id,
            'from_id': movement.from_id,
            'to_id': movement.to_id,
            'action': movement.action,
            'ts': movement.ts.isoformat() + 'Z',
            'wallet_delta': str(wallet_delta or '0'),
            'vault_delta': str(vault_delta or '0'),
            'circ_delta': str(-vault_delta or '0'),
            'reco_applicable': not not reco_applicable,
            'reco_id': reco_id,
        })

        if vault_delta:
            delta_totals[(currency, loop_id)]['circ'] -= vault_delta
            delta_totals[(currency, loop_id)]['vault'] += vault_delta
        if wallet_delta:
            delta_totals[(currency, loop_id)]['wallet'] += wallet_delta

        if issuer_id == peer_id:
            # This peer is an issuer in this transfer.
            # (Show an issuer icon.)
            peers[peer_id]['is_issuer'] = True

    peer_ordering = []
    for peer_id, peer_info in peers.items():
        # Show the sender and recipient first, then order by first
        # appearance in the movement log and finally alphabetically.
        # This is intended to create a stable order that looks the
        # same for all owners.
        if peer_id == record.sender_id:
            sort_key = (0,)
        elif peer_id == record.recipient_id:
            sort_key = (1,)
        else:
            if peer_id not in to_or_from:
                # Don't include this peer in the order.
                continue
            title = peer_info['title']
            appearance_list = peer_appearance.get(peer_id)
            if appearance_list:
                appearance = min(appearance_list)
                sort_key = (2, appearance, title.lower(), title, peer_id)
            else:
                sort_key = (3, title.lower(), title, peer_id)
        peer_ordering.append((sort_key, peer_id))
    peer_ordering.sort()
    peer_order = [y for x, y in peer_ordering]
    peer_index = {x: i for (i, x) in enumerate(peer_order)}

    self_id = owner_id if file_peer_id == 'c' else file_peer_id

    delta_totals_json = [{
        'currency': currency1,
        'loop_id': loop_id1,
        'circ': str(deltas['circ']),
        'vault': str(deltas['vault']),
        'wallet': str(deltas['wallet']),
    } for ((currency1, loop_id1), deltas) in sorted(delta_totals.items())]

    return {
        'self_id': self_id,
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
        'peers': peers,
        'peer_order': peer_order,
        'peer_index': peer_index,
        'loops': loops,
        'delta_totals': delta_totals_json,
        'circ_replenishments': circ_replenishments,
    }


stale_delta = datetime.timedelta(seconds=60)


def fetch_peers(request, input_peers):
    """Fetch updates as necessary for all peers relevant to a request.

    Return a dict of changes.
    """
    api_url = os.environ['opn_api_url']
    owner_id = request.owner.id
    dbsession = request.dbsession

    peer_rows = (
        dbsession.query(Peer)
        .filter(
            Peer.owner_id == owner_id,
            Peer.peer_id.in_(input_peers.keys()),
        ).all())
    peer_row_map = {row.peer_id: row for row in peer_rows}

    now = dbsession.query(now_func).scalar()
    stale_time = now - stale_delta
    res = {}  # {peer_id: peer_info}

    for peer_id in sorted(input_peers.keys()):
        peer_row = peer_row_map.get(peer_id)
        if peer_row is not None:
            if peer_row.is_dfi_account:
                # There isn't a way to fetch account info yet.
                continue
            if peer_row.last_update >= stale_time:
                # No update needed.
                continue

        url = '%s/p/%s' % (api_url, peer_id)
        headers = {'Authorization': 'Bearer %s' % request.access_token}
        r = requests.get(url, headers=headers)
        if check_requests_response(r, raise_exc=False):
            fetched = True
            r_json = r.json()
            title = r_json['title']
            username = r_json['username']
        else:
            fetched = False
            title = '[Missing Profile %s]' % peer_id
            username = None

        res[peer_id] = {
            'title': title,
            'username': username,
            'is_dfi_account': False,
        }

        if peer_row is None:
            # Insert the new Peer, ignoring conflicts.
            values = {
                'owner_id': owner_id,
                'peer_id': peer_id,
                'title': title,
                'username': username,
                'is_dfi_account': False,
                'removed': False,
                'last_update': now_func,
            }
            stmt = (
                sqlalchemy.dialects.postgresql.insert(
                    Peer.__table__, bind=dbsession).values(**values)
                .on_conflict_do_nothing())
            dbsession.execute(stmt)

        else:
            # Update the Peer.
            if fetched:
                if peer_row.title != title:
                    peer_row.title = title
                if peer_row.username != username:
                    peer_row.username = username
            peer_row.last_update = now_func

    return res


def fetch_loops(request, input_loops):
    """Fetch updates as necessary for all loops relevant to a request.

    Return a dict of changes.
    """
    api_url = os.environ['opn_api_url']
    owner_id = request.owner.id
    dbsession = request.dbsession

    loop_rows = (
        dbsession.query(Loop)
        .filter(
            Loop.owner_id == owner_id,
            Loop.loop_id.in_(input_loops.keys()),
        ).all())
    loop_row_map = {row.loop_id: row for row in loop_rows}

    now = dbsession.query(now_func).scalar()
    stale_time = now - stale_delta
    res = {}  # {loop_id: loop_info}

    for loop_id in sorted(input_loops.items()):
        loop_row = loop_row_map.get(loop_id)
        if loop_row is not None:
            if loop_row.last_update >= stale_time:
                # No update needed.
                continue

        url = '%s/design/%s' % (api_url, loop_id)
        headers = {'Authorization': 'Bearer %s' % request.access_token}
        r = requests.get(url, headers=headers)
        if check_requests_response(r, raise_exc=False):
            fetched = True
            r_json = r.json()
            title = r_json['title']
        else:
            fetched = False
            title = '[Missing note design %s]' % loop_id

        res[loop_id] = {
            'title': title,
        }

        if loop_row is None:
            # Insert the new Loop, ignoring conflicts.
            values = {
                'owner_id': owner_id,
                'loop_id': loop_id,
                'title': title,
                'removed': False,
                'last_update': now_func,
            }
            stmt = (
                sqlalchemy.dialects.postgresql.insert(
                    Peer.__table__, bind=dbsession).values(**values)
                .on_conflict_do_nothing())
            dbsession.execute(stmt)

        else:
            # Update the Loop.
            if fetched:
                if loop_row.title != title:
                    loop_row.title = title
            loop_row.last_update = now_func

    return res
