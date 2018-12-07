
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


def get_request_period(request):
    """Get the period, peer, and loop specified in the request params.

    Raise HTTPBadRequest or HTTPNotFound as needed.

    The subpath must contain a ploop_key (peer_id-loop_id-currency)
    and period_id, where period_id may be 'current'.
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


def parse_amount(amount_input):
    match = amount_re.search(amount_input)
    if match is None:
        return None
    amount_str = match.group(0).replace('\u2212', '-').replace(',', '')
    try:
        return ParsedAmount(amount_str)
    except InvalidOperation:
        return None


class ParsedAmount(Decimal):
    def __new__(cls, amount_str):
        self = Decimal.__new__(cls, amount_str)
        self.str_value = amount_str
        if '-' in amount_str:
            self.sign = -1
        elif '+' in amount_str:
            self.sign = 1
        else:
            # Unspecified.
            self.sign = 0
        return self
