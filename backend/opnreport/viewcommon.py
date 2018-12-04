
from decimal import Decimal
from opnreport.models.db import AccountEntry
from opnreport.models.db import File
from opnreport.models.db import Loop
from opnreport.models.db import Movement
from opnreport.models.db import now_func
from opnreport.models.db import Peer
from opnreport.util import check_requests_response
from sqlalchemy import and_
from sqlalchemy import func
import datetime
import os
import requests
import sqlalchemy.dialects.postgresql

null = None


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

        if peer_id == 'c':
            fetched = True
            title = request.owner.title
            username = request.owner.username
        else:
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


def get_peer_map(request, need_peer_ids, final):
    """Given a list of peer_ids, get a map of peers.

    Return:
    {peer_id: {'title', 'username', 'is_dfi_account', ['is_circ']}}.

    Update old peers from OPN if the 'final' param is true.
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

    if final and peers:
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


def get_loop_map(request, need_loop_ids, final=False):
    """Given a list of loop_ids, get {loop_id: {'title'}}.

    Update old loops from OPN if the 'final' param is true.
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

    if final and loops:
        # Update all of the loops involved in this transfer.
        loops.update(fetch_loops(request, loops))

    return loops


def compute_file_totals(dbsession, owner_id, file_ids):
    """Compute the balances and deltas for a set of files.

    Gets the start balances (circ, surplus, and combined) and computes:
    - reconciled_delta
    - reconciled_total
    - outstanding_delta
    - end

    Return:
    {file_id: {
        'start': {'circ', 'surplus', 'combined'},
        'reconciled_delta': {'circ', 'surplus', 'combined'},
        'reconciled_total': {'circ', 'surplus', 'combined'},
        'outstanding_delta': {'circ', 'surplus', 'combined'},
        'end': {'circ', 'surplus', 'combined'},
    }
    """
    res = {}
    zero = Decimal('0')

    # Get the file start balances.
    rows = (
        dbsession.query(
            File.id,
            File.start_circ.label('circ'),
            File.start_surplus.label('surplus'),
        )
        .filter(
            File.owner_id == owner_id,
            File.id.in_(file_ids),
        )
        .all())
    for row in rows:
        res[row.id] = {
            'start': {
                'circ': row.circ,
                'surplus': row.surplus,
                'combined': row.circ + row.surplus,
            },
            'reconciled_delta': {
                'circ': zero,
                'surplus': zero,
                'combined': zero,
            },
            'reconciled_total': {
                'circ': zero,
                'surplus': zero,
                'combined': zero,
            },
            'outstanding_delta': {
                'circ': zero,
                'surplus': zero,
                'combined': zero,
            },
            'end': {
                'circ': zero,
                'surplus': zero,
                'combined': zero,
            },
        }

    # Gather the circulation amounts from reconciled movements.
    rows = (
        dbsession.query(
            Movement.file_id,
            func.sum(-Movement.vault_delta).label('circ'),
        )
        .filter(
            Movement.owner_id == owner_id,
            Movement.reco_id != null,
            Movement.file_id.in_(file_ids),
        )
        .group_by(Movement.file_id)
        .all())
    for row in rows:
        m = res[row.file_id]['reconciled_delta']
        m['circ'] = row.circ
        # Generate initial surplus and combined values. These apply
        # only if there are no reconciled account entries.
        m['surplus'] = -row.circ
        m['combined'] = zero

    # Gather the combined amounts from reconciled account entries.
    # Compute the surplus as the difference between the reconciled
    # account entries and the reconciled movements.
    rows = (
        dbsession.query(
            AccountEntry.file_id,
            func.sum(AccountEntry.delta).label('combined'),
        )
        .filter(
            AccountEntry.owner_id == owner_id,
            AccountEntry.reco_id != null,
            AccountEntry.file_id.in_(file_ids),
        )
        .group_by(AccountEntry.file_id)
        .all())
    for row in rows:
        m = res[row.file_id]['reconciled_delta']
        m['surplus'] = row.combined - m['circ']
        m['combined'] = row.combined

    # Gather the amounts from unreconciled movements.
    rows = (
        dbsession.query(
            Movement.file_id,
            func.sum(-Movement.vault_delta).label('circ'),
            func.sum(-Movement.reco_wallet_delta).label('surplus'),
        )
        .filter(
            Movement.owner_id == owner_id,
            Movement.reco_id == null,
            Movement.file_id.in_(file_ids),
        )
        .group_by(Movement.file_id)
        .all())
    for row in rows:
        m = res[row.file_id]['outstanding_delta']
        m['circ'] = row.circ
        m['surplus'] = row.surplus
        m['combined'] = row.circ + row.surplus

    # Note that this code ignore the amounts from unreconciled account
    # entries. That's because there are two kinds of unreconciled
    # account entries, the majority of which are represented by
    # unreconciled movements that have been included in the totals
    # already. Unreconciled account entries from sources other than
    # movements will nearly always throw off the account surplus balance,
    # which should make them obvious to the people performing
    # reconciliation.

    for m in res.values():
        for k in 'circ', 'surplus', 'combined':
            reconciled_total = m['start'][k] + m['reconciled_delta'][k]
            m['reconciled_total'][k] = reconciled_total
            m['end'][k] = reconciled_total + m['outstanding_delta'][k]

    return res
