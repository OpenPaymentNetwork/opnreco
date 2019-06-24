

from opnreco.models import perms
from opnreco.models.db import Period
from opnreco.models.db import File
from opnreco.models.site import FileCollection
from opnreco.models.site import FileResource
from pyramid.view import view_config
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy.orm import aliased


@view_config(
    name='',
    context=FileCollection,
    permission=perms.use_app,
    renderer='json')
def list_files(context, request):
    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession
    selected_period_id = request.params.get('period_id')

    file_rows = (
        dbsession.query(File)
        .filter(File.owner_id == owner_id)
        .order_by(File.title)
        .all())

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
        .filter(Period.owner_id == owner_id)
        .subquery('subq'))

    period_alias = aliased(Period, subq)
    period_filters = [subq.c.rownum <= 10]
    if selected_period_id:
        period_filters.append(subq.c.id == int(selected_period_id))
    period_rows = (
        dbsession.query(period_alias)
        .filter(or_(*period_filters))
        .all())

    # files: {str(file_id): {periods, period_order, ...}}
    files = {}
    file_order = []

    for file_row in file_rows:
        file_id_str = str(file_row.id)
        files[file_id_str] = {
            'id': file_id_str,
            'title': file_row.title,
            'currency': file_row.currency,
            'has_vault': file_row.has_vault,
            'periods': {},
            'period_order': [],
        }
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
    name='',
    context=FileResource,
    permission=perms.view_file,
    renderer='json')
def file_state(context, request):
    file = context.file
    return {
        'id': str(file.id),
        'title': file.title,
        'currency': file.currency,
        'has_vault': file.has_vault,
    }


@view_config(
    name='suggested-files',
    context=FileCollection,
    permission=perms.use_app,
    renderer='json')
def list_suggested_files(context, request):
    return {}

