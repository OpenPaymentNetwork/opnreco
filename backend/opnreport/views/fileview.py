
from opnreport.models.db import File
from opnreport.models.site import API
from opnreport.param import get_offset_limit
from opnreport.param import parse_ploop_key
from opnreport.serialize import serialize_file
from opnreport.viewcommon import compute_file_totals
from pyramid.view import view_config
from sqlalchemy import func
import datetime


@view_config(
    name='files',
    context=API,
    permission='use_app',
    renderer='json')
def files_view(request):
    """Return a page of files for a ploop.
    """
    params = request.params
    peer_id, loop_id, currency = parse_ploop_key(params.get('ploop_key'))
    offset, limit = get_offset_limit(params)

    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession

    future = datetime.datetime.utcnow() + datetime.timedelta(days=366 * 100)

    query = (
        dbsession.query(File)
        .filter(
            File.owner_id == owner_id,
            File.peer_id == peer_id,
            File.loop_id == loop_id,
            File.currency == currency,
        )
        .order_by(func.coalesce(File.start_date, future).desc())
    )

    totals_row = (
        dbsession.query(
            func.count(1).label('rowcount'),
        )
        .select_from(query.subquery('subq'))
        .one())

    list_query = query.offset(offset)
    if limit is not None:
        list_query = list_query.limit(limit)
    file_rows = list_query.all()

    # Compute the end_circ and end_surplus for files that haven't computed
    # them yet.
    partial_ids = [
        file.id for file in file_rows
        if file.end_circ is None or file.end_surplus is None]
    if partial_ids:
        totals = compute_file_totals(
            dbsession=dbsession,
            owner_id=owner_id,
            file_ids=partial_ids)

        end_amounts_map = {
            file_id: {
                'circ': total['end']['circ'],
                'surplus': total['end']['surplus'],
            } for (file_id, total) in totals.items()}

    else:
        end_amounts_map = {}

    files = [
        serialize_file(f, end_amounts=end_amounts_map.get(f.id))
        for f in file_rows]

    return {
        'files': files,
        'rowcount': totals_row.rowcount,
    }
