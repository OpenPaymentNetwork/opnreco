
from opnreport.models.db import File
from opnreport.models.db import Mirror
from opnreport.models.site import API
from pyramid.view import view_config
import collections

null = None


@view_config(
    name='mirrors-and-files',
    context=API,
    permission='use_app',
    renderer='json')
def mirrors_and_files_view(request):
    """Return the profile's list of mirrors and files within the mirrors.

    Returns {
        'mirrors': {mirror_id: {
            'mirror_id',
            'target_id',
            'loop_id',
            'currency',
            'target_title',
            'target_is_account',
            'loop_title',
            'files': {file_id: {
                'file_id',
                'start_date',
                'end_date',
                'subtitle',
            }},
            'file_order': [file_id],
        }},
        'mirror_order': [mirror_id],
        'default_mirror': mirror_id,
    }.
    """
    profile = request.profile
    profile_id = profile.id
    dbsession = request.dbsession

    new_mirrors = (
        dbsession.query(Mirror)
        .filter_by(profile_id=profile_id)
        .filter_by(file_id=null)
        .all())

    current_mirror_ids = [m.id for m in new_mirrors]

    filed_mirrors = (
        dbsession.query(Mirror)
        .filter_by(profile_id=profile_id)
        .filter(Mirror.file_id != null)
        .filter(~Mirror.id.in_(current_mirror_ids))
        .order_by(Mirror.last_update.desc())
        .all())

    file_rows = (
        dbsession.query(File, Mirror)
        .filter(File.mirror_id == Mirror.id)
        .filter(File.profile_id == profile_id)
        .order_by(File.end_date.desc())
        .all())

    # file_map: {
    #   (target_id, loop_id, currency):
    #     [{file_id, start_date, end_date, subtitle}]
    # }
    file_map = collections.defaultdict(dict)
    file_orders = collections.defaultdict(list)
    for file, mirror in file_rows:
        key = (mirror.target_id, mirror.loop_id, mirror.currency)
        file_id_str = str(file.id)
        file_map[key][file_id_str] = {
            'file_id': file_id_str,
            'start_date': file.start_date.isoformat(),
            'end_date': file.end_date.isoformat(),
            'subtitle': file.subtitle,
        }
        file_orders[key].append(file_id_str)

    # mirror_map: {
    #   (target_id, loop_id, currency):
    #     {mirror_id, target_title, loop_title, ..., files: [file_map entry]}
    # }
    mirror_map = {}

    for mirror in new_mirrors + filed_mirrors:
        key = (mirror.target_id, mirror.loop_id, mirror.currency)
        md = mirror_map.get(key)
        if not md:
            mirror_id_str = str(mirror.id)
            mirror_map[key] = {
                'mirror_id': mirror_id_str,
                'target_id': mirror.target_id,
                'loop_id': mirror.loop_id,
                'currency': mirror.currency,
                'target_title': mirror.target_title or profile.title,
                'target_is_account': mirror.target_is_account,
                'loop_title': mirror.loop_title or '',
                'files': file_map[key],
                'file_order': file_orders[key],
            }
        else:
            md = mirror_map[key]
            # Set the target_title and loop_title if not already set.
            # Note: don't update the mirror_id.
            if not md['target_title'] and mirror.target_title:
                md['target_title'] = mirror.target_title
            if not md['loop_title'] and mirror.loop_title:
                md['loop_title'] = mirror.loop_title

    # Prepare to sort the mirror map.
    # Also determine the best default mirror.
    defaults = []
    for md in mirror_map.values():
        if md['target_id'] == 'c':
            # Show circulation first.
            target_title = ''
            target_id = ''
        else:
            target_title = md['target_title']
            target_id = md['target_id']

        loop_id = md['loop_id']
        if loop_id == '0':
            # Show open loop first.
            loop_title = ''
        else:
            loop_title = md['loop_title']

        md['sort_key'] = sort_key = (
            0 if md['target_is_account'] else 1,
            target_title.lower(),
            target_title,
            target_id,
            '' if md['currency'] == 'USD' else md['currency'],
            loop_title.lower(),
            loop_title,
            loop_id,
        )

        # Prefer to reconcile issuing accounts over other types of mirrors.
        default_key = (
            0 if md['target_id'] == 'c' else 1,
            0 if md['loop_id'] == '0' else 1,
        ) + sort_key

        defaults.append((default_key, md['mirror_id']))

    # Sort.
    mirrors_sorted = sorted(mirror_map.values(), key=lambda md: md['sort_key'])

    # Remove the sort_keys.
    for md in mirrors_sorted:
        del md['sort_key']

    # Choose the best default mirror.
    defaults.sort()

    return {
        'mirrors': {md['mirror_id']: md for md in mirrors_sorted},
        'mirror_order': [md['mirror_id'] for md in mirrors_sorted],
        'default_mirror': defaults[0][1] if defaults else '',
    }
