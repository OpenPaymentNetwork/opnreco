
from decimal import Decimal
from decimal import InvalidOperation
from opnreport.models.db import File
from opnreport.models.db import Loop
from opnreport.models.db import Peer
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.httpexceptions import HTTPNotFound
from sqlalchemy import and_
import re


def get_request_file(request):
    """Get the file, peer, and loop specified in the request subpath.

    Raise HTTPBadRequest or HTTPNotFound as needed.

    The subpath must contain a ploop_key (peer_id-loop_id-currency)
    and file_id, where file_id may be 'current'.
    """
    params = request.params
    ploop_key = params.get('ploop_key')
    file_id_str = params.get('file_id', 'current')
    if not ploop_key:
        raise HTTPBadRequest(
            json_body={'error': 'ploop_key required'})

    match = re.match(r'^(c|[0-9]+)-([0-9]+)-([A-Z]{3})$', ploop_key)
    if match is None:
        raise HTTPBadRequest(
            json_body={'error': 'invalid ploop_key provided'})
    peer_id, loop_id, currency = match.groups()

    owner = request.owner
    owner_id = owner.id
    dbsession = request.dbsession

    if file_id_str == 'current':
        file_id_filter = File.current
    else:
        try:
            file_id = int(file_id_str)
        except ValueError:
            raise HTTPBadRequest(
                json_body={'error': 'bad file_id provided'})
        file_id_filter = (File.id == file_id)

    row = (
        dbsession.query(File, Peer, Loop)
        .join(Peer, and_(
            Peer.owner_id == owner_id,
            Peer.peer_id == File.peer_id))
        .outerjoin(Loop, and_(
            Loop.owner_id == owner_id,
            Loop.loop_id == File.loop_id,
            Loop.loop_id != '0'))
        .filter(
            File.owner_id == owner_id,
            File.peer_id == peer_id,
            File.loop_id == loop_id,
            File.currency == currency,
            file_id_filter)
        .first())

    if row is None:
        raise HTTPNotFound()

    return row


amount_re = re.compile(r'[+-\u2212]?[0-9.,]+', re.U)


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
