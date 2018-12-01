
from opnreport.models.db import File
from opnreport.models.db import Movement
from opnreport.models.site import API
from opnreport.param import get_offset_limit
from opnreport.param import parse_ploop_key
from opnreport.serialize import serialize_file
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
        movement_sum_rows = (
            dbsession.query(
                Movement.file_id,
                func.sum(-Movement.vault_delta).label('circ'),
                func.sum(-Movement.reco_wallet_delta).label('surplus'),
            )
            .filter(
                Movement.owner_id == owner_id,
                Movement.file_id.in_(partial_ids),
                # The peer_id, loop_id, and currency conditions are
                # redudandant, but they might help avoid accidents.
                Movement.peer_id == peer_id,
                Movement.loop_id == loop_id,
                Movement.currency == currency,
            )
            .group_by(Movement.file_id)
            .all())

        # TODO: include the effect of reconciled account entries.
        # Create a function that computes the amounts for a list
        # of files. It must separate reconciled movements from
        # unreconciled movements. Compute just like the current
        # recoreportview, then make recoreportview use the new function
        # as well.

        # entry_sum_rows = (
        #     dbsession.query(
        #         AccountEntry.file_id,
        #         func.sum(AccountEntry.delta).label('delta'),
        #     )
        #     .filter(
        #         AccountEntry.owner_id == owner_id,
        #         AccountEntry.file_id.in_(partial_ids),
        #         AccountEntry.reco_id != null,
        #     )
        #     .group_by(AccountEntry.file_id)
        #     .all())

        # end_amounts_map = {}
        # for file_id in partial_ids:

        end_amounts_map = {
            row.file_id: {'circ': row.circ, 'surplus': row.surplus}
            for row in movement_sum_rows}
    else:
        end_amounts_map = {}

    files = [
        serialize_file(f, end_amounts=end_amounts_map.get(f.id))
        for f in file_rows]

    return {
        'files': files,
        'rowcount': totals_row.rowcount,
    }
