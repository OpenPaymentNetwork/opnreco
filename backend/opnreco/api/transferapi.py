
from decimal import Decimal
from opnreco.models.db import Movement
from opnreco.models.db import TransferRecord
from opnreco.models import perms
from opnreco.models.site import PeriodResource
from opnreco.viewcommon import get_loop_map
from opnreco.viewcommon import get_peer_map
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
import collections


@view_config(
    name='transfer-record-final',
    context=PeriodResource,
    permission=perms.view_period,
    renderer='json')
def transfer_record_final_api(context, request):
    return transfer_record_api(context, request, final=True)


@view_config(
    name='transfer-record',
    context=PeriodResource,
    permission=perms.view_period,
    renderer='json')
def transfer_record_api(context, request, final=False):
    """Prepare all the info for displaying a transfer record.

    Requires peer_key, period_id, and transfer_id in the query string.
    Note that the period specified is used only to identify which
    reconciliation records to show.

    To optimize for performance, this view should not fetch peer and
    loop titles by default. It should fetch updates when accessed
    as 'transfer-record-final'.
    """
    transfer_id_input = request.params.get('transfer_id')
    if not transfer_id_input:
        raise HTTPBadRequest(json_body={'error': 'transfer_id_required'})

    transfer_id = transfer_id_input.replace('-', '')
    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    period = context.period
    period_peer_id = period.peer_id
    is_circ = period_peer_id == 'c'

    record = (
        dbsession.query(TransferRecord)
        .filter(
            TransferRecord.owner_id == owner_id,
            TransferRecord.transfer_id == transfer_id)
        .first())

    if record is None:
        raise HTTPBadRequest(json_body={
            'error': 'transfer_not_found',
            'error_description': (
                "Transfer %s is not found in the OPN Reconciliation "
                "database for %s."
                % (transfer_id_input, owner.title)),
        })

    # Note: there are exactly two copies of every row in the Movement
    # table because we store a movement row for both the original peer
    # and the 'c' peer. Disambiguate.
    if is_circ:
        movement_filter = (Movement.peer_id == 'c')
    else:
        movement_filter = (Movement.peer_id != 'c')

    movement_rows = (
        dbsession.query(Movement)
        .filter(movement_filter)
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

    # peer_appearance is used for sorting the peers by order of
    # appearance in the transfer.
    # peer_appearance: {peer_id: [(movement_number, amount_index)]}
    peer_appearance = collections.defaultdict(list)
    to_or_from = set()  # set of peer_ids listed in to_id or from_id
    for m in movement_rows:
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

    peers = get_peer_map(
        request=request,
        need_peer_ids=need_peer_ids,
        final=final)

    loops = get_loop_map(
        request=request,
        need_loop_ids=need_loop_ids,
        final=final)

    movements_json = []
    # delta_totals: {(currency, loop_id): {'vault', 'wallet'}}
    zero = Decimal()
    delta_totals = collections.defaultdict(lambda: {
        'vault': zero,
        'wallet': zero,
    })

    for movement in movement_rows:
        movement_id = movement.id
        number = movement.number
        amount_index = movement.amount_index
        orig_peer_id = movement.orig_peer_id
        loop_id = movement.loop_id
        currency = movement.currency
        issuer_id = movement.issuer_id
        vault_delta = movement.vault_delta
        wallet_delta = movement.wallet_delta

        reco_applicable = False
        if (movement.currency == period.currency and
                movement.loop_id == period.loop_id and
                (is_circ or orig_peer_id == period_peer_id) and
                (wallet_delta or vault_delta)):
            reco_applicable = True

        reco_id = movement.reco_id
        movements_json.append({
            'movement_id': str(movement_id),
            'number': number,
            'amount_index': amount_index,
            'peer_id': orig_peer_id,
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
            'reco_applicable': not not reco_applicable,
            'reco_id': None if reco_id is None else str(reco_id),
        })

        if vault_delta:
            delta_totals[(currency, loop_id)]['vault'] += vault_delta
        if wallet_delta:
            delta_totals[(currency, loop_id)]['wallet'] += wallet_delta

        if issuer_id == orig_peer_id:
            # This peer is an issuer in this transfer.
            # (Show an issuer icon.)
            peers[orig_peer_id]['is_issuer'] = True

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

    self_id = owner_id if is_circ else period.peer_id

    delta_totals_json = [{
        'currency': currency1,
        'loop_id': loop_id1,
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
        'show_vault': is_circ,
    }
