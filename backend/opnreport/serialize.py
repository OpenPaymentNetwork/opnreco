
from decimal import Decimal

zero = Decimal('0')


def serialize_file(file, end_amounts=None):
    """Serialize a File object for JSON encoding.

    end_amounts is an optional dict of {'circ', 'surplus'} containing
    the computed end_circ and end_surplus values.
    """
    end_circ = file.end_circ
    if end_circ is None:
        if end_amounts:
            end_circ = end_amounts.get('circ')

    end_surplus = file.end_surplus
    if end_surplus is None:
        if end_amounts:
            end_surplus = end_amounts.get('surplus')

    if end_circ is not None and end_surplus is not None:
        end_combined = end_circ + end_surplus
    else:
        end_combined = None

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
        'end_circ': end_circ,
        'start_surplus': file.start_surplus,
        'end_surplus': end_surplus,
        'start_combined': file.start_circ + file.start_surplus,
        'end_combined': end_combined,
    }
