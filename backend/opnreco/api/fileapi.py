

from opnreco.models import perms
from opnreco.models.db import File
from opnreco.models.db import FileLoopConfig
from opnreco.models.db import FileSync
from opnreco.models.db import Loop
from opnreco.models.db import Movement
from opnreco.models.db import OwnerLog
from opnreco.models.db import Peer
from opnreco.models.db import Period
from opnreco.models.site import FileCollection
from opnreco.models.site import FileResource
from opnreco.param import all_currencies
from opnreco.param import get_offset_limit
from opnreco.syncbase import SyncBase
from opnreco.viewcommon import get_loop_map
from opnreco.viewcommon import get_peer_map
from opnreco.viewcommon import handle_invalid
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import and_
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy.orm import aliased
import colander


def serialize_file(file):
    return {
        'id': str(file.id),
        'file_type': file.file_type,
        'title': file.title,
        'owner_title': file.owner.title,
        'currency': file.currency,
        'has_vault': file.has_vault,
        'peer_id': file.peer_id,
        'auto_enable_loops': file.auto_enable_loops,
        'archived': file.archived,
    }


@view_config(
    name='',
    context=FileCollection,
    permission=perms.use_app,
    renderer='json')
def list_files(context, request, archived=False):
    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession
    selected_period_id = request.params.get('period_id')

    file_filter = File.archived if archived else ~File.archived
    if selected_period_id:
        # Include the file for the specified period.
        row = (
            dbsession.query(Period.file_id)
            .filter(
                Period.owner_id == owner_id,
                Period.id == int(selected_period_id)
            )
            .first())
        if row:
            file_filter = or_(file_filter, File.id == row[0])

    open_subq = (
        dbsession.query(func.count())
        .select_from(Period)
        .filter(
            Period.file_id == File.id,
            ~Period.closed,
        )
        .as_scalar())

    closed_subq = (
        dbsession.query(func.count())
        .select_from(Period)
        .filter(
            Period.file_id == File.id,
            Period.closed,
        )
        .as_scalar())

    file_rows = (
        dbsession.query(
            File,
            open_subq,
            closed_subq)
        .filter(
            File.owner_id == owner_id,
            file_filter)
        .order_by(File.title)
        .all())
    file_ids = [file.id for (file, _, _) in file_rows]

    # Now list some of the periods in each file.
    # Get up to 10 periods per file, plus the selected period, if any.
    # (To access more of the periods, the user should select the period
    # using the Periods tab.)
    subq = (
        dbsession.query(
            Period,
            func.row_number().over(
                partition_by=(Period.file_id,),
                order_by=Period.start_date.desc(),
            ).label('rownum'),
        )
        .join(File, File.id == Period.file_id)
        .filter(Period.owner_id == owner_id, File.id.in_(file_ids))
        .subquery('subq'))

    period_alias = aliased(Period, subq)
    period_filter = subq.c.rownum <= 10
    if selected_period_id:
        period_filter = or_(
            period_filter, subq.c.id == int(selected_period_id))
    period_rows = (
        dbsession.query(period_alias)
        .filter(period_filter)
        .all())

    # files: {str(file_id): {periods, period_order, ...}}
    files = {}
    file_order = []

    for file_row, open_period_count, closed_period_count in file_rows:
        file_id_str = str(file_row.id)
        serialized = serialize_file(file_row)
        serialized.update({
            'periods': {},
            'period_order': [],
            'open_period_count': open_period_count,
            'closed_period_count': closed_period_count,
        })
        files[file_id_str] = serialized
        file_order.append(file_id_str)

    period_to_file_id = {}  # {str(period_id): str(file_id)}

    for period in period_rows:
        file_id_str = str(period.file_id)
        file = files[file_id_str]
        period_id_str = str(period.id)
        file['periods'][period_id_str] = {
            'id': period_id_str,
            'start_date': period.start_date,
            'end_date': period.end_date,
            'closed': period.closed,
        }
        file['period_order'].append(period_id_str)
        period_to_file_id[period_id_str] = file_id_str

    return {
        'files': files,
        'file_order': file_order,
        'period_to_file_id': period_to_file_id,
        'default_file_id': file_order[0] if len(file_order) == 1 else None,
        'owner_title': owner.title,
    }


@view_config(
    name='archived',
    context=FileCollection,
    permission=perms.use_app,
    renderer='json')
def list_archived_files(context, request):
    return list_files(context, request, archived=True)


@view_config(
    name='',
    context=FileResource,
    permission=perms.view_file,
    renderer='json')
def file_state(context, request):
    return serialize_file(context.file)


class FileSaveSchema(colander.Schema):
    title = colander.SchemaNode(
        colander.String(), validator=colander.Length(max=50))
    auto_enable_loops = colander.SchemaNode(
        colander.Boolean(), missing=None)
    reinterpret = colander.SchemaNode(
        colander.Boolean(), missing=False)


@view_config(
    name='save',
    context=FileResource,
    permission=perms.edit_file,
    renderer='json')
def file_save(context, request):
    """Change the file."""
    file = context.file

    schema = FileSaveSchema()
    try:
        appstruct = schema.deserialize(request.json)
    except colander.Invalid as e:
        handle_invalid(e, schema=schema)

    file.title = appstruct['title']

    if file.file_type == 'closed_circ':
        file.auto_enable_loops = appstruct['auto_enable_loops']

    if appstruct['reinterpret']:
        # Reinterpret all the movements in this file.
        # This may make some movements reconcileable and may make
        # reconciliation unavailable for some unreconciled movements.
        # It does not remove reconciled movements.
        dbsession = request.dbsession
        query = (
            dbsession.query(FileSync).filter(FileSync.file_id == file.id))
        query.delete(synchronize_session=False)

        dbsession.expire_all()
        sync = SyncBase(request)
        sync.sync_missing()

    request.dbsession.add(OwnerLog(
        owner_id=request.owner.id,
        personal_id=request.personal_id,
        event_type='edit_file',
        content={
            'file_id': file.id,
            'title': file.title,
            'auto_enable_loops': appstruct.get('auto_enable_loops'),
            'reinterpret': appstruct['reinterpret'],
        }))

    return serialize_file(file)


@view_config(
    name='archive',
    context=FileResource,
    permission=perms.edit_file,
    renderer='json')
def file_archive(context, request):
    """Archive the file.

    This merely marks the file as archived, preventing changes until
    the user unarchives it.
    """
    file = context.file
    file.archived = True

    request.dbsession.add(OwnerLog(
        owner_id=request.owner.id,
        personal_id=request.personal_id,
        event_type='archive_file',
        content={
            'file_id': file.id,
            'archived': True,
        }))

    return serialize_file(file)


@view_config(
    name='unarchive',
    context=FileResource,
    permission=perms.unarchive_file,
    renderer='json')
def file_unarchive(context, request):
    """Unarchive the file.
    """
    file = context.file
    file.archived = False

    request.dbsession.add(OwnerLog(
        owner_id=request.owner.id,
        personal_id=request.personal_id,
        event_type='unarchive_file',
        content={
            'file_id': file.id,
            'archived': False,
        }))

    return serialize_file(file)


@view_config(
    name='account_peers',
    context=FileCollection,
    permission=perms.use_app,
    renderer='json')
def account_peers(context, request):
    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession

    peers = (
        dbsession.query(Peer)
        .filter(
            Peer.owner_id == owner_id,
            Peer.is_dfi_account,
            Peer.is_own_dfi_account,
            ~Peer.removed,
        )
        .order_by(Peer.title, Peer.peer_id)
        .all())

    json_peers = {peer.peer_id: {'title': peer.title} for peer in peers}
    return {
        'peer_order': [peer.peer_id for peer in peers],
        'peers': json_peers,
    }


class FileAddSchema(colander.Schema):
    file_type = colander.SchemaNode(
        colander.String(), validator=colander.OneOf([
            'open_circ', 'closed_circ', 'account',
        ]))
    currency = colander.SchemaNode(
        colander.String(), validator=colander.OneOf(all_currencies))
    title = colander.SchemaNode(
        colander.String(), validator=colander.Length(max=100))
    peer_id = colander.SchemaNode(
        colander.String(), validator=colander.Length(max=50), missing=None)
    auto_enable_loops = colander.SchemaNode(
        colander.Boolean(), missing=False)


def validate_file_add(node, appstruct):
    if appstruct is colander.null:
        return appstruct

    file_type = appstruct['file_type']
    if file_type == 'account' and not appstruct['peer_id']:
        error = colander.Invalid(node)
        error['peer_id'] = "Required"
        raise error


@view_config(
    name='add',
    context=FileCollection,
    permission=perms.use_app,
    renderer='json')
def add_file(context, request):
    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession

    schema = FileAddSchema(validator=validate_file_add)
    try:
        params = schema.deserialize(request.json)
    except colander.Invalid as e:
        handle_invalid(e, schema=schema)

    file_type = params['file_type']
    has_vault = file_type in ('open_circ', 'closed_circ')
    peer_id = params['peer_id'] if file_type == 'account' else None
    auto_enable_loops = (
        params['auto_enable_loops'] if file_type == 'closed_circ' else None)

    file = File(
        owner_id=owner_id,
        file_type=file_type,
        title=params['title'],
        currency=params['currency'],
        has_vault=has_vault,
        peer_id=peer_id,
        auto_enable_loops=auto_enable_loops,
        archived=False)
    dbsession.add(file)
    dbsession.flush()  # Assign file.id

    return serialize_file(file)


def page_loop_configs(request, file, final):
    """Page through the list of FileLoopConfigs for the file.

    Include issuer and loop info.
    """
    dbsession = request.dbsession
    params = request.params
    offset, limit = get_offset_limit(params)
    owner_id = request.owner.id

    query = (
        dbsession.query(FileLoopConfig)
        .outerjoin(Loop, and_(
            Loop.owner_id == owner_id,
            Loop.loop_id == FileLoopConfig.owner_id))
        .outerjoin(Peer, and_(
            Peer.owner_id == owner_id,
            Peer.peer_id == FileLoopConfig.issuer_id))
        .filter(
            FileLoopConfig.file_id == file.id,
            FileLoopConfig.owner_id == owner_id,
        )
        .order_by(
            Loop.title,
            Peer.title,
            FileLoopConfig.id.desc(),
        ))

    totals_row = (
        dbsession.query(
            func.count(1).label('rowcount'),
        )
        .select_from(query.subquery('subq'))
        .one())

    list_query = query.offset(offset)
    if limit is not None:
        list_query = list_query.limit(limit)
    rows = list_query.all()

    need_peer_ids = set()
    need_loop_ids = set()
    for row in rows:
        loop_id = row.loop_id
        if loop_id and loop_id != '0':
            need_loop_ids.add(loop_id)
        issuer_id = row.issuer_id
        if issuer_id:
            need_peer_ids.add(issuer_id)
    peer_map = get_peer_map(
        request=request, need_peer_ids=need_peer_ids, final=final)
    loop_map = get_loop_map(
        request=request, need_loop_ids=need_loop_ids, final=final)

    json_loops = []
    for row in rows:
        loop_id = row.loop_id
        issuer_id = row.issuer_id
        json_loops.append({
            'id': str(row.id),
            'issuer_id': issuer_id,
            'issuer': peer_map[issuer_id] if issuer_id else None,
            'loop_id': loop_id,
            'loop': loop_map[loop_id] if loop_id and loop_id != '0' else None,
            'enabled': row.enabled,
        })
    return {
        'loops': json_loops,
        'rowcount': totals_row.rowcount,
    }


@view_config(
    name='loops',
    context=FileResource,
    permission=perms.view_file,
    renderer='json')
def file_loops_final_api(context, request):
    return page_loop_configs(request=request, file=context.file, final=False)


@view_config(
    name='loops-final',
    context=FileResource,
    permission=perms.view_file,
    renderer='json')
def file_loops_api(context, request):
    return page_loop_configs(request=request, file=context.file, final=True)


@view_config(
    name='configure-loops',
    context=FileResource,
    permission=perms.edit_file,
    renderer='json')
def configure_loops_api(context, request):
    """Change the enabled flag of some FileLoopConfigs and reinterpret."""
    file = context.file
    loops_enabled = request.json['configs_enabled']
    if not isinstance(loops_enabled, dict):
        raise HTTPBadRequest()

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    movement_filters = []
    for k, v in loops_enabled.items():
        try:
            config_id = int(k)
            enabled = bool(v)
        except ValueError:
            raise HTTPBadRequest()

        config = (
            dbsession.query(FileLoopConfig)
            .filter(
                FileLoopConfig.owner_id == owner_id,
                FileLoopConfig.file_id == file.id,
                FileLoopConfig.id == config_id,
            )
            .first())

        if config is None:
            continue

        config.enabled = enabled
        movement_filters.append(and_(
            Movement.loop_id == config.loop_id,
            Movement.issuer_id == config.issuer_id))

    if movement_filters:
        # Reinterpret all transfers involving affected movements.
        transfer_record_ids = (
            dbsession.query(Movement.transfer_record_id)
            .filter(
                Movement.owner_id == owner_id,
                or_(*movement_filters))
            .distinct()
        )

        query = (
            dbsession.query(FileSync)
            .filter(
                FileSync.file_id == file.id,
                FileSync.transfer_record_id.in_(
                    transfer_record_ids.subquery('subq')))
            )
        query.delete(synchronize_session=False)

        dbsession.expire_all()
        sync = SyncBase(request)
        sync.sync_missing()

    return {}
