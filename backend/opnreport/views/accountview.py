
from decimal import Decimal
from opnreport.models.db import AccountEntry
from opnreport.models.db import AccountEntryReco
from opnreport.models.db import Exchange
from opnreport.models.db import File
from opnreport.models.db import FileFrozen
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
from sqlalchemy import and_
from sqlalchemy import case
from sqlalchemy import func
from sqlalchemy import or_
import collections
import datetime
import re

null = None
zero = Decimal()


@view_config(
    name='ploops',
    context=API,
    permission='use_app',
    renderer='json')
def ploops_view(request):
    """Return the owner profile's list of peer loops ('ploops') and files.

    Returns {
        'ploops': {ploop_key: {
            'ploop_key',
            'peer_id',
            'loop_id',
            'currency',
            'peer_title',
            'peer_username',
            'peer_is_dfi_account',
            'loop_title',
            'files': {file_id: {
                'file_id',
                'is_new',
                'subtitle',
                'start_date',
                'start_balance',
                'end_date',
                'end_balance',
                'peer_title',
                'peer_username',
                'peer_is_dfi_account',
                'loop_title',
            }},
            'file_order': [file_id],
        }},
        'ploop_order': [ploop_key],
        'default_ploop': ploop_key,
    }.
    """
    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession

    future = datetime.utcnow() + datetime.timedelta(days=366 * 100)

    file_rows = (
        dbsession.query(File, Peer, FileFrozen, Loop)
        .join(Peer, and_(
            Peer.owner_id == owner_id,
            Peer.peer_id == File.peer_id))
        .outerjoin(FileFrozen, FileFrozen.file_id == File.id)
        .outerjoin(Loop, and_(
            Loop.owner_id == owner_id,
            Loop.loop_id == File.loop_id,
            Loop.loop_id != '0'))
        .filter(
            File.owner_id == owner_id,
            or_(
                and_(File.peer_id == 'c', File.has_vault),
                Peer.is_dfi_account,
                FileFrozen.peer_is_dfi_account,
            ))
        .order_by(
            func.coalesce(FileFrozen.start_date, future).desc(),
            File.id)
        .all())

    # ploops: {peer_id-loop_id-currency: {files, file_order, ...}}
    ploops = {}

    for file, peer, ffz, loop in file_rows:
        ploop_key = '-'.join([file.peer_id, file.loop_id, file.currency])

        ploop = ploops.get(ploop_key)
        if ploop is None:
            loop_title = (
                '[Cash Design %s]' % file.loop_id if loop is None
                else loop.title)
            ploop = {
                'ploop_key': ploop_key,
                'peer_id': file.peer_id,
                'loop_id': file.loop_id,
                'currency': file.currency,
                'peer_title': peer.title,
                'peer_username': peer.username,
                'peer_is_dfi_account': peer.is_dfi_account,
                'loop_title': loop_title,
                'files': {},
                'file_order': [],
            }
            ploops[ploop_key] = ploop

        file_info = serialize_file(file, peer, loop)
        file_id_str = str(file.id)
        ploop['files'][file_id_str] = file_info
        ploop['file_order'].append(file_id_str)

    # Determine the ordering of the ploops.

    ploop_ordering = []
    default_ordering = []

    for ploop_key, ploop_info in ploops.items():
        if ploop_info['peer_id'] == 'c':
            # Show circulation first.
            peer_title = ''
            peer_id = ''
        else:
            peer_title = ploop['peer_title']
            peer_id = ploop['peer_id']

        loop_id = ploop['loop_id']
        if loop_id == '0':
            # Show open loop first.
            loop_title = ''
        else:
            loop_title = ploop['loop_title']

        sort_key = (
            0 if ploop['peer_is_dfi_account'] else 1,
            peer_title.lower(),
            peer_title,
            peer_id,
            '' if ploop['currency'] == 'USD' else ploop['currency'],
            loop_title.lower(),
            loop_title,
            loop_id,
        )
        ploop_ordering.append((sort_key, ploop_key))

        # Prefer to show circulation files over other types of files.
        default_key = (
            0 if ploop['peer_id'] == 'c' else 1,
            0 if ploop['loop_id'] == '0' else 1,
        ) + sort_key

        default_ordering.append((default_key, ploop_key))

    ploop_ordering.sort()
    default_ordering.sort()

    ploop_order = [ploop_key for (_, ploop_key) in ploop_ordering]
    default_ploop = default_ordering[0][1] if default_ordering else ''

    return {
        'ploops': ploops,
        'ploop_order': ploop_order,
        'default_ploop': default_ploop,
    }


def serialize_file(file, peer, loop=None):
    res = {
        'file_id': str(file.id),
        'owner_id': file.owner_id,
        'peer_id': file.peer_id,
        'loop_id': file.loop_id,
        'currency': file.currency,
        'current': file.current,
        'has_vault': file.has_vault,
        'subtitle': file.subtitle,
    }

    ffz = file.frozen
    loop_title = (
        '[Cash Design %s]' % file.loop_id if loop is None
        else loop.title)

    if ffz is not None:
        res.update({
            'peer_title': ffz.peer_title,
            'peer_username': ffz.peer_username,
            'peer_is_dfi_account': ffz.peer_is_dfi_account,
            'loop_title': ffz.loop_title,
            'start_date': ffz.start_date,
            'start_balance': ffz.start_balance,
            'end_date': ffz.end_date,
            'end_balance': ffz.end_balance,
        })
    else:
        res.update({
            'start_date': None,
            'start_balance': '0',
            'end_date': None,
            'end_balance': None,
            'peer_title': peer.title,
            'peer_username': peer.username,
            'peer_is_dfi_account': peer.is_dfi_account,
            'loop_title': loop_title,
        })

    return res


def get_request_file(request):
    """Get the file, peer, and loop specified in the request subpath.

    Raise HTTPBadRequest or HTTPNotFound as needed.

    The subpath must contain a ploop_key (peer_id-loop_id-currency)
    and file_id, where file_id may be 'current'.
    """
    subpath = request.subpath
    if not subpath:
        raise HTTPBadRequest(
            json_body={'error': 'subpath required'})
    if len(subpath) < 2:
        raise HTTPBadRequest(
            json_body={'error': 'at least 2 subpath elements required'})

    ploop_key, file_id_str = subpath[:4]

    match = re.match(r'^([0-9]+)-([0-9]+)-([A-Z]{3})$', ploop_key)
    if match is None:
        raise HTTPBadRequest(
            json_body={'error': 'invalid ploop_key provided'})
    peer_id, loop_id, currency = match.groups()

    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession

    if file_id_str == 'current':
        filter_kw = {'current': True}
    else:
        try:
            file_id = int(file_id_str)
        except ValueError:
            raise HTTPBadRequest(
                json_body={'error': 'bad file_id provided'})
        filter_kw = {'id': file_id}

    row = (
        dbsession.query(File, Peer, Loop)
        .join(Peer, and_(
            Peer.owner_id == owner_id,
            Peer.peer_id == File.peer_id))
        .outerjoin(Loop, and_(
            Loop.owner_id == owner_id,
            Loop.loop_id == File.loop_id,
            Loop.loop_id != '0'))
        .filter_by(
            owner_id=owner_id,
            peer_id=peer_id,
            loop_id=loop_id,
            currency=currency,
            **filter_kw)
        .first())

    if row is None:
        raise HTTPNotFound()

    return row


@view_config(
    name='reco-report',
    context=API,
    permission='use_app',
    renderer='json')
def reco_report_view(request):
    file, peer, loop = get_request_file(request)

    if file.peer_id == 'c':
        movement_delta_c = Movement.vault_delta
        exchange_delta_c = Exchange.vault_delta
    else:
        movement_delta_c = Movement.wallet_delta
        exchange_delta_c = Exchange.wallet_delta

    file_id = file.id
    dbsession = request.dbsession
    owner_id = request.owner.id

    movement_filter = and_(
        TransferRecord.owner_id == owner_id,
        Movement.transfer_record_id == TransferRecord.id,
        Movement.peer_id == file.peer_id,
        Movement.loop_id == file.loop_id,
        Movement.currency == file.currency,
        movement_delta_c != 0,
    )

    # reconciled_delta is the total of reconciled DFI entries in this file.
    reconciled_delta = (
        dbsession.query(func.sum(AccountEntry.delta))
        .join(
            AccountEntryReco,
            AccountEntryReco.account_entry_id == AccountEntry.id)
        .filter(AccountEntry.file_id == file_id)
        .scalar()) or 0

    include_unreconciled = file.current

    # workflow_type_rows lists the workflow types of movements
    # involved in this file. Include manually
    # reconciled movements, but not the effects of automatically
    # reconciled movements. Include unreconciled movements if
    # looking at a 'current' file.
    if include_unreconciled:
        reco_filter = or_(Reco.file_id == null, Reco.file_id == file_id)
    else:
        reco_filter = (Reco.file_id == file_id)
    workflow_type_rows = (
        dbsession.query(
            func.sign(-movement_delta_c).label('sign'),
            TransferRecord.workflow_type,
        )
        .outerjoin(MovementReco, MovementReco.movement_id == Movement.id)
        .outerjoin(Reco, Reco.id == MovementReco.reco_id)
        .filter(
            movement_filter,
            reco_filter,
            or_(Reco.auto == null, ~Reco.auto))
        .group_by(
            func.sign(-movement_delta_c),
            TransferRecord.workflow_type)
        .all())

    # Create workflow_types_pre: {(str(sign), workflow_type): delta}}
    workflow_types_pre = collections.defaultdict(Decimal)
    for r in workflow_type_rows:
        str_sign = str(r.sign)
        workflow_type = r.workflow_type
        workflow_types_pre[(str(r.sign), r.workflow_type)] = zero

    if include_unreconciled:
        # outstanding_rows lists the movements not yet reconciled.
        # Negate the amounts because we're showing compensating amounts.
        outstanding_rows = (
            dbsession.query(
                func.sign(-movement_delta_c).label('sign'),
                TransferRecord.workflow_type,
                TransferRecord.transfer_id,
                (-movement_delta_c).label('delta'),
                TransferRecord.start,
                Movement.id,
            )
            .outerjoin(MovementReco, MovementReco.movement_id == Movement.id)
            .filter(
                movement_filter,
                MovementReco.reco_id == null)
            .all())

        # exchange_rows lists the exchanges not yet reconciled.
        # Don't negate the amounts.
        exchange_rows = (
            dbsession.query(
                func.sign(exchange_delta_c).label('sign'),
                TransferRecord.transfer_id,
                exchange_delta_c.label('delta'),
                TransferRecord.start,
                Exchange.id,
            )
            .filter(
                TransferRecord.owner_id == owner_id,
                Exchange.transfer_record_id == TransferRecord.id,
                Exchange.peer_id == file.peer_id,
                Exchange.loop_id == file.loop_id,
                Exchange.currency == file.currency,
                exchange_delta_c != 0,
                Exchange.reco_id == null)
            .all())

    else:
        outstanding_rows = ()
        exchange_rows = ()

    # Create outstanding_map:
    # {str(sign): {workflow_type: [{transfer_id, delta, ts, id}]}}.
    outstanding_map = {
        '-1': collections.defaultdict(list),
        '1': collections.defaultdict(list),
    }
    for r in outstanding_rows:
        str_sign = str(r.sign)
        workflow_type = r.workflow_type
        outstanding_map[str_sign][workflow_type].append({
            'transfer_id': r.transfer_id,
            'delta': str(r.delta),
            'ts': r.start.isoformat() + 'Z',
            'id': str(r.id),
        })
        # Add the total of outstanding movements to workflow_types_pre.
        workflow_types_pre[(str_sign, workflow_type)] += r.delta

    # Add the exchanges to outstanding_map and workflow_types_pre.
    for r in exchange_rows:
        str_sign = str(r.sign)
        workflow_type = '_exchange'
        outstanding_map[str_sign][workflow_type].append({
            'transfer_id': r.transfer_id,
            'delta': str(r.delta),
            'ts': r.start.isoformat() + 'Z',
            'id': str(r.id),
        })
        # Add the total of outstanding movements to workflow_types_pre.
        workflow_types_pre[(str_sign, workflow_type)] += r.delta

    # Convert outstanding_map from defaultdicts to dicts for JSON encoding.
    for sign, m in list(outstanding_map.items()):
        outstanding_map[sign] = dict(m)
        for lst in m.values():
            # Sort the outstanding list by timestamp.
            lst.sort(key=lambda x: x['ts'])

    # Convert workflow_types to JSON encoding:
    # {str(sign): {workflow_type: str(delta)}}
    workflow_types = {}
    for (str_sign, workflow_type), delta in workflow_types_pre.items():
        d = workflow_types.get(str_sign)
        if d is None:
            workflow_types[str_sign] = d = {}
        d[workflow_type] = str(delta) if delta else '0'

    ffz = file.frozen
    start_balance = zero if ffz is None else ffz.start_balance
    reconciled_balance = start_balance + reconciled_delta
    outstanding_balance = reconciled_balance + sum(
        row.delta for row in outstanding_rows)

    return {
        'file': serialize_file(file, peer, loop),
        'reconciled_balance': str(reconciled_balance),
        'outstanding_balance': str(outstanding_balance),
        'workflow_types': workflow_types,
        'outstanding_map': outstanding_map,
    }


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
    profile = request.profile
    profile_id = profile.id

    record = (
        dbsession.query(TransferRecord)
        .filter(
            TransferRecord.profile_id == profile_id,
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

    target_ids = set()
    loop_ids = set()
    for m, _reco in movement_rows:
        target_ids.update([m.from_id, m.to_id, m.issuer_id])
        loop_ids.add(m.loop_id)
    target_ids.discard(profile_id)
    loop_ids.discard('0')

    target_title_rows = (
        dbsession.query(
            Mirror.target_id,
            Mirror.target_title,
            Mirror.target_username,
            Mirror.target_is_dfi_account,
        )
        .filter(
            Mirror.profile_id == profile_id,
            Mirror.target_id.in_(target_ids),
            Mirror.target_title != null,
            Mirror.target_title != '',
        )
        .order_by(
            case([
                (Mirror.file_id == null, 1),
            ], else_=0),
            Mirror.start_date,
        ).all())

    target_titles = {}
    target_usernames = {}
    target_accounts = {}
    for row in target_title_rows:
        target_id, target_title, target_username, target_is_dfi_account = row
        target_titles[target_id] = target_title
        target_usernames[target_id] = target_username
        target_accounts[target_id] = target_is_dfi_account
    target_titles[profile_id] = profile.title
    target_usernames[profile_id] = profile.username

    target_sortables = []
    for target_id, title in target_titles.items():
        if target_id == profile_id:
            sort_key = (0,)
        else:
            sort_key = (1, title.lower(), title, target_id)
        target_sortables.append((target_id, sort_key))
    target_sortables.sort(key=lambda x: x[1])
    target_order = [x for x, y in target_sortables]
    target_index = {x: i for (i, x) in enumerate(target_order)}

    loop_title_rows = (
        dbsession.query(Mirror.loop_id, Mirror.loop_title)
        .filter(
            Mirror.profile_id == profile_id,
            Mirror.loop_id.in_(loop_ids),
            Mirror.loop_title != null,
            Mirror.loop_title != '')
        .order_by(
            case([
                (Mirror.file_id == null, 1),
            ], else_=0),
            Mirror.start_date,
        ).all())

    loop_titles = {}
    for loop_id, loop_title in loop_title_rows:
        loop_titles[loop_id] = loop_title

    # Create movement_groups in order to unite the doubled movement
    # rows in a single row.
    # movement_groups: {
    #    (number, orig_target_id, loop_id, currency, issuer_id):
    #    [Movement, target_reco, c_reco]
    # }
    movement_groups = {}
    for movement, reco in movement_rows:
        key = (
            movement.number,
            movement.orig_target_id,
            movement.loop_id,
            movement.currency,
            movement.issuer_id)
        group = movement_groups.get(key)
        if group is None:
            movement_groups[key] = group = [movement, None, None]
        if movement.target_id == 'c':
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
        number, target_id, loop_id, currency, issuer_id = key
        movement, target_reco, c_reco = group
        movements_json.append({
            'number': number,
            'target_id': target_id,
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
            'target_reco': reco_to_json(target_reco),
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
        'sender_title': record.sender_title,
        'recipient_id': record.recipient_id,
        'recipient_uid': record.recipient_uid,
        'recipient_title': record.recipient_title,
        'movements': movements_json,
        'exchanges': exchanges_json,
        'target_titles': target_titles,
        'target_usernames': target_usernames,
        'target_order': target_order,
        'target_index': target_index,
        'target_accounts': target_accounts,
        'loop_titles': loop_titles,
    }
