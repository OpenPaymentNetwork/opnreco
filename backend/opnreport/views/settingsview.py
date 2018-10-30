
from opnreport.models.db import File
from opnreport.models.db import OwnerLog
from opnreport.models.db import Peer
from opnreport.models.site import API
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import func


@view_config(
    name='settings',
    context=API,
    permission='use_app',
    renderer='json')
def settings_view(request):
    """Return the current settings for the user."""
    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession

    res = {}

    c_files = (
        dbsession.query(func.count(1))
        .select_from(File)
        .filter(
            File.owner_id == owner_id,
            File.peer_id == 'c',
            File.has_vault,
        )
        .scalar())

    if c_files:
        # Offer circulation account settings.
        res['is_issuer'] = True

        rows = (
            dbsession.query(Peer)
            .filter(
                Peer.owner_id == owner_id,
                Peer.peer_id != 'c',
                Peer.is_own_dfi_account,
                ~Peer.removed,
            )
            .order_by(Peer.title, Peer.username)
            .all())

        res['account_peers'] = [{
            'peer_id': row.peer_id,
            'title': row.title,
            'username': row.username,
            'is_dfi_account': row.is_dfi_account,
            'is_own_dfi_account': row.is_own_dfi_account,
            'is_circ': row.is_circ,
        } for row in rows]

    return res


@view_config(
    name='set-circ-accounts',
    context=API,
    permission='use_app',
    renderer='json')
def set_circ_accounts_view(request):
    """Set the circulation accounts for the current owner."""
    circ_map = request.json.get('circ_map')
    if circ_map is None or not isinstance(circ_map, dict):
        raise HTTPBadRequest(json_body={
            'error': 'Bad or missing circ_map parameter',
        })

    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession

    rows = (
        dbsession.query(Peer)
        .filter(
            Peer.owner_id == owner_id,
            Peer.peer_id != 'c',
            Peer.is_own_dfi_account,
            ~Peer.removed,
        )
        .order_by(Peer.title, Peer.username)
        .all())

    changed_circs = {}

    for peer in rows:
        is_circ = circ_map.get(peer.peer_id)
        if is_circ is not None:
            is_circ = not not is_circ
            if peer.is_circ != is_circ:
                peer.is_circ = is_circ
                changed_circs[peer.peer_id] = is_circ

    if changed_circs:
        dbsession.add(OwnerLog(
            owner_id=owner_id,
            event_type='set_circ_accounts',
            remote_addr=request.remote_addr,
            user_agent=request.user_agent,
            content={
                'changed_circs': changed_circs,
            },
        ))

    return {'ok': True}
