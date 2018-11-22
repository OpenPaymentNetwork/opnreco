
from colander import Integer
from colander import Length
from colander import OneOf
from colander import Schema
from colander import SchemaNode
from colander import Sequence
from colander import String as ColanderString
from decimal import Decimal
from opnreport.models.db import AccountEntry
from opnreport.models.db import Movement
from opnreport.models.db import OwnerLog
from opnreport.models.db import Reco
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.param import get_request_file
from opnreport.viewcommon import get_loop_map
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config
from sqlalchemy import and_
from sqlalchemy import cast
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy import String
import datetime
import dateutil.parser
import re

zero = Decimal()
null = None


def start_movement_query(dbsession, owner_id):
    return (
        dbsession.query(
            Movement.id,
            Movement.number,
            Movement.ts,
            Movement.loop_id,
            Movement.currency,
            Movement.vault_delta,
            Movement.wallet_delta,
            Movement.reco_id,
            TransferRecord.transfer_id)
        .join(
            TransferRecord,
            TransferRecord.id == Movement.transfer_record_id)
        .filter(
            Movement.owner_id == owner_id,
            # Note: movements of zero are not eligible for reconciliation.
            or_(Movement.vault_delta != zero, Movement.wallet_delta != zero),
        ))


def render_movement_rows(movement_rows):
    res = []
    for row in movement_rows:
        res.append({
            'id': row.id,
            'ts': row.ts,
            'loop_id': row.loop_id,
            'currency': row.currency,
            'vault_delta': row.vault_delta,
            'wallet_delta': row.wallet_delta,
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
    reco_type = 'standard'

    if reco_id is not None:
        movement_rows = (
            start_movement_query(dbsession=dbsession, owner_id=owner_id)
            .filter(
                Movement.reco_id == reco_id,
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
            reco_type = reco.reco_type

    elif movement_id is not None:
        account_entry_rows = ()
        movement_rows = (
            start_movement_query(dbsession=dbsession, owner_id=owner_id)
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
        'reco_type': reco_type,
        'comment': comment,
        'movements': movements_json,
        'account_entries': [],
        'loops': loops,
        'is_circ': file.peer_id == 'c',
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
    seen_ids = set(int(x) for x in params.get('seen_ids', ()))
    reco_id_input = params.get('reco_id')

    if reco_id_input:
        reco_id = int(reco_id_input)
    else:
        reco_id = None

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id
    filters = []

    match = re.search(r'[+-]?[0-9\.]+', amount_input)
    if match is not None:
        amount_str = match.group(0)
        amount_abs = abs(Decimal(amount_str))

        vault_sign_filters = ()
        wallet_sign_filters = ()
        if '-' in amount_str:
            vault_sign_filters = ((Movement.vault_delta < 0),)
            wallet_sign_filters = ((Movement.wallet_delta < 0),)
        elif '+' in amount_str:
            vault_sign_filters = ((Movement.vault_delta > 0),)
            wallet_sign_filters = ((Movement.wallet_delta > 0),)

        if '.' in amount_str:
            # Exact amount.
            filters.append(or_(
                and_(
                    func.abs(Movement.vault_delta) == amount_abs,
                    *vault_sign_filters),
                and_(
                    func.abs(Movement.wallet_delta) == amount_abs,
                    *wallet_sign_filters),
            ))
        else:
            # The search omitted the subunit value.
            filters.append(or_(
                and_(
                    func.abs(Movement.vault_delta) >= amount_abs,
                    func.abs(Movement.vault_delta) < amount_abs + 1,
                    *vault_sign_filters),
                and_(
                    func.abs(Movement.wallet_delta) >= amount_abs,
                    func.abs(Movement.wallet_delta) < amount_abs + 1,
                    *wallet_sign_filters),
            ))

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

    if seen_ids:
        filters.append(~Movement.id.in_(seen_ids))

    movement_rows = (
        start_movement_query(dbsession=dbsession, owner_id=owner_id)
        .filter(
            Movement.peer_id == file.peer_id,
            or_(
                Movement.reco_id == null,
                Movement.reco_id == reco_id,
            ),
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
    reco_type = SchemaNode(
        ColanderString(),
        validator=OneOf(('standard', 'wallet_only', 'account_only')))
    comment = SchemaNode(
        ColanderString(),
        missing='',
        validator=Length(max=10000))
    movements = SchemaNode(
        Sequence(),
        MovementSchema(),
        missing=(),
        validator=Length(max=100))


class RecoSaveSchema(Schema):
    reco_id = SchemaNode(Integer(), missing=None)
    reco = RecoSchema()


movement_matches_required = (
    ('currency', "currency", "currencies"),
    ('loop_id', "cash design", "cash designs"),
    ('transfer_record_id', "transfer", "transfers"),
    ('peer_id', "peer", "peers"),
)


@view_config(
    name='reco-save',
    context=API,
    permission='use_app',
    renderer='json')
def reco_save(context, request, complete=False):
    """Save changes to a reco."""
    file, _peer, _loop = get_request_file(request)
    params = RecoSaveSchema().deserialize(request.json)

    dbsession = request.dbsession
    owner = request.owner
    owner_id = owner.id

    reco_id = params['reco_id']
    reco_type = params['reco']['reco_type']
    new_internal = (reco_type == 'standard')

    if reco_type == 'account_only':
        new_movement_ids = ()
    else:
        new_movement_ids = set(m['id'] for m in params['reco']['movements'])

    if not new_movement_ids:
        new_movements = ()
    else:
        new_movements = (
            dbsession.query(Movement)
            .filter(
                Movement.owner_id == owner_id,
                Movement.id.in_(new_movement_ids),
                or_(
                    Movement.reco_id == null,
                    Movement.reco_id == reco_id,
                ),
                or_(
                    Movement.wallet_delta != zero,
                    Movement.vault_delta != zero,
                ),
            )
            .all())

        if len(new_movements) != len(new_movement_ids):
            raise HTTPBadRequest(json_body={
                'error': 'invalid_movement_id',
                'error_description': (
                    "One or more of the movements specified is not "
                    "eligible for reconciliation. A movement may have been "
                    "reconciled previously. Try re-syncing with OPN."),
            })

        for attr, singular, plural in movement_matches_required:
            value_set = set(getattr(m, attr) for m in new_movements)
            if len(value_set) > 1:
                raise HTTPBadRequest(json_body={
                    'error': 'multiple_%s' % attr,
                    'error_description': (
                        "Multiple %s detected. All movements in a "
                        "reconciliation must be for the same %s."
                        % (plural, singular)),
                })

        if reco_type == 'standard':
            wallet_sum = sum(m.wallet_delta for m in new_movements)
            vault_sum = sum(m.vault_delta for m in new_movements)
            if wallet_sum + vault_sum != 0:
                raise HTTPBadRequest(json_body={
                    'error': 'unbalanced_reconciliation',
                    'error_description': "Unbalanced reconciliation. "
                    "Standard reconciliation requires the sum "
                    "of changes to the account, vault, and wallet to "
                    "equal zero.",
                })
        elif reco_type == 'wallet_only':
            for m in new_movements:
                if m.vault_delta:
                    raise HTTPBadRequest(json_body={
                        'error': 'wallet_only_excludes_vault',
                        'error_description': "Wallet Income/Expense "
                        "reconciliation can include wallet changes only, "
                        "not vault changes.",
                    })

    if reco_id is not None:
        reco = (
            dbsession.query(Reco)
            .filter(
                Reco.owner_id == owner_id,
                Reco.id == reco_id)
            .first())
        if reco is None:
            raise HTTPBadRequest(json_body={
                'error': 'reco_not_found',
                'error_description': "Reconciliation record not found.",
            })
    else:
        reco = None

    if reco_type != 'standard' and not params['reco']['comment']:
        raise HTTPBadRequest(json_body={
            'error': 'comment_required',
            'error_description': (
                "An explanatory comment is required "
                "for nonstandard reconciliations."),
        })

    # Everything checks out. Save the changes.

    if reco_id is not None:
        # Remove old movements from the reco.
        old_movements = (
            dbsession.query(Movement)
            .filter(
                Movement.owner_id == owner_id,
                Movement.reco_id == reco_id,
                ~Movement.id.in_(new_movement_ids),
            )
            .all())
        for m in old_movements:
            m.reco_id = None
            m.reco_wallet_delta = m.wallet_delta
    else:
        if not new_movements:
            # This is a new reco with no movements, account entries, or
            # even a comment. Don't create an empty reco.
            return {'empty': True}

    if reco is None:
        added = True
        reco = Reco(
            owner_id=owner_id,
            reco_type=reco_type,
            internal=new_internal)
        dbsession.add(reco)
        dbsession.flush()  # Assign reco.id
        reco_id = reco.id
    else:
        reco.reco_type = reco_type
        reco.internal = new_internal
        added = False

    for m in new_movements:
        m.reco_id = reco_id
        if reco_type == 'wallet_only':
            # Wallet-only reconciliations should have no effect on
            # the surplus amount.
            m.reco_wallet_delta = zero
        else:
            # Other reconciliations expect the surplus to change
            # inversely to the wallet.
            m.reco_wallet_delta = m.wallet_delta

    reco.comment = params['reco']['comment']

    dbsession.add(OwnerLog(
        owner_id=owner.id,
        event_type='reco_add' if added else 'reco_change',
        remote_addr=request.remote_addr,
        user_agent=request.user_agent,
        content={
            'reco_id': reco_id,
            'reco': params['reco'],
        },
    ))
    dbsession.flush()

    return {'ok': True, 'reco_id': reco_id}
