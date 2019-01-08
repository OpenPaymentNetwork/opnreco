
from decimal import Decimal
from opnreco.models.db import AccountEntry
from opnreco.models.db import Loop
from opnreco.models.db import Movement
from opnreco.models.db import Reco
from opnreco.models.db import now_func
from opnreco.models.db import OwnerLog
from opnreco.models.db import Peer
from opnreco.models.db import Period
from opnreco.util import check_requests_response
from pyramid.httpexceptions import HTTPBadRequest
from sqlalchemy import func
import datetime
import os
import requests
import sqlalchemy.dialects.postgresql

null = None


stale_delta = datetime.timedelta(seconds=60)


def get_tzname(owner):
    return owner.tzname or 'America/New_York'


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

    for loop_id in sorted(input_loops.keys()):
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
                    Loop.__table__, bind=dbsession).values(**values)
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
    need_loop_ids = set(need_loop_ids)

    if '0' in need_loop_ids:
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

    for loop_id in need_loop_ids.difference(loops):
        loops[loop_id] = {
            'title': '[Cash Design %s]' % loop_id,
        }

    if final and loops:
        # Update all of the loops involved in this transfer.
        loops.update(fetch_loops(request, loops))

    return loops


def compute_period_totals(dbsession, owner_id, period_ids):
    """Compute the balances and deltas for a set of periods.

    Gets the start balances (circ, surplus, and combined) and computes:
    - reconciled_delta
    - reconciled_total
    - outstanding_delta
    - end

    Return:
    {period_id: {
        'start': {'circ', 'surplus', 'combined'},
        'reconciled_delta': {'circ', 'surplus', 'combined'},
        'reconciled_total': {'circ', 'surplus', 'combined'},
        'outstanding_delta': {'circ', 'surplus', 'combined'},
        'end': {'circ', 'surplus', 'combined'},
    }
    """
    res = {}
    zero = Decimal('0')

    # Get the period start balances.
    rows = (
        dbsession.query(
            Period.id,
            Period.start_circ.label('circ'),
            Period.start_surplus.label('surplus'),
        )
        .filter(
            Period.owner_id == owner_id,
            Period.id.in_(period_ids),
        )
        .all())
    for row in rows:
        res[row.id] = {
            # phase: {circ, surplus, combined}
            'start': {
                'circ': row.circ,
                'surplus': row.surplus,
                'combined': row.circ + row.surplus,
            },
            'internal_reconciled_delta': {
                'circ': zero,
                'surplus': zero,
                'combined': zero,
            },
            'external_reconciled_delta': {
                'circ': zero,
                'surplus': zero,
                'combined': zero,
            },
            'reconciled_delta': {  # sum of the internal and external
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
            Movement.period_id,
            Reco.internal,
            func.sum(-Movement.vault_delta).label('circ'),
            func.sum(-Movement.reco_wallet_delta).label('surplus'),
        )
        .join(Reco, Reco.id == Movement.reco_id)
        .filter(
            Movement.owner_id == owner_id,
            Movement.reco_id != null,
            Movement.period_id.in_(period_ids),
        )
        .group_by(Movement.period_id, Reco.internal)
        .all())
    for row in rows:
        if row.internal:
            m = res[row.period_id]['internal_reconciled_delta']
            m['circ'] = row.circ
            m['surplus'] = row.surplus
            m['combined'] = row.circ + row.surplus
        else:
            # Reconciled external movements contribute only to
            # to the circulation amount. The account
            # entries will contribute to the combined value;
            # the surplus will be computed as the difference.
            m = res[row.period_id]['external_reconciled_delta']
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
            AccountEntry.period_id,
            func.sum(AccountEntry.delta).label('combined'),
        )
        .filter(
            AccountEntry.owner_id == owner_id,
            AccountEntry.reco_id != null,
            AccountEntry.period_id.in_(period_ids),
        )
        .group_by(AccountEntry.period_id)
        .all())
    for row in rows:
        m = res[row.period_id]['external_reconciled_delta']
        m['surplus'] = row.combined - m['circ']
        m['combined'] = row.combined

    # Gather the amounts from unreconciled movements.
    rows = (
        dbsession.query(
            Movement.period_id,
            func.sum(-Movement.vault_delta).label('circ'),
            func.sum(-Movement.reco_wallet_delta).label('surplus'),
        )
        .filter(
            Movement.owner_id == owner_id,
            Movement.reco_id == null,
            Movement.period_id.in_(period_ids),
        )
        .group_by(Movement.period_id)
        .all())
    for row in rows:
        m = res[row.period_id]['outstanding_delta']
        m['circ'] = row.circ
        m['surplus'] = row.surplus
        m['combined'] = row.circ + row.surplus

    # Note that this code does not include the amounts from unreconciled
    # account entries in the totals. That's because there are two kinds of
    # unreconciled account entries, the majority of which are represented by
    # unreconciled movements that have been included in the totals already.
    # Unreconciled account entries from sources other than movements will
    # nearly always throw off the account surplus balance, which should make
    # them obvious to the people performing reconciliation.

    for m in res.values():
        for k in 'circ', 'surplus', 'combined':
            internal_reconciled = m['internal_reconciled_delta'][k]
            external_reconciled = m['external_reconciled_delta'][k]
            reconciled_delta = internal_reconciled + external_reconciled
            m['reconciled_delta'][k] = reconciled_delta
            reconciled_total = m['start'][k] + reconciled_delta
            m['reconciled_total'][k] = reconciled_total
            m['end'][k] = reconciled_total + m['outstanding_delta'][k]

    return res


def get_period_for_day(period_list, day, default_endless=True):
    """Identify which open period in a list matches a day. day can be None.

    If none of them match:
    - If there is an endless period and default_endless is true,
      return the endless period.
    - Otherwise, return None.
    """
    default = None

    for p in period_list:
        start_date = p.start_date
        end_date = p.end_date

        if end_date is None and default_endless:
            # Fall back to the period with no end date.
            default = p

        if day is None:
            continue

        if start_date is not None:
            if end_date is not None:
                # Fully bounded period
                if start_date <= day and day <= end_date:
                    return p
            else:
                # The period has a start_date but no end_date.
                if start_date <= day:
                    return p
        else:
            if end_date is not None:
                # The period has an end_date but no start_date.
                if day <= end_date:
                    return p
            else:
                # The period has no start_date or end_date.
                return p

    return default


def add_open_period(request, peer_id, loop_id, currency, event_type):
    """Add a new period.

    Base it on the end date and end balances of the period with the
    newest end date.
    """
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    prev = (
        dbsession.query(Period)
        .filter(
            Period.owner_id == owner_id,
            Period.peer_id == peer_id,
            Period.loop_id == loop_id,
            Period.currency == currency,
            Period.end_date != null,
        )
        .order_by(Period.end_date.desc())
        .first())

    if prev is not None:
        next_start_date = prev.end_date + datetime.timedelta(days=1)
        if prev.closed:
            next_start_circ = prev.end_circ
            next_start_surplus = prev.end_surplus
        else:
            # Compute the previous end_circ and end_surplus.
            totals = compute_period_totals(
                dbsession=dbsession,
                owner_id=owner_id,
                period_ids=[prev.id])[prev.id]
            next_start_circ = totals['end']['circ']
            next_start_surplus = totals['end']['surplus']
    else:
        next_start_date = None
        next_start_circ = 0
        next_start_surplus = 0

    period = Period(
        owner_id=owner_id,
        peer_id=peer_id,
        loop_id=loop_id,
        currency=currency,
        start_date=next_start_date,
        start_circ=next_start_circ,
        start_surplus=next_start_surplus)
    dbsession.add(period)
    dbsession.flush()  # Assign period.id

    dbsession.add(OwnerLog(
        owner_id=owner_id,
        personal_id=request.personal_id,
        event_type=event_type,
        content={
            'period_id': period.id,
            'peer_id': peer_id,
            'loop_id': loop_id,
            'currency': currency,
            'start_date': next_start_date,
            'start_circ': next_start_circ,
            'start_surplus': next_start_surplus,
        }))

    return period


def list_assignable_periods(dbsession, owner_id, period):
    """List the periods that a reco or statement can be assigned to."""
    if period.closed:
        # The item is readonly, so don't bother showing other periods.
        period_rows = [period]
    else:
        # The item is editable, so show all open periods.
        period_rows = (
            dbsession.query(Period)
            .filter(
                Period.owner_id == owner_id,
                Period.peer_id == period.peer_id,
                Period.currency == period.currency,
                Period.loop_id == period.loop_id,
                ~Period.closed,
            )
            .order_by(Period.start_date.desc())
            .all())

    return [{
        'id': str(p.id),
        'start_date': p.start_date,
        'end_date': p.end_date,
        'closed': p.closed,
    } for p in period_rows]


def handle_invalid(e, schema):
    raise HTTPBadRequest(json_body={
        'error': 'invalid',
        'error_description': '; '.join(
            "%s (field: %s)" % (v, k)
            for (k, v) in sorted(e.asdict().items())),
    })


def configure_dblog(
        request,
        event_type=None,
        movement_event_type=None,
        account_entry_event_type=None):
    """Set variables for logging in database triggers."""
    columns = [
        func.set_config('opnreco.personal_id', request.personal_id, True),
    ]
    if movement_event_type or event_type:
        columns.append(func.set_config(
            'opnreco.movement.event_type',
            movement_event_type or event_type,
            True))
    if account_entry_event_type or event_type:
        columns.append(func.set_config(
            'opnreco.account_entry.event_type',
            account_entry_event_type or event_type,
            True))
    request.dbsession.query(*columns).one()
