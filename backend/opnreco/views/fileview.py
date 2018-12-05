
from opnreco.models.db import File
from opnreco.models.db import now_func
from opnreco.models.db import Statement
from opnreco.models.site import API
from opnreco.param import get_offset_limit
from opnreco.param import parse_ploop_key
from opnreco.serialize import serialize_file
from opnreco.viewcommon import compute_file_totals
from opnreco.viewcommon import get_loop_map
from opnreco.viewcommon import get_peer_map
from pyramid.httpexceptions import HTTPBadRequest
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

    all_file_ids = [file.id for file in file_rows]

    statement_rows = (
        dbsession.query(
            Statement.file_id,
            func.count(1).label('count'),
        )
        .filter(
            Statement.owner_id == owner_id,
            Statement.file_id.in_(all_file_ids),
        )
        .group_by(Statement.file_id)
        .all())

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

    statement_map = {row.file_id: row.count for row in statement_rows}

    files = []
    for f in file_rows:
        file_id = f.id
        file_state = serialize_file(f, end_amounts=end_amounts_map.get(f.id))
        file_state['statement_count'] = statement_map.get(file_id, 0)
        files.append(file_state)

    return {
        'files': files,
        'rowcount': totals_row.rowcount,
    }


@view_config(
    name='file',
    context=API,
    permission='use_app',
    renderer='json')
def file_view(request):
    """Return info about a file, its peer, and its loop."""
    try:
        file_id = int(request.params['file_id'])
    except Exception:
        raise HTTPBadRequest(json_body={
            'error': 'bad_file_id',
        })

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    now = dbsession.query(now_func).scalar()

    file = (
        dbsession.query(File)
        .filter(
            File.owner_id == owner_id,
            File.id == file_id,
        )
        .first())
    if file is None:
        raise HTTPBadRequest(json_body={
            'error': 'file_not_found',
            'error_description': (
                "No file found for your profile with file ID %s" % file_id),
        })

    totals = compute_file_totals(
        dbsession=dbsession,
        owner_id=owner_id,
        file_ids=[file.id])[file_id]

    end_amounts = {
        'circ': totals['end']['circ'],
        'surplus': totals['end']['surplus'],
    }

    peers = get_peer_map(
        request=request, need_peer_ids=set([file.peer_id]), final=True)

    if file.loop_id != '0':
        loops = get_loop_map(
            request=request, need_loop_ids=set([file.loop_id]), final=True)
    else:
        loops = {}

    res = {
        'now': now,
        'file': serialize_file(file, end_amounts=end_amounts),
        'peer': peers.get(file.peer_id),
        'loop': loops.get(file.loop_id),
        'totals': totals,
    }

    return res
