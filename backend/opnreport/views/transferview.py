
from decimal import Decimal
from opnreport.models.db import Exchange
from opnreport.models.db import Loop
from opnreport.models.db import Movement
from opnreport.models.db import MovementReco
from opnreport.models.db import now_func
from opnreport.models.db import Peer
from opnreport.models.db import Reco
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
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

    Does not fetch peer and loop info by default, for speed.
    Fetches updates when accessed as 'transfer-record-complete'.
    """
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
    vault_delta_totals = collections.defaultdict(Decimal)
    wallet_delta_totals = collections.defaultdict(Decimal)

    for key, group in sorted(movement_groups.items()):
        number, peer_id, loop_id, currency, issuer_id = key
        movement, peer_reco, c_reco = group
        movements_json.append({
            'number': number,
            'peer_id': peer_id,
            'loop_id': loop_id,
            'currency': currency,
            'amount': str(movement.amount or '0'),
            'issuer_id': movement.issuer_id,
            'from_id': movement.from_id,
            'to_id': movement.to_id,
            'action': movement.action,
            'ts': movement.ts.isoformat() + 'Z',
            'wallet_delta': str(movement.wallet_delta or '0'),
            'vault_delta': str(movement.vault_delta or '0'),
            'peer_reco': reco_to_json(peer_reco),
            'c_reco': reco_to_json(c_reco),
        })

        if movement.vault_delta:
            vault_delta_totals[currency] += movement.vault_delta
        if movement.wallet_delta:
            wallet_delta_totals[currency] += movement.wallet_delta

        if movement.issuer_id == peer_id:
            # This peer is an issuer in this transfer.
            peers[peer_id]['is_issuer'] = True

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

    peer_ordering = []
    for peer_id, peer_info in peers.items():
        # Show the sender and recipient first, followed by the issuers,
        # everyone else (alphabetically), and finally the owner profile
        # (if not already shown earlier).
        if peer_id == record.sender_id:
            sort_key = (0,)
        elif peer_id == record.recipient_id:
            sort_key = (1,)
        elif peer_info.get('is_issuer'):
            title = peer_info['title']
            sort_key = (2, title.lower(), title, peer_id)
        elif peer_id == owner_id:
            sort_key = (4,)
        else:
            title = peer_info['title']
            sort_key = (3, title.lower(), title, peer_id)
        peer_ordering.append((sort_key, peer_id))
    peer_ordering.sort()
    peer_order = [y for x, y in peer_ordering]
    peer_index = {x: i for (i, x) in enumerate(peer_order)}

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
        'vault_delta_totals': dict(vault_delta_totals),
        'wallet_delta_totals': dict(wallet_delta_totals),
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
