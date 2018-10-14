
from opnreport.models.db import File
from opnreport.models.db import Loop
from opnreport.models.db import Peer
from opnreport.models.site import API
from opnreport.serialize import serialize_file
from pyramid.view import view_config
from sqlalchemy import and_
from sqlalchemy import func
from sqlalchemy import or_
import datetime


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
                'current',
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

    future = datetime.datetime.utcnow() + datetime.timedelta(days=366 * 100)

    file_rows = (
        dbsession.query(File, Peer, Loop)
        .join(Peer, and_(
            Peer.owner_id == owner_id,
            Peer.peer_id == File.peer_id))
        .outerjoin(Loop, and_(
            Loop.owner_id == owner_id,
            Loop.loop_id == File.loop_id,
            Loop.loop_id != '0'))
        .filter(
            File.owner_id == owner_id,
            or_(
                and_(File.peer_id == 'c', File.has_vault),
                Peer.is_dfi_account,
                File.peer_is_dfi_account,
            ))
        .order_by(
            func.coalesce(File.start_date, future).desc(),
            File.id)
        .all())

    # ploops: {peer_id-loop_id-currency: {files, file_order, ...}}
    ploops = {}

    for file, peer, loop in file_rows:
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

    for ploop_key, ploop in ploops.items():
        if ploop['peer_id'] == 'c':
            # Show circulation first.
            peer_sort_title = ''
            peer_sort_id = ''
        else:
            peer_sort_title = ploop['peer_title']
            peer_sort_id = ploop['peer_id']

        loop_id = ploop['loop_id']
        if loop_id == '0':
            # Show open loop first.
            loop_sort_title = ''
        else:
            loop_sort_title = ploop['loop_title']

        sort_key = (
            0 if ploop['peer_is_dfi_account'] else 1,
            peer_sort_title.lower(),
            peer_sort_title,
            peer_sort_id,
            '' if ploop['currency'] == 'USD' else ploop['currency'],
            loop_sort_title.lower(),
            loop_sort_title,
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
