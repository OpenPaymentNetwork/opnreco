
from decimal import Decimal
from opnreport.models.db import AccountEntry
from opnreport.models.db import AccountEntryReco
from opnreport.models.db import CircReplReco
from opnreport.models.db import Movement
from opnreport.models.db import MovementReco
from opnreport.models.db import Peer
from opnreport.models.db import Reco
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.param import get_request_file
from opnreport.serialize import serialize_file
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import and_
from sqlalchemy import func
from sqlalchemy import or_
import collections
import re


null = None
zero = Decimal()


@view_config(
    name='transactions',
    context=API,
    permission='use_app',
    renderer='json')
def transactions_view(request):
    file, peer, loop = get_request_file(request)
    file_peer_id = file.peer_id

    if file_peer_id == 'c':
        movement_delta_c = Movement.vault_delta
    else:
        movement_delta_c = Movement.wallet_delta

    page_index_str = request.params.get('page_index', '')
    if re.match(r'^[0-9]+$`', page_index_str):
        raise HTTPBadRequest(json_body={'error': 'page_index required'})

    return {}