

from opnreco.models import perms
from opnreco.models.db import File
from opnreco.models.db import OwnerLog
from opnreco.models.db import Period
from opnreco.models.site import FileCollection
from opnreco.models.site import FileResource
from opnreco.viewcommon import handle_invalid
from pyramid.view import view_config
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

    request.dbsession.add(OwnerLog(
        owner_id=request.owner.id,
        personal_id=request.personal_id,
        event_type='edit_file',
        content={
            'file_id': file.id,
            'title': file.title,
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

# def serialize_rules(request, file, final):
#     """List the rules for the file. Include profile and loop info."""
#     rules = (
#         request.dbsession.query(FileRule)
#         .filter(
#             FileRule.file_id == file.id,
#             FileRule.owner_id == request.owner.id,
#         )
#         .order_by(FileRule.id)
#         .all())

#     need_peer_ids = set()
#     need_loop_ids = set()
#     for rule in rules:
#         need_peer_ids.add(rule.self_id)
#         peer_id = rule.peer_id
#         if peer_id:
#             need_peer_ids.add(peer_id)
#         loop_id = rule.loop_id
#         if loop_id and loop_id != '0':
#             need_loop_ids.add(loop_id)
#     peer_map = get_peer_map(
#         request=request, need_peer_ids=need_peer_ids, final=final)
#     loop_map = get_loop_map(
#         request=request, need_loop_ids=need_loop_ids, final=final)

#     res = []
#     for rule in rules:
#         self_id = rule.self_id
#         peer_id = rule.peer_id
#         loop_id = rule.loop_id
#         res.append({
#             'id': rule.id,
#             'self_id': self_id,
#             'peer_id': peer_id,
#             'loop_id': loop_id,
#             'self': peer_map[self_id],
#             'peer': peer_map[peer_id] if peer_id else None,
#             'loop': loop_map[loop_id] if loop_id and loop_id != '0' else None,
#         })
#     return res


# @view_config(
#     name='rules',
#     context=FileResource,
#     permission=perms.view_file,
#     renderer='json')
# def file_rules_final_api(context, request):
#     return serialize_rules(request=request, file=context.file, final=False)


# @view_config(
#     name='rules-final',
#     context=FileResource,
#     permission=perms.view_file,
#     renderer='json')
# def file_rules_api(context, request):
#     return serialize_rules(request=request, file=context.file, final=True)
