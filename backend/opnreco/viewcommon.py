import datetime
import os
from decimal import Decimal
from typing import Sequence, TypedDict

import requests
import sqlalchemy.dialects.postgresql
from colander import Invalid
from opnreco.models.db import (
    AccountEntry,
    FileMovement,
    Loop,
    Owner,
    OwnerLog,
    Peer,
    Period,
    Reco,
    now_func,
)
from opnreco.util import check_requests_response
from pyramid.httpexceptions import HTTPBadRequest
from sqlalchemy import func, literal

null = None


stale_delta = datetime.timedelta(seconds=60)


def get_tzname(owner):
    return owner.tzname or "America/New_York"


class PeerInfo(TypedDict):
    title: str
    username: str | None
    is_dfi_account: bool


def _fetch_peers(request, input_peer_ids: Sequence[str]) -> dict[str, PeerInfo]:
    """Fetch updates as necessary for all peers relevant to a request.

    Return a dict of changes.
    """
    api_url = os.environ["opn_api_url"]
    owner_id = request.owner.id
    dbsession = request.dbsession

    peer_rows: Sequence[Peer] = (
        dbsession.query(Peer)
        .filter(
            Peer.owner_id == owner_id,
            Peer.peer_id.in_(input_peer_ids),
        )
        .all()
    )
    peer_row_map: dict[str, Peer] = {row.peer_id: row for row in peer_rows}  # type: ignore

    now = dbsession.query(now_func).scalar()
    stale_time = now - stale_delta
    res: dict[str, PeerInfo] = {}  # {peer_id: peer_info}

    for peer_id in sorted(input_peer_ids):
        peer_row = peer_row_map.get(peer_id)
        if peer_row is not None:
            if peer_row.is_dfi_account:
                # There isn't a way to fetch account info yet.
                continue
            if peer_row.last_update >= stale_time:
                # No update needed.
                continue

        if peer_id == "c":
            fetched = True
            title = request.owner.title
            username = request.owner.username
        else:
            url = "%s/p/%s" % (api_url, peer_id)
            headers = {"Authorization": "Bearer %s" % request.access_token}
            r = requests.get(url, headers=headers)
            if check_requests_response(r, raise_exc=False):
                fetched = True
                r_json = r.json()
                title = r_json["title"]
                username = r_json["username"]
            else:
                fetched = False
                title = "[Missing Profile %s]" % peer_id
                username = None

        res[peer_id] = {
            "title": title,
            "username": username,
            "is_dfi_account": False,
        }

        if peer_row is None:
            # Insert the new Peer, ignoring conflicts.
            values = {
                "owner_id": owner_id,
                "peer_id": peer_id,
                "title": title,
                "username": username,
                "is_dfi_account": False,
                "removed": False,
                "last_update": now_func,
            }
            stmt = (
                sqlalchemy.dialects.postgresql.insert(Peer.__table__, bind=dbsession)
                .values(**values)
                .on_conflict_do_nothing()
            )
            dbsession.execute(stmt)

        else:
            # Update the Peer.
            if fetched:
                if peer_row.title != title:
                    peer_row.title = title  # type: ignore
                if peer_row.username != username:
                    peer_row.username = username  # type: ignore
            peer_row.last_update = now_func

    return res


def get_peer_map(
    request, need_peer_ids: set[str | None], final: bool
) -> dict[str, PeerInfo]:
    """Given a list of peer_ids, get a map of peers.

    Return:
    {peer_id: {'title', 'username', 'is_dfi_account'}}.

    Update old peers from OPN if the 'final' param is true.
    """
    owner: Owner = request.owner
    owner_id: str = owner.id  # type: ignore
    dbsession = request.dbsession

    # Filter out None, empty peer IDs, and the owner peer
    need_filtered: set[str] = set(need_peer_ids).difference(  # type: ignore
        [
            None,
            "",
            owner_id,
        ]
    )

    class PeerRow:
        peer_id: str
        title: str
        username: str
        is_dfi_account: bool

    peer_rows: Sequence[PeerRow] = (
        dbsession.query(
            Peer.peer_id,
            Peer.title,
            Peer.username,
            Peer.is_dfi_account,
        )
        .filter(
            Peer.owner_id == owner_id,
            Peer.peer_id.in_(need_filtered),
        )
        .all()
    )

    peers: dict[str, PeerInfo] = {
        row.peer_id: {
            "title": row.title,
            "username": row.username,
            "is_dfi_account": row.is_dfi_account,
        }
        for row in peer_rows
    }

    peers[owner_id] = {  # type: ignore
        "title": owner.title,
        "username": owner.username,
        "is_dfi_account": False,
    }

    for peer_id in need_filtered.difference(peers):
        peers[peer_id] = {
            "title": "[Profile %s]" % peer_id,
            "username": None,
            "is_dfi_account": False,
        }

    if final and peers:
        # Update all of the peers involved in this transfer.
        peers.update(_fetch_peers(request, list(peers.keys())))

    return peers


class LoopInfo(TypedDict):
    title: str


def _fetch_loops(request, input_loop_ids: Sequence[str]) -> dict[str, LoopInfo]:
    """Fetch updates as necessary for all loops relevant to a request.

    Return a dict of changes.
    """
    api_url = os.environ["opn_api_url"]
    owner_id = request.owner.id
    dbsession = request.dbsession

    loop_rows: Sequence[Loop] = (
        dbsession.query(Loop)
        .filter(
            Loop.owner_id == owner_id,
            Loop.loop_id.in_(input_loop_ids),
        )
        .all()
    )
    loop_row_map: dict[str, Loop] = {row.loop_id: row for row in loop_rows}  # type: ignore

    now = dbsession.query(now_func).scalar()
    stale_time = now - stale_delta
    res: dict[str, LoopInfo] = {}  # {loop_id: loop_info}

    for loop_id in sorted(input_loop_ids):
        loop_row = loop_row_map.get(loop_id)
        if loop_row is not None:
            if loop_row.last_update >= stale_time:
                # No update needed.
                continue

        url = "%s/design/%s" % (api_url, loop_id)
        headers = {"Authorization": "Bearer %s" % request.access_token}
        r = requests.get(url, headers=headers)
        if check_requests_response(r, raise_exc=False):
            fetched = True
            r_json = r.json()
            title = r_json["title"]
        else:
            fetched = False
            title = "[Missing note design %s]" % loop_id

        res[loop_id] = {
            "title": title,
        }

        if loop_row is None:
            # Insert the new Loop, ignoring conflicts.
            values = {
                "owner_id": owner_id,
                "loop_id": loop_id,
                "title": title,
                "removed": False,
                "last_update": now_func,
            }
            stmt = (
                sqlalchemy.dialects.postgresql.insert(Loop.__table__, bind=dbsession)
                .values(**values)
                .on_conflict_do_nothing()
            )
            dbsession.execute(stmt)

        else:
            # Update the Loop.
            if fetched:
                if loop_row.title != title:
                    loop_row.title = title  # type: ignore
            loop_row.last_update = now_func

    return res


def get_loop_map(
    request,
    need_loop_ids: Sequence[str] | set[str],
    final=False,
) -> dict[str, LoopInfo]:
    """Given a list of loop_ids, get {loop_id: {'title': '...'}}.

    Update old loops from OPN if the 'final' param is true.
    """
    need_set = set(need_loop_ids)

    if "0" in need_set:
        need_set.discard("0")

    owner_id = request.owner.id
    dbsession = request.dbsession

    class LoopInfoRow:
        loop_id: str
        title: str

    loop_rows: Sequence[LoopInfoRow] = (
        dbsession.query(Loop.loop_id, Loop.title)
        .filter(
            Loop.owner_id == owner_id,
            Loop.loop_id.in_(need_set),
        )
        .all()
    )

    loops: dict[str, LoopInfo] = {
        row.loop_id: {"title": row.title} for row in loop_rows
    }

    for loop_id in need_set.difference(loops):
        loops[loop_id] = {
            "title": "[Cash Design %s]" % loop_id,
        }

    if final and loops:
        # Update all of the loops involved in this transfer.
        loops.update(_fetch_loops(request, list(loops.keys())))

    return loops


class PhaseTotals(TypedDict):
    circ: Decimal
    surplus: Decimal
    combined: Decimal


class PeriodTotals(TypedDict):
    start: PhaseTotals
    internal_reconciled_delta: PhaseTotals
    external_reconciled_delta: PhaseTotals
    reconciled_delta: PhaseTotals
    reconciled_total: PhaseTotals
    unreco_movements_delta: PhaseTotals
    unreco_entries_delta: PhaseTotals
    end: PhaseTotals


def compute_period_totals(
    dbsession, owner_id: str, period_ids: Sequence[int]
) -> dict[int, PeriodTotals]:
    """Compute the balances and deltas for a set of periods.

    Gets the start balances (circ, surplus, and combined) and computes totals.

    Return:
    {period_id: {
        'start': {'circ', 'surplus', 'combined'},
        'internal_reconciled_delta': {'circ', 'surplus', 'combined'},
        'external_reconciled_delta': {'circ', 'surplus', 'combined'},
        'reconciled_delta': {'circ', 'surplus', 'combined'},
        'reconciled_total': {'circ', 'surplus', 'combined'},
        'unreco_movements_delta': {'circ', 'surplus', 'combined'},
        'unreco_entries_delta': {'circ', 'surplus', 'combined'},
        'end': {'circ', 'surplus', 'combined'},
    }
    """
    res: dict[int, PeriodTotals] = {}
    zero = Decimal("0")

    # Get the period start balances.
    class PeriodInfoRow:
        id: int
        circ: Decimal
        surplus: Decimal

    rows0: Sequence[PeriodInfoRow] = (
        dbsession.query(
            Period.id,
            Period.start_circ.label("circ"),
            Period.start_surplus.label("surplus"),
        )
        .filter(
            Period.owner_id == owner_id,
            Period.id.in_(period_ids),
        )
        .all()
    )
    for row in rows0:
        period_totals: PeriodTotals = {
            # phase: {circ, surplus, combined}
            "start": {
                "circ": row.circ,
                "surplus": row.surplus,
                "combined": row.circ + row.surplus,
            },
            "internal_reconciled_delta": {
                "circ": zero,
                "surplus": zero,
                "combined": zero,
            },
            "external_reconciled_delta": {
                "circ": zero,
                "surplus": zero,
                "combined": zero,
            },
            "reconciled_delta": {  # sum of the internal and external
                "circ": zero,
                "surplus": zero,
                "combined": zero,
            },
            "reconciled_total": {
                "circ": zero,
                "surplus": zero,
                "combined": zero,
            },
            "unreco_movements_delta": {
                "circ": zero,
                "surplus": zero,
                "combined": zero,
            },
            "unreco_entries_delta": {
                "circ": zero,
                "surplus": zero,
                "combined": zero,
            },
            "end": {
                "circ": zero,
                "surplus": zero,
                "combined": zero,
            },
        }
        res[row.id] = period_totals
    del rows0

    # Gather the circulation amounts from reconciled movements.
    class MovementCirculationRow:
        period_id: int
        internal: bool
        circ: Decimal
        surplus: Decimal

    rows1: Sequence[MovementCirculationRow] = (
        dbsession.query(
            FileMovement.period_id,
            Reco.internal,
            func.sum(-FileMovement.vault_delta).label("circ"),
            func.sum(FileMovement.surplus_delta).label("surplus"),
        )
        .join(Reco, Reco.id == FileMovement.reco_id)
        .filter(
            FileMovement.owner_id == owner_id,
            FileMovement.reco_id != null,
            FileMovement.period_id.in_(period_ids),
        )
        .group_by(FileMovement.period_id, Reco.internal)
        .all()
    )
    for row in rows1:
        if row.internal:
            m = res[row.period_id]["internal_reconciled_delta"]
            m["circ"] = row.circ
            m["surplus"] = row.surplus
            m["combined"] = row.circ + row.surplus
        else:
            # Reconciled external movements contribute only to
            # to the circulation amount. The account
            # entries will contribute to the combined value;
            # the surplus will be computed as the difference.
            m = res[row.period_id]["external_reconciled_delta"]
            m["circ"] = row.circ
            # Generate initial surplus and combined values. These apply
            # only if there are no reconciled account entries.
            m["surplus"] = -row.circ
            m["combined"] = zero
    del rows1

    # Gather the combined amounts from reconciled account entries.
    # Compute the surplus as the difference between the reconciled
    # account entries and the reconciled movements.
    class ReconciledRow:
        period_id: int
        combined: Decimal

    rows2: Sequence[ReconciledRow] = (
        dbsession.query(
            AccountEntry.period_id,
            func.sum(AccountEntry.delta).label("combined"),
        )
        .filter(
            AccountEntry.owner_id == owner_id,
            AccountEntry.reco_id != null,
            AccountEntry.period_id.in_(period_ids),
        )
        .group_by(AccountEntry.period_id)
        .all()
    )
    for row in rows2:
        m = res[row.period_id]["external_reconciled_delta"]
        m["surplus"] = row.combined - m["circ"]
        m["combined"] = row.combined
    del rows2

    # Gather the amounts from unreconciled movements.
    class UnreconciledRow:
        period_id: int
        circ: Decimal
        surplus: Decimal

    rows3: Sequence[UnreconciledRow] = (
        dbsession.query(
            FileMovement.period_id,
            func.sum(-FileMovement.vault_delta).label("circ"),
            func.sum(FileMovement.surplus_delta).label("surplus"),
        )
        .filter(
            FileMovement.owner_id == owner_id,
            FileMovement.reco_id == null,
            FileMovement.period_id.in_(period_ids),
        )
        .group_by(FileMovement.period_id)
        .all()
    )
    for row in rows3:
        m = res[row.period_id]["unreco_movements_delta"]
        m["circ"] = row.circ
        m["surplus"] = row.surplus
        m["combined"] = row.circ + row.surplus
    del rows3

    # Gather the amounts from unreconciled account entries.
    rows4: Sequence[UnreconciledRow] = (
        dbsession.query(
            AccountEntry.period_id,
            literal(zero).label("circ"),
            func.sum(AccountEntry.delta).label("surplus"),
        )
        .filter(
            AccountEntry.owner_id == owner_id,
            AccountEntry.reco_id == null,
            AccountEntry.period_id.in_(period_ids),
        )
        .group_by(AccountEntry.period_id)
        .all()
    )
    for row in rows4:
        m = res[row.period_id]["unreco_entries_delta"]
        m["circ"] = row.circ
        m["surplus"] = row.surplus
        m["combined"] = row.circ + row.surplus
    del rows4

    # Note that this code does not include unreco_entries_delta
    # in the end totals. That's because there are two kinds of
    # unreconciled account entries, the majority of which are represented by
    # unreconciled movements that have been included in the totals already.
    # Unreconciled account entries from sources other than movements will
    # nearly always throw off the account surplus balance, which should make
    # them obvious to the people performing reconciliation.

    for m in res.values():
        for k in "circ", "surplus", "combined":
            internal_reconciled = m["internal_reconciled_delta"][k]
            external_reconciled = m["external_reconciled_delta"][k]
            reconciled_delta = internal_reconciled + external_reconciled
            m["reconciled_delta"][k] = reconciled_delta
            reconciled_total = m["start"][k] + reconciled_delta
            m["reconciled_total"][k] = reconciled_total
            m["end"][k] = reconciled_total + m["unreco_movements_delta"][k]

    return res


def get_period_for_day(
    period_list: list[Period],
    day: datetime.date,
    default_endless=True,
) -> Period | None:
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


def open_end_period_exists(request, file_id: int) -> bool:
    """Return true if an open period exists with no end date."""
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    row = (
        dbsession.query(func.count(Period.id))
        .filter(
            Period.owner_id == owner_id,
            Period.file_id == file_id,
            Period.end_date == null,
        )
        .one()
    )
    return bool(row[0])


def add_open_period(request, file_id: int, event_type: str) -> Period:
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
            Period.file_id == file_id,
            Period.end_date != null,
        )
        .order_by(Period.end_date.desc())
        .first()
    )

    if prev is not None:
        next_start_date = prev.end_date + datetime.timedelta(days=1)
        if prev.closed:
            next_start_circ = prev.end_circ
            next_start_surplus = prev.end_surplus
        else:
            # Compute the previous end_circ and end_surplus.
            totals = compute_period_totals(
                dbsession=dbsession, owner_id=owner_id, period_ids=[prev.id]
            )[prev.id]
            next_start_circ = totals["end"]["circ"]
            next_start_surplus = totals["end"]["surplus"]
    else:
        next_start_date = None
        next_start_circ = 0
        next_start_surplus = 0

    period = Period(
        owner_id=owner_id,
        file_id=file_id,
        start_date=next_start_date,
        start_circ=next_start_circ,
        start_surplus=next_start_surplus,
    )
    dbsession.add(period)
    dbsession.flush()  # Assign period.id

    dbsession.add(
        OwnerLog(
            owner_id=owner_id,
            personal_id=request.personal_id,
            event_type=event_type,
            content={
                "period_id": period.id,
                "file_id": file_id,
                "start_date": next_start_date,
                "start_circ": next_start_circ,
                "start_surplus": next_start_surplus,
            },
        )
    )

    return period


def list_assignable_periods(dbsession, owner_id: str, period: Period):
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
                Period.file_id == period.file_id,
                ~Period.closed,
            )
            .order_by(Period.start_date.desc())
            .all()
        )

    return [
        {
            "id": str(p.id),
            "start_date": p.start_date,
            "end_date": p.end_date,
            "closed": p.closed,
        }
        for p in period_rows
    ]


def bad_request(e: Invalid, schema) -> HTTPBadRequest:
    raise HTTPBadRequest(
        json_body={
            "error": "invalid",
            "error_description": "; ".join(
                "%s (field: %s)" % (v, k) for (k, v) in sorted(e.asdict().items())
            ),
        }
    )


def configure_dblog(
    request, event_type=None, movement_event_type=None, account_entry_event_type=None
):
    """Set the variables for trigger-driven logging."""
    columns = [
        func.set_config("opnreco.personal_id", request.personal_id, True),
    ]
    if movement_event_type or event_type:
        columns.append(
            func.set_config(
                "opnreco.movement.event_type", movement_event_type or event_type, True
            )
        )
    if account_entry_event_type or event_type:
        columns.append(
            func.set_config(
                "opnreco.account_entry.event_type",
                account_entry_event_type or event_type,
                True,
            )
        )
    request.dbsession.query(*columns).one()
