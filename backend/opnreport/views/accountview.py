
from decimal import Decimal
from opnreport.models.db import Exchange
from opnreport.models.db import File
from opnreport.models.db import Mirror
from opnreport.models.db import MirrorEntry
from opnreport.models.db import MirrorEntryReco
from opnreport.models.db import Movement
from opnreport.models.db import MovementReco
from opnreport.models.db import Reco
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.httpexceptions import HTTPNotFound
from pyramid.view import view_config
from sqlalchemy import func
from sqlalchemy import and_
from sqlalchemy import or_
from sqlalchemy import case
import collections

null = None
zero = Decimal()


@view_config(
    name='accounts',
    context=API,
    permission='use_app',
    renderer='json')
def accounts_view(request):
    """Return the profile's list of accounts.

    An account is a list of time-boxed mirrors of bank accounts the
    profile can reconcile with.

    Returns {
        'accounts': {account_key: {
            'account_key',
            'target_id',
            'loop_id',
            'currency',
            'target_title',
            'target_is_dfi_account',
            'loop_title',
            'files': {file_id: {
                'file_id',
                'mirror_id',
                'start_date',
                'end_date',
                'subtitle',
            }},
            'file_order': [file_id],
        }},
        'account_order': [account_key],
        'default_account': account_key,
    }.
    """
    profile = request.profile
    profile_id = profile.id
    dbsession = request.dbsession

    mirror_filter = and_(Mirror.profile_id == profile_id, or_(
        and_(Mirror.target_id == 'c', Mirror.has_vault),
        Mirror.target_is_dfi_account))

    unfiled_mirrors = (
        dbsession.query(Mirror)
        .filter(mirror_filter, Mirror.file_id == null)
        .all())
    unfiled_mirror_ids = [m.id for m in unfiled_mirrors]

    filed_mirrors = (
        dbsession.query(Mirror)
        .filter(
            mirror_filter,
            Mirror.file_id != null,
            ~Mirror.id.in_(unfiled_mirror_ids))
        .order_by(Mirror.last_update.desc())
        .all())

    file_rows = (
        dbsession.query(File, Mirror)
        .filter(
            mirror_filter,
            File.mirror_id == Mirror.id, File.profile_id == profile_id)
        .order_by(File.end_date.desc())
        .all())

    # file_map: {
    #   target_id-loop_id-currency:
    #     [{mirror_id, file_id, start_date, end_date, subtitle}]
    # }
    file_map = collections.defaultdict(dict)
    file_orders = collections.defaultdict(list)
    for file, mirror in file_rows:
        key = '-'.join([mirror.target_id, mirror.loop_id, mirror.currency])
        file_id_str = str(file.id)
        file_map[key][file_id_str] = {
            'mirror_id': str(mirror.id),
            'file_id': file_id_str,
            'start_date': mirror.start_date.isoformat() + 'Z',
            'end_date': file.end_date.isoformat() + 'Z',
            'subtitle': file.subtitle,
        }
        file_orders[key].append(file_id_str)

    # account_map: {
    #   target_id-loop_id-currency:
    #     {account_key, target_title, loop_title, ..., files: [file_map entry]}
    # }
    account_map = {}

    for mirror in unfiled_mirrors + filed_mirrors:
        key = '-'.join([mirror.target_id, mirror.loop_id, mirror.currency])
        account = account_map.get(key)
        if not account:
            account_map[key] = account = {
                'account_key': key,
                'target_id': mirror.target_id,
                'loop_id': mirror.loop_id,
                'currency': mirror.currency,
                'target_title': mirror.target_title or profile.title,
                'target_is_dfi_account': mirror.target_is_dfi_account,
                'loop_title': mirror.loop_title or '',
                'files': file_map[key],
                'file_order': file_orders[key],
                'has_current': False,
            }
        else:
            account = account_map[key]
            # Set the target_title and loop_title if not already set.
            if not account['target_title'] and mirror.target_title:
                account['target_title'] = mirror.target_title
            if not account['loop_title'] and mirror.loop_title:
                account['loop_title'] = mirror.loop_title
        if mirror.file_id is None:
            account['has_current'] = True

    # Prepare to sort account_map.
    # Also determine the best default mirror set.
    defaults = []
    for account in account_map.values():
        if account['target_id'] == 'c':
            # Show circulation first.
            target_title = ''
            target_id = ''
        else:
            target_title = account['target_title']
            target_id = account['target_id']

        loop_id = account['loop_id']
        if loop_id == '0':
            # Show open loop first.
            loop_title = ''
        else:
            loop_title = account['loop_title']

        account['sort_key'] = sort_key = (
            0 if account['target_is_dfi_account'] else 1,
            target_title.lower(),
            target_title,
            target_id,
            '' if account['currency'] == 'USD' else account['currency'],
            loop_title.lower(),
            loop_title,
            loop_id,
        )

        # Prefer to reconcile issuing accounts over other types of mirrors.
        default_key = (
            0 if account['target_id'] == 'c' else 1,
            0 if account['loop_id'] == '0' else 1,
        ) + sort_key

        defaults.append((default_key, account['account_key']))

    # Sort.
    accounts_sorted = sorted(
        account_map.values(), key=lambda account: account['sort_key'])

    # Remove the sort_keys.
    for account in accounts_sorted:
        del account['sort_key']

    # Choose the best default mirror.
    defaults.sort()

    return {
        'accounts': {
            account['account_key']: account for account in accounts_sorted},
        'account_order': [
            account['account_key'] for account in accounts_sorted],
        'default_account': defaults[0][1] if defaults else '',
    }


def get_mirror(request):
    """Get the mirror specified in the request subpath or raise HTTPBadRequest.

    The subpath must contain a target_id, loop_id, currency, and file_id,
    where file_id may be 'current'.
    """
    subpath = request.subpath
    if not subpath:
        raise HTTPBadRequest('subpath required')
    if len(subpath) < 4:
        raise HTTPBadRequest('at least 4 subpath elements required')

    target_id, loop_id, currency, file_id_str = subpath[:4]

    if file_id_str == 'current':
        file_id = None
    else:
        try:
            file_id = int(file_id_str)
        except ValueError:
            raise HTTPBadRequest('bad file_id')

    profile = request.profile
    profile_id = profile.id
    dbsession = request.dbsession

    return (
        dbsession.query(Mirror)
        .filter_by(
            profile_id=profile_id,
            target_id=target_id,
            loop_id=loop_id,
            currency=currency,
            file_id=file_id,
        )
        .first())


@view_config(
    name='reco-report',
    context=API,
    permission='use_app',
    renderer='json')
def reco_report_view(request):
    mirror = get_mirror(request)
    if mirror is None:
        raise HTTPNotFound()

    if mirror.target_id == 'c':
        movement_delta_c = Movement.vault_delta
        exchange_delta_c = Exchange.vault_delta
    else:
        movement_delta_c = Movement.wallet_delta
        exchange_delta_c = Exchange.wallet_delta

    mirror_id = mirror.id
    dbsession = request.dbsession

    movement_filter = and_(
        Movement.transfer_record_id == TransferRecord.id,
        Movement.target_id == mirror.target_id,
        Movement.loop_id == mirror.loop_id,
        Movement.currency == mirror.currency,
        movement_delta_c != 0,
    )

    # reconciled_delta is the total of reconciled DFI entries in this mirror.
    reconciled_delta = (
        dbsession.query(func.sum(MirrorEntry.delta))
        .join(
            MirrorEntryReco, MirrorEntryReco.mirror_entry_id == MirrorEntry.id)
        .filter(MirrorEntry.mirror_id == mirror_id)
        .scalar()) or 0

    include_unreconciled = (mirror.file_id is None)

    # workflow_type_rows lists the workflow types of movements
    # involved in this mirror. Include manually
    # reconciled movements, but not the effects of automatically
    # reconciled movements. Include unreconciled movements if
    # mirror.file_id is None.
    if include_unreconciled:
        reco_filter = or_(
            Reco.mirror_id == null, Reco.mirror_id == mirror_id)
    else:
        reco_filter = (Reco.mirror_id == mirror_id)
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
                Exchange.target_id == mirror.target_id,
                Exchange.loop_id == mirror.loop_id,
                Exchange.currency == mirror.currency,
                exchange_delta_c != 0,
                Exchange.transfer_record_id == TransferRecord.id,
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

    reconciled_balance = mirror.start_balance + reconciled_delta
    outstanding_balance = reconciled_balance + sum(
        row.delta for row in outstanding_rows)

    return {
        'mirror': mirror.getstate(),
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
