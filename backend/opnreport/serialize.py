
def serialize_file(file, peer, loop=None):
    """Serialize a File object for JSON encoding."""
    res = {
        'file_id': str(file.id),
        'owner_id': file.owner_id,
        'peer_id': file.peer_id,
        'loop_id': file.loop_id,
        'currency': file.currency,
        'current': file.current,
        'has_vault': file.has_vault,
        'subtitle': file.subtitle,
        'start_date': file.start_date,
        'start_circ': file.start_circ,
        'start_surplus': file.start_surplus,
        'end_date': file.end_date,
        'end_circ': file.end_circ,
        'end_surplus': file.end_surplus,
    }

    if file.current:
        loop_title = (
            '[Cash Design %s]' % file.loop_id if loop is None
            else loop.title)

        res.update({
            'peer_title': peer.title,
            'peer_username': peer.username,
            'peer_is_dfi_account': peer.is_dfi_account,
            'peer_is_own_dfi_account': peer.is_own_dfi_account,
            'loop_title': loop_title,
        })

    else:
        res.update({
            'peer_title': file.peer_title,
            'peer_username': file.peer_username,
            'peer_is_dfi_account': file.peer_is_dfi_account,
            'peer_is_own_dfi_account': file.peer_is_own_dfi_account,
            'loop_title': file.loop_title,
        })

    return res
