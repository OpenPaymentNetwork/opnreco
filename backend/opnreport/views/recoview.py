
from colander import Integer
from colander import Length
from colander import Schema
from colander import SchemaNode
from colander import Sequence
from colander import String as ColString
from decimal import Decimal
from opnreport.models.db import AccountEntry
from opnreport.models.db import Movement
from opnreport.models.db import Reco
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.param import get_request_file
from opnreport.viewcommon import get_loop_map
from opnreport.viewcommon import MovementQueryHelper
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import cast
from sqlalchemy import func
from sqlalchemy import String
import datetime
import dateutil.parser
import re

zero = Decimal()
null = None


def start_movement_query(dbsession, owner_id, helper):
    return (
        dbsession.query(
            Movement.id,
            Movement.number,
            Movement.ts,
            Movement.loop_id,
            Movement.currency,
            helper.delta,
            helper.reco_id,
            TransferRecord.transfer_id)
        .join(
            TransferRecord,
            TransferRecord.id == Movement.transfer_record_id)
        .filter(
            Movement.owner_id == owner_id,
            # Note: movements of zero are not eligible for reconciliation.
            helper.delta != zero,
        ))


def render_movement_rows(movement_rows):
    res = []
    for row in movement_rows:
        res.append({
            'id': row.id,
            'ts': row.ts,
            'loop_id': row.loop_id,
            'currency': row.currency,
            'delta': row.delta,
            'transfer_id': row.transfer_id,
            'number': row.number,
        })
    return res


@view_config(
    name='reco-complete',
    context=API,
    permission='use_app',
    renderer='json')
def reco_complete_view(context, request):
    return reco_view(context, request, complete=True)


@view_config(
    name='reco',
    context=API,
    permission='use_app',
    renderer='json')
def reco_view(context, request, complete=False):
    """Return the state of a reco or a movement proposed for a reco."""

    file, _peer, _loop = get_request_file(request)

    reco_id_input = request.params.get('reco_id')
    movement_id_input = request.params.get('movement_id')
    account_entry_id_input = request.params.get('account_entry_id')

    try:
        reco_id = int(reco_id_input) if reco_id_input else None
        movement_id = int(movement_id_input) if movement_id_input else None
        account_entry_id = (
            int(account_entry_id_input) if account_entry_id_input else None)
    except ValueError:
        raise HTTPBadRequest(json_body={
            'error': 'bad reco_id, movement_id, or account_entry_id'})

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    comment = ''
    helper = MovementQueryHelper(
        dbsession=dbsession,
        file=file,
        owner_id=owner_id)

    if reco_id is not None:
        movement_rows = (
            start_movement_query(
                dbsession=dbsession, owner_id=owner_id, helper=helper)
            .filter(
                helper.reco_id == reco_id,
            )
            .order_by(
                Movement.ts,
                TransferRecord.transfer_id,
                Movement.number,
                Movement.amount_index,
                Movement.peer_id,
                Movement.loop_id,
                Movement.currency,
                Movement.issuer_id,
            )
            .all())

        account_entry_rows = (
            dbsession.query(AccountEntry)
            .filter(
                AccountEntry.owner_id == owner_id,
                AccountEntry.reco_id == reco_id,
            )
            .order_by(
                AccountEntry.entry_date,
                AccountEntry.id,
            )
            .all())

        reco = (
            dbsession.query(Reco)
            .filter(
                Reco.owner_id == owner_id,
                Reco.id == reco_id)
            .first())

        if reco is not None:
            comment = reco.comment or ''

    elif movement_id is not None:
        account_entry_rows = ()
        movement_rows = (
            start_movement_query(
                dbsession=dbsession, owner_id=owner_id, helper=helper)
            .filter(
                Movement.id == movement_id,
            )
            .all())

    elif account_entry_id is not None:
        movement_rows = ()
        account_entry_rows = (
            dbsession.query(AccountEntry)
            .filter(
                AccountEntry.owner_id == owner_id,
                AccountEntry.id == account_entry_id,
            )
            .all())

    else:
        movement_rows = account_entry_rows = ()

    need_loop_ids = set()
    for row in movement_rows:
        need_loop_ids.add(row.loop_id)

    movements_json = render_movement_rows(movement_rows)

    loops = get_loop_map(
        request=request,
        need_loop_ids=need_loop_ids,
        complete=complete)

    return {
        'movements': movements_json,
        'loops': loops,
        'is_circ': helper.is_circ,
        'comment': comment,
    }


@view_config(
    name='reco-search-movement',
    context=API,
    permission='use_app',
    renderer='json')
def reco_search_movement_view(context, request, complete=False):
    """Search for movements that haven't been reconciled."""

    file, _peer, _loop = get_request_file(request)

    params = request.json
    amount_input = str(params.get('amount', ''))
    date_input = str(params.get('date', ''))
    transfer_input = str(params.get('transfer', ''))
    # tzoffset is the number of minutes as given by
    # 'new Date().getTimezoneOffset()' in Javascript.
    tzoffset_input = str(params.get('tzoffset'))
    seen_movement_ids = set(
        int(mid) for mid in params.get('seen_movement_ids', ()))

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    helper = MovementQueryHelper(
        dbsession=dbsession,
        file=file,
        owner_id=owner_id)
    filters = []

    match = re.search(r'[+-]?[0-9\.]+', amount_input)
    if match is not None:
        amount_str = match.group(0)
        amount_abs = abs(Decimal(amount_str))
        if '.' in amount_str:
            # Exact amount.
            filters.append(func.abs(helper.delta) == amount_abs)
        else:
            # The search omitted the subunit value.
            filters.append(func.abs(helper.delta) >= amount_abs)
            filters.append(func.abs(helper.delta) < amount_abs + 1)
        if '-' in amount_str:
            filters.append(helper.delta < zero)
        elif '+' in amount_str:
            filters.append(helper.delta > zero)

    match = re.search(r'[a-z]+', amount_input)
    if match is not None:
        currency = match.group(0).upper()
        filters.append(
            Movement.currency.like(func.concat('%', currency, '%')))

    if date_input and tzoffset_input:
        try:
            parsed = dateutil.parser.parse(date_input)
            tzoffset = int(tzoffset_input)
        except Exception:
            pass
        else:
            if parsed is not None:
                ts = parsed + datetime.timedelta(seconds=tzoffset * 60)
                filters.append(Movement.ts >= ts)
                colon_count = sum((1 for c in date_input if c == ':'), 0)
                if colon_count >= 2:
                    # Query with second resolution
                    filters.append(
                        Movement.ts < ts + datetime.timedelta(seconds=1))
                elif colon_count >= 1:
                    # Query with minute resolution
                    filters.append(
                        Movement.ts < ts + datetime.timedelta(seconds=60))
                elif parsed.hour:
                    # Query with hour resolution
                    filters.append(
                        Movement.ts < ts + datetime.timedelta(seconds=3600))
                else:
                    # Query with day resolution
                    filters.append(
                        Movement.ts < ts + datetime.timedelta(days=1))

    match = re.search(r'[0-9\-]+', transfer_input)
    if match is not None:
        transfer_str = match.group(0).replace('-', '')
        if transfer_str:
            filters.append(
                cast(TransferRecord.transfer_id, String).like(
                    func.concat('%', transfer_str, '%')))

    if not filters:
        return []

    if seen_movement_ids:
        filters.append(~Movement.id.in_(seen_movement_ids))

    movement_rows = (
        start_movement_query(
            dbsession=dbsession, owner_id=owner_id, helper=helper)
        .filter(
            Movement.peer_id == file.peer_id,
            helper.reco_id == null,
            *filters
        )
        .order_by(
            Movement.ts,
            TransferRecord.transfer_id,
            Movement.number,
            Movement.amount_index,
            Movement.peer_id,
            Movement.loop_id,
            Movement.currency,
            Movement.issuer_id,
        )
        .limit(5)
        .all())

    movements_json = render_movement_rows(movement_rows)

    return movements_json


# Note: the schema below includes only the fields needed by reco-save.


class MovementSchema(Schema):
    id = SchemaNode(Integer())


class RecoSchema(Schema):
    movements = SchemaNode(
        Sequence(),
        MovementSchema(),
        missing=(),
        validator=Length(max=100))
    comment = SchemaNode(
        ColString(),
        missing='',
        validator=Length(max=10000))


class RecoSaveSchema(Schema):
    reco_id = SchemaNode(Integer(), missing=None)
    reco = RecoSchema()


@view_config(
    name='reco-save',
    context=API,
    permission='use_app',
    renderer='json')
def reco_save(context, request, complete=False):
    """Save changes to a reco."""

    file, _peer, _loop = get_request_file(request)

    params = RecoSaveSchema().deserialize(request.json)
    print(params)

    return {'ok': True}
