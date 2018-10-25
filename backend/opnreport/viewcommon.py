
from opnreport.models.db import Movement
from opnreport.models.db import Peer
from sqlalchemy import and_
from sqlalchemy import or_
from sqlalchemy import case

null = None


def list_circ_peer_ids(dbsession, owner_id):
    """List the circulation peer IDs for an owner.

    (Note that the number of circ peers is always expected to be
    zero, one, or a small number.)
    """
    circ_peer_id_rows = (
        dbsession.query(Peer.peer_id)
        .filter(
            Peer.owner_id == owner_id,
            Peer.is_circ)
        .all())

    return [x for (x,) in circ_peer_id_rows]


def make_movement_cte(dbsession, file, owner_id):
    """Create a common table expr (CTE) that lists movements in a file.

    Makes circulation replenishment movements look like normal movements.
    """
    if file.peer_id == 'c':
        # Include circulation replenishments.

        circ_peer_ids = list_circ_peer_ids(
            dbsession=dbsession, owner_id=owner_id)

        # is_circ_repl is true for movements that are circulation
        # replenishments.
        is_circ_repl = or_(
            Movement.circ_reco_id != null,
            and_(
                Movement.orig_peer_id.in_(circ_peer_ids),
                Movement.wallet_delta < 0))

        movement_delta_c = case([
            (is_circ_repl, Movement.wallet_delta),
        ], else_=Movement.vault_delta)

        reco_id_c = case([
            (is_circ_repl, Movement.circ_reco_id),
        ], else_=Movement.reco_id)

    else:
        # Simple case: no circulation replenishment is possible,
        # so just list the movements.
        movement_delta_c = Movement.wallet_delta
        reco_id_c = Movement.reco_id

    return (
        dbsession.query(
            Movement.id,
            movement_delta_c.label('delta'),
            Movement.ts,
            reco_id_c.label('reco_id'),
            Movement.transfer_record_id,
        )
        .filter(
            Movement.file_id == file.id,
            # The peer_id, loop_id, and currency conditions are redudandant,
            # but they might help avoid accidents.
            Movement.peer_id == file.peer_id,
            Movement.loop_id == file.loop_id,
            Movement.currency == file.currency,
        ).cte('movement_cte'))
