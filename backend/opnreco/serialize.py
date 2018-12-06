
from decimal import Decimal

zero = Decimal('0')


def serialize_period(period, end_amounts=None):
    """Serialize a Period object for JSON encoding.

    end_amounts is an optional dict of {'circ', 'surplus'} containing
    the computed end_circ and end_surplus values.
    """
    end_circ = period.end_circ
    if end_circ is None:
        if end_amounts:
            end_circ = end_amounts.get('circ')

    end_surplus = period.end_surplus
    if end_surplus is None:
        if end_amounts:
            end_surplus = end_amounts.get('surplus')

    if end_circ is not None and end_surplus is not None:
        end_combined = end_circ + end_surplus
    else:
        end_combined = None

    return {
        'period_id': str(period.id),
        'owner_id': period.owner_id,
        'peer_id': period.peer_id,
        'loop_id': period.loop_id,
        'currency': period.currency,
        'current': period.current,
        'has_vault': period.has_vault,
        'start_date': period.start_date,
        'end_date': period.end_date,
        'start_circ': period.start_circ,
        'end_circ': end_circ,
        'start_surplus': period.start_surplus,
        'end_surplus': end_surplus,
        'start_combined': period.start_circ + period.start_surplus,
        'end_combined': end_combined,
        'closed': period.closed,
    }
