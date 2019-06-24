
from decimal import Decimal
from opnreco.models.db import Movement
from opnreco.models.db import FileMovement
from opnreco.models.db import TransferRecord
from opnreco.models import perms
from opnreco.models.site import PeriodResource
from opnreco.viewcommon import get_loop_map
from opnreco.viewcommon import get_peer_map
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import and_
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

    Requires period_id, transfer_id in the query string.
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

    movement_rows = (
        dbsession.query(Movement, FileMovement)
        .outerjoin(FileMovement, and_(
            FileMovement.movement_id == Movement.id,
            FileMovement.file_id == period.file_id))
        .filter(
            Movement.owner_id == owner_id,
            Movement.transfer_record_id == record.id)
        .order_by(
            Movement.number,
            Movement.amount_index,
            Movement.loop_id,
            Movement.currency,
            Movement.issuer_id,
        ).all())

    need_peer_ids = set()
    need_loop_ids = set()

    if record.sender_id is not None:
        need_peer_ids.add(record.sender_id)
    if record.recipient_id is not None:
        need_peer_ids.add(record.recipient_id)

    # peer_appearance is used for sorting the peers by order of
    # appearance in the transfer.
    # peer_appearance: {peer_id: [(movement_number, amount_index)]}
    peer_appearance = collections.defaultdict(list)
    to_or_from = set()  # set of peer_ids listed in to_id or from_id
    for m, _fm in movement_rows:
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

    for m, fm in movement_rows:
        currency = m.currency
        loop_id = m.loop_id
        issuer_id = m.issuer_id

        if fm is not None:
            reco_applicable = True
            vault_delta = fm.vault_delta
            vault_delta_str = str(vault_delta)
            wallet_delta = fm.wallet_delta
            wallet_delta_str = str(wallet_delta)
            reco_id = fm.reco_id
            if vault_delta:
                delta_totals[(currency, loop_id)]['vault'] += vault_delta
            if wallet_delta:
                delta_totals[(currency, loop_id)]['wallet'] += wallet_delta

        else:
            reco_applicable = False
            vault_delta_str = '0'
            wallet_delta_str = '0'
            reco_id = None

        movements_json.append({
            'movement_id': str(m.id),
            'number': m.number,
            'amount_index': m.amount_index,
            'loop_id': loop_id,
            'currency': currency,
            'amount': str(m.amount or '0'),
            'issuer_id': issuer_id,
            'from_id': m.from_id,
            'to_id': m.to_id,
            'action': m.action,
            'ts': m.ts.isoformat() + 'Z',
            'wallet_delta': wallet_delta_str,
            'vault_delta': vault_delta_str,
            'reco_applicable': reco_applicable,
            'reco_id': None if reco_id is None else str(reco_id),
        })

        if issuer_id in peers:
            # This peer is an issuer in this transfer.
            # (The front end will show an issuer icon.)
            peers[issuer_id]['is_issuer'] = True

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

    self_id = owner_id

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
        'show_vault': period.file.has_vault,
        'bundled_transfers': record.bundled_transfers,
        'bundle_transfer_id': record.bundle_transfer_id,
    }
