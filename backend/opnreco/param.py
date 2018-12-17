
from decimal import Decimal
from decimal import InvalidOperation
from opnreco.models.db import Period
from opnreco.models.db import Loop
from opnreco.models.db import Peer
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.httpexceptions import HTTPNotFound
from sqlalchemy import and_
import re


null = None


def parse_ploop_key(ploop_key):
    """Parse the ploop_key param. Return (peer_id, loop_id, currency).

    Raise HTTPBadRequest or HTTPNotFound as needed.

    A ploop_key is a string containing 'peer_id-loop_id-currency'.
    """
    if not ploop_key:
        raise HTTPBadRequest(
            json_body={'error': 'ploop_key_required'})

    match = re.match(
        r'^(c|[0-9]{1,20})-([0-9]{1,20})-([A-Z]{3,50})$', ploop_key)
    if match is None:
        raise HTTPBadRequest(
            json_body={'error': 'invalid_ploop_key'})
    peer_id, loop_id, currency = match.groups()
    return (peer_id, loop_id, currency)


def get_request_period(request, for_write=False):
    """Get the period, peer, and loop specified in the request params.

    Raise HTTPBadRequest or HTTPNotFound as needed.

    The subpath must contain a ploop_key (peer_id-loop_id-currency)
    and period_id, where period_id may be 'current'.

    If for_write is true, this function raises HTTPBadRequest if
    the period is closed.
    """
    params = request.params
    peer_id, loop_id, currency = parse_ploop_key(params.get('ploop_key'))
    period_id_str = params.get('period_id', 'current')

    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession

    if period_id_str == 'current':
        period_id_filter = (Period.end_date == null)
    else:
        try:
            period_id = int(period_id_str)
        except ValueError:
            raise HTTPBadRequest(
                json_body={'error': 'bad_period_id'})
        period_id_filter = (Period.id == period_id)

    row = (
        dbsession.query(Period, Peer, Loop)
        .join(Peer, and_(
            Peer.owner_id == owner_id,
            Peer.peer_id == Period.peer_id))
        .outerjoin(Loop, and_(
            Loop.owner_id == owner_id,
            Loop.loop_id == Period.loop_id,
            Loop.loop_id != '0'))
        .filter(
            Period.owner_id == owner_id,
            Period.peer_id == peer_id,
            Period.loop_id == loop_id,
            Period.currency == currency,
            period_id_filter)
        .first())

    if row is None:
        raise HTTPNotFound()

    if for_write:
        period, _, _ = row
        if period.closed:
            raise HTTPBadRequest(json_body={
                'error': 'readonly',
                'error_description':
                    "The period from %s to %s is closed. "
                    "No changes are permitted unless the period "
                    "is reopened." % (
                    period.start_date.isoformat(),
                    period.end_date.isoformat()),
            })

    return row


def get_offset_limit(params):
    """Get the offset and limit from request params."""
    offset_str = params.get('offset', '')
    if not re.match(r'^[0-9]{1,20}$', offset_str):
        raise HTTPBadRequest(json_body={'error': 'offset_required'})
    offset = max(int(offset_str), 0)

    limit_str = params.get('limit', '')
    if limit_str == 'none':
        limit = None
    else:
        if not re.match(r'^[0-9]{1,20}$', limit_str):
            raise HTTPBadRequest(json_body={'error': 'limit_required'})
        limit = max(int(limit_str), 0)

    return offset, limit


amount_re = re.compile(r'[+-\u2212]?[0-9.,]{1,20}', re.U)


subunit0 = Decimal('0.')
subunit2 = Decimal('0.01')
subunit3 = Decimal('0.001')


currency_subunits = {
  'BHD': subunit3,
  'BYR': subunit0,
  'CLP': subunit0,
  'CVE': subunit0,
  'DJF': subunit0,
  'GNF': subunit0,
  'HUF': subunit0,
  'IDR': subunit0,
  'IQD': subunit3,
  'IRR': subunit0,
  'ISK': subunit0,
  'JOD': subunit3,
  'JPY': subunit0,
  'KHR': subunit0,
  'KMF': subunit0,
  'KRW': subunit0,
  'KWD': subunit3,
  'LBP': subunit0,
  'LYD': subunit3,
  'MGA': subunit0,
  'MRO': subunit0,
  'OMR': subunit3,
  'PYG': subunit0,
  'RWF': subunit0,
  'TND': subunit3,
  'UGX': subunit0,
  'VND': subunit0,
  'VUV': subunit0,
  'XAF': subunit0,
  'XOF': subunit0,
  'XPF': subunit0,
}


def parse_amount(amount_input, currency):
    match = amount_re.search(amount_input)
    if match is None:
        return None
    amount_input = match.group(0).replace('\u2212', '-').replace(',', '')
    try:
        return ParsedAmount(amount_input, currency)
    except InvalidOperation:
        return None


class ParsedAmount(Decimal):
    def __new__(cls, amount_input, currency):
        subunit = currency_subunits.get(currency, subunit2)
        value = Decimal(amount_input).quantize(subunit)
        self = Decimal.__new__(cls, value)
        self.amount_input = amount_input
        if '-' in amount_input:
            self.sign = -1
        elif '+' in amount_input:
            self.sign = 1
        else:
            # Unspecified.
            self.sign = 0
        return self
