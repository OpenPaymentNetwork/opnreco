
def serialize_file(file, peer, loop=None):
    """Serialize a File object for JSON encoding."""
    return {
        'file_id': str(file.id),
        'owner_id': file.owner_id,
        'peer_id': file.peer_id,
        'loop_id': file.loop_id,
        'currency': file.currency,
        'current': file.current,
        'has_vault': file.has_vault,
        'start_date': file.start_date,
        'end_date': file.end_date,
        'start_circ': file.start_circ,
        'end_circ': file.end_circ,
        'start_surplus': file.start_surplus,
        'end_surplus': file.end_surplus,
    }
