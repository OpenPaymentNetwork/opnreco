
from decimal import Decimal
from opnreport.models.db import File
from opnreport.models.db import Mirror
from opnreport.models.db import MirrorEntry
from opnreport.models.db import MirrorEntryReco
from opnreport.models.db import Movement
from opnreport.models.db import MovementReco
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import func
import collections

null = None


@view_config(
    name='accounts',
    context=API,
    permission='use_app',
    renderer='json')
def accounts_view(request):
    """Return the profile's list of accounts.

    An account is a list of time-boxed mirrors of bank accounts or wallets
    that the profile can reconcile with.

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

    unfiled_mirrors = (
        dbsession.query(Mirror)
        .filter_by(profile_id=profile_id)
        .filter_by(file_id=null)
        .all())
    unfiled_mirror_ids = [m.id for m in unfiled_mirrors]

    filed_mirrors = (
        dbsession.query(Mirror)
        .filter_by(profile_id=profile_id)
        .filter(Mirror.file_id != null)
        .filter(~Mirror.id.in_(unfiled_mirror_ids))
        .order_by(Mirror.last_update.desc())
        .all())

    file_rows = (
        dbsession.query(File, Mirror)
        .filter(File.mirror_id == Mirror.id)
        .filter(File.profile_id == profile_id)
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

    The subpath must contain a target_id, loop_id, currency, and an optional
    file_id.
    """
    subpath = request.subpath
    if not subpath:
        raise HTTPBadRequest('subpath required')
    if len(subpath) < 3:
        raise HTTPBadRequest('at least 3 subpath elements required')

    target_id, loop_id, currency = subpath[:3]

    if len(subpath) > 3 and subpath[3]:
        try:
            file_id = int(subpath[3])
        except ValueError:
            raise HTTPBadRequest('bad file_id')
    else:
        file_id = None

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
        return {}

    mirror_id = mirror.id
    dbsession = request.dbsession

    # reconciled_delta is the total of reconciled DFI entries in this mirror.
    reconciled_delta = (
        dbsession.query(func.sum(MirrorEntry.delta))
        .join(
            MirrorEntryReco, MirrorEntryReco.mirror_entry_id == MirrorEntry.id)
        .filter(MirrorEntry.mirror_id == mirror_id)
        .scalar()) or 0

    # outstanding_rows lists the movements not yet reconciled.
    # Negate the amounts because we're showing compensating amounts.
    outstanding_rows = (
        dbsession.query(
            func.sign(-Movement.delta).label('sign'),
            TransferRecord.workflow_type,
            TransferRecord.transfer_id,
            (-Movement.delta).label('delta'),
            Movement.ts,
            Movement.id,
        )
        .outerjoin(MovementReco, MovementReco.movement_id == Movement.id)
        .filter(
            Movement.mirror_id == mirror_id,
            Movement.delta != 0,
            Movement.transfer_record_id == TransferRecord.id,
            MovementReco.reco_id == null)
        .all())

    # Create outstanding_map:
    # {str(sign): {workflow_type: [{transfer_id, delta, ts, id}]}}.
    outstanding_map = {
        '-1': collections.defaultdict(list),
        '1': collections.defaultdict(list),
    }
    # Also create workflow_types: {(str(sign), workflow_type): delta}}
    workflow_types_pre = collections.defaultdict(Decimal)
    for r in outstanding_rows:
        str_sign = str(r.sign)
        workflow_type = r.workflow_type
        outstanding_map[str_sign][workflow_type].append({
            'transfer_id': r.transfer_id,
            'delta': str(r.delta),
            'ts': r.ts.isoformat() + 'Z',
            'id': str(r.id),
        })
        workflow_types_pre[(str_sign, workflow_type)] += r.delta

    # Convert from defaultdicts to dicts for JSON encoding.
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
