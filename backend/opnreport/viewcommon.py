
from opnreport.models.db import Loop
from opnreport.models.db import Movement
from opnreport.models.db import now_func
from opnreport.models.db import Peer
from opnreport.util import check_requests_response
from sqlalchemy import and_
from sqlalchemy import case
from sqlalchemy import or_
import datetime
import os
import requests
import sqlalchemy.dialects.postgresql

null = None


def list_circ_peer_ids(dbsession, owner_id):
    """List the circulation peer IDs for an owner.

    (Note that the number of circ peers is always expected to be
    zero, one, or a small number.)
    """
    circ_peer_id_rows = (
        dbsession.query(Peer.peer_id)
        .filter(
            Peer.owner_id == owner_id,
            Peer.is_circ)
        .all())

    return [x for (x,) in circ_peer_id_rows]


def make_movement_cte(dbsession, file, owner_id):
    """Create a common table expression (CTE) that lists movements in a file.

    Makes circulation replenishment movements look like normal movements.
    """
    if file.peer_id == 'c':
        # Include circulation replenishments.

        circ_peer_ids = list_circ_peer_ids(
            dbsession=dbsession, owner_id=owner_id)

        # is_circ_repl is true for movements that are circulation
        # replenishments.
        is_circ_repl = or_(
            Movement.circ_reco_id != null,
            and_(
                Movement.orig_peer_id.in_(circ_peer_ids),
                Movement.wallet_delta < 0))

        movement_delta_c = case([
            (is_circ_repl, Movement.wallet_delta),
        ], else_=Movement.vault_delta)

        reco_id_c = case([
            (is_circ_repl, Movement.circ_reco_id),
        ], else_=Movement.reco_id)

    else:
        # Simple case: no circulation replenishment is possible,
        # so just list the movements.
        movement_delta_c = Movement.wallet_delta
        reco_id_c = Movement.reco_id

    return (
        dbsession.query(
            Movement.id,
            movement_delta_c.label('delta'),
            Movement.ts,
            reco_id_c.label('reco_id'),
            Movement.transfer_record_id,
        )
        .filter(
            Movement.owner_id == owner_id,
            Movement.file_id == file.id,
            # The peer_id, loop_id, and currency conditions are redudandant,
            # but they might help avoid accidents.
            Movement.peer_id == file.peer_id,
            Movement.loop_id == file.loop_id,
            Movement.currency == file.currency,
        ).cte('movement_cte'))


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


def get_peer_map(request, need_peer_ids, complete):
    """Given a list of peer_ids, get a map of peers.

    Return:
    {peer_id: {'title', 'username', 'is_dfi_account', ['is_circ']}}.

    Update old peers from OPN if the 'complete' param is true.
    """
    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession

    if (None in need_peer_ids or
            '' in need_peer_ids or
            owner_id in need_peer_ids):
        need_peer_ids = set(need_peer_ids).difference([
            None,
            '',
            owner_id,
        ])

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

    return peers


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


def get_loop_map(request, need_loop_ids, complete=False):
    """Given a list of loop_ids, get {loop_id: {'title'}}.

    Update old loops from OPN if the 'complete' param is true.
    """
    if '0' in need_loop_ids:
        need_loop_ids = set(need_loop_ids)
        need_loop_ids.discard('0')

    owner_id = request.owner.id
    dbsession = request.dbsession

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

    return loops
