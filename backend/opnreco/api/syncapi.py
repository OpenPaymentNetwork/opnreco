
from decimal import Decimal
from opnreco.models import perms
from opnreco.models.db import Movement
from opnreco.models.db import now_func
from opnreco.models.db import OPNDownload
from opnreco.models.db import OwnerLog
from opnreco.models.db import Peer
from opnreco.models.db import Period
from opnreco.models.db import Reco
from opnreco.models.db import TransferDownloadRecord
from opnreco.models.db import TransferRecord
from opnreco.models.db import VerificationResult
from opnreco.models.site import API
from opnreco.util import check_requests_response
from opnreco.util import to_datetime
from opnreco.viewcommon import configure_dblog
from opnreco.viewcommon import get_period_for_day
from opnreco.viewcommon import add_open_period
from pyramid.decorator import reify
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.httpexceptions import HTTPInsufficientStorage
from pyramid.view import view_config
import collections
import datetime
import logging
import os
import pytz
import requests
import uuid

log = logging.getLogger(__name__)
zero = Decimal()
null = None


class VerificationFailure(Exception):
    """A transfer failed verification"""

    def __init__(self, msg, transfer_id):
        Exception.__init__(self, msg)
        self.transfer_id = transfer_id


class SyncBase:
    """Base class for views that sync with OPN.

    This is a base class for either downloading all transfers and movements
    since the last sync or for verifying that existing transfers and
    movements have not changed.
    """
    write_enabled = True
    change_log = None  # A list for use in verification

    def __init__(self, request):
        self.request = request
        self.owner = owner = request.owner
        self.owner_id = owner.id
        self.api_url = os.environ['opn_api_url']
        self.change_count = 0

        # peers is a cache of {peer_id: Peer}.
        self.peers = {}

        # cash_designs is a cache of {loop_id: CashDesign}.
        self.cash_designs = {}

        # periods: {(peer_id, loop_id, currency, date): Period}
        self.periods = {}

        # period_lists: {(peer_id, loop_id, currency): [Period]}
        self.period_lists = {}

    @reify
    def timezone(self):
        """Get the pytz time zone for the owner.

        Default to the America/New_York time zone.
        """
        try:
            return pytz.timezone(self.owner.tzname or 'America/New_York')
        except Exception:
            return pytz.timezone('America/New_York')

    def download_batch(self, sync_ts_iso, sync_transfer_id, count_remain):
        url = '%s/wallet/history_sync' % self.api_url
        postdata = {
            'sync_ts': sync_ts_iso,
            'transfer_id': sync_transfer_id,
        }
        if count_remain:
            postdata['count_remain'] = 'true'

        r = requests.post(
            url,
            data=postdata,
            headers={'Authorization': 'Bearer %s' % self.request.access_token})
        check_requests_response(r)

        return r.json()

    def import_transfer_records(self, transfers_download):
        """Add and update TransferRecord rows."""
        dbsession = self.request.dbsession
        owner_id = self.owner_id
        write_enabled = self.write_enabled
        change_log = self.change_log

        transfer_ids = [item['id'] for item in transfers_download['results']]

        if not transfer_ids:
            return

        record_list = (
            dbsession.query(TransferRecord)
            .filter(TransferRecord.owner_id == owner_id)
            .filter(TransferRecord.transfer_id.in_(transfer_ids))
            .all())

        record_map = {record.transfer_id: record for record in record_list}

        # peer_ids is the set of all peer IDs referenced by the transfers.
        peer_ids = set(['c'])  # Include the 'c' peer
        for item in transfers_download['results']:
            sender_id = item['sender_id']
            if sender_id:
                peer_ids.add(sender_id)
            recipient_id = item['recipient_id']
            if recipient_id:
                peer_ids.add(recipient_id)
            for m in item['movements']:
                from_id = m['from_id']
                if from_id:
                    peer_ids.add(from_id)
                peer_ids.add(m['to_id'])
                for loop in m['loops']:
                    peer_ids.add(loop['issuer_id'])

        peer_rows = (
            dbsession.query(Peer)
            .filter(
                Peer.owner_id == owner_id,
                Peer.peer_id.in_(peer_ids),
            ).all())

        for peer in peer_rows:
            self.peers[peer.peer_id] = peer

        if write_enabled:
            self.import_peer('c', None)  # Create or update the 'c' peer

        for tsum in transfers_download['results']:
            if write_enabled:
                self.import_peer(tsum['sender_id'], tsum['sender_info'])

            if tsum.get('recipient_is_dfi_account'):
                recipient_info = {}
                recipient_info.update(tsum['recipient_info'])
                recipient_info['is_dfi_account'] = True
            else:
                recipient_info = tsum['recipient_info']
            if write_enabled:
                self.import_peer(tsum['recipient_id'], recipient_info)

            transfer_id = tsum['id']

            bundled_transfers = tsum.get('bundled_transfers')
            if (bundled_transfers is not None and
                    not isinstance(bundled_transfers, list)):
                # Don't let something weird get into the database.
                raise ValueError(
                    "Transfer %s: bundled_transfers should be None or a list, "
                    "not %s" % (transfer_id, repr(bundled_transfers)))

            changed = []
            kw = {
                'workflow_type': tsum['workflow_type'],
                'start': to_datetime(tsum['start']),
                'currency': tsum['currency'],
                'amount': Decimal(tsum['amount']),
                'timestamp': to_datetime(tsum['timestamp']),
                'next_activity': tsum['next_activity'],
                'completed': tsum['completed'],
                'canceled': tsum['canceled'],
                'sender_id': tsum['sender_id'] or None,
                'sender_uid': tsum['sender_uid'] or None,
                'sender_info': tsum['sender_info'],
                'recipient_id': tsum['recipient_id'] or None,
                'recipient_uid': tsum['recipient_uid'] or None,
                'recipient_info': tsum['recipient_info'],
                'bundled_transfers': bundled_transfers,
                'bundle_transfer_id': tsum.get('bundle_transfer_id'),
            }

            record = record_map.get(transfer_id)
            if record is None:
                # Add a TransferRecord.
                new_record = True
                if write_enabled:
                    record = TransferRecord(
                        transfer_id=transfer_id,
                        owner_id=owner_id,
                        **kw)
                    changed.append(kw)
                    dbsession.add(record)
                    dbsession.flush()  # Assign record.id
                    record_map[transfer_id] = record
                self.change_count += 1
                if change_log is not None:
                    change_log.append({
                        'event_type': 'transfer_add',
                        'transfer_id': transfer_id,
                    })

            else:
                # Update a TransferRecord.
                new_record = False
                immutable_attrs = ('workflow_type', 'start')
                for attr in immutable_attrs:
                    if kw[attr] != getattr(record, attr):
                        msg = (
                            "Verification failure in transfer %s. "
                            "Immutable attribute changed. "
                            "Old %s was %s, new %s is %s" %
                            (transfer_id, attr, repr(getattr(record, attr)),
                                attr, repr(kw[attr])))
                        log.error(msg)
                        raise VerificationFailure(msg, transfer_id=transfer_id)

                changed_map = {}
                for attr, value in sorted(kw.items()):
                    if getattr(record, attr) != value:
                        if write_enabled:
                            setattr(record, attr, value)
                        changed_map[attr] = value
                if changed_map:
                    changed.append(changed_map)
                    self.change_count += 1
                    if change_log is not None:
                        change_log.append({
                            'event_type': 'transfer_changes',
                            'transfer_id': transfer_id,
                            'changes': sorted(changed_map.keys()),
                        })

            if write_enabled:
                dbsession.add(TransferDownloadRecord(
                    opn_download_id=self.opn_download_id,
                    transfer_record_id=record.id,
                    transfer_id=transfer_id,
                    changed=changed))

            self.import_movements(record, tsum, new_record=new_record)

        dbsession.flush()

    @reify
    def account_map(self):
        # Get the map of accounts from /wallet/info.
        account_list = self.request.wallet_info['profile']['accounts']
        return {a['id']: a for a in account_list}

    def import_peer(self, peer_id, info):
        """Import a peer from a transfer record or other source."""
        if not peer_id:
            # A transfer's sender or recipient is not yet known.
            # There's nothing to import.
            return

        if not self.write_enabled:
            # This method doesn't need to do anything when writing is
            # disabled.
            return

        if peer_id == self.owner_id or peer_id == 'c':
            # Get better info from the owner profile.
            info = {
                'title': self.owner.title,
                'screen_name': self.owner.username,
                'is_dfi_account': False,
                'is_own_dfi_account': False,
            }

        else:
            # Is the peer an account held by the user? If so, get
            # better info from the account map.
            account = self.account_map.get(peer_id)
            if account:
                title = '%s at %s' % (
                    account['redacted_account_num'],
                    account['rdfi_name'],
                )
                if account['alias']:
                    title += ' (%s)' % account['alias']

                info = {
                    'title': title,
                    'screen_name': '',
                    'is_dfi_account': True,
                    'is_own_dfi_account': True,
                }

        dbsession = self.request.dbsession

        peer = self.peers.get(peer_id)
        if peer is None:
            peer = Peer(
                owner_id=self.owner_id,
                peer_id=peer_id,
                title=info.get('title'),
                username=info.get('screen_name'),
                is_dfi_account=info.get('is_dfi_account'),
                is_own_dfi_account=info.get('is_own_dfi_account'),
                last_update=now_func,
            )
            dbsession.add(peer)
            self.change_count += 1
            if self.change_log is not None:
                self.change_log.append({
                    'event_type': 'peer_add',
                    'peer_id': peer_id,
                })
            self.peers[peer_id] = peer

            dbsession.add(OwnerLog(
                owner_id=self.owner_id,
                personal_id=self.request.personal_id,
                event_type='peer_add',
                content={
                    'peer_id': peer_id,
                    'info': info,
                }))

        else:
            attrs_found = 0
            changes = {}

            # Changeable attrs
            attrs = (
                ('title', 'title'),
                ('screen_name', 'username'),
            )
            for source_attr, dest_attr in attrs:
                value = info.get(source_attr)
                if value:
                    attrs_found += 1
                    if getattr(peer, dest_attr) != value:
                        changes[dest_attr] = value
                        setattr(peer, dest_attr, value)

            # One-shot boolean attrs (once set, stay set)
            attrs = (
                ('is_dfi_account', 'is_dfi_account'),
                ('is_own_dfi_account', 'is_own_dfi_account'),
            )
            for source_attr, dest_attr in attrs:
                value = info.get(source_attr)
                if value is not None:
                    attrs_found += 1
                    if value and not getattr(peer, dest_attr):
                        changes[dest_attr] = True
                        setattr(peer, dest_attr, True)

            if attrs_found:
                peer.last_update = now_func
                if changes:
                    self.change_count += 1
                    if self.change_log is not None:
                        self.change_log.append({
                            'event_type': 'peer_update',
                            'peer_id': peer_id,
                        })
                    dbsession.add(OwnerLog(
                        owner_id=self.owner_id,
                        personal_id=self.request.personal_id,
                        event_type='peer_update',
                        content={
                            'peer_id': peer_id,
                            'changes': changes,
                        }))

    def import_movements(self, record, item, new_record):
        transfer_id = item['id']
        dbsession = self.request.dbsession
        write_enabled = self.write_enabled
        change_log = self.change_log

        # Prepare movement_dict, a dict of movements already imported.
        rows = (
            dbsession.query(Movement)
            .filter_by(transfer_record_id=record.id)
            .all())
        # movement_rows: {
        #     (number, amount_index, peer_id, orig_peer_id,
        #      loop_id, currency, issuer_id):
        #     Movement
        # }
        movement_dict = {}
        for movement in rows:
            row_key = (
                movement.number,
                movement.amount_index,
                movement.peer_id,
                movement.orig_peer_id,
                movement.loop_id,
                movement.currency,
                movement.issuer_id,
            )
            movement_dict[row_key] = movement
        movements_unseen = set(movement_dict.keys())

        configure_dblog(request=self.request, movement_event_type='download')

        item_movements = item['movements'] or ()

        for movement in item_movements:
            number = movement.get('number')
            if not number:
                raise ValueError(
                    "The OPN service needs to be migrated to support "
                    "movement numbers. (OPN: upgrade and run bin/resummarize)")
            ts = to_datetime(movement['timestamp'])
            action = movement['action']
            from_id = movement['from_id']
            to_id = movement['to_id']

            by_ploop = self.summarize_movement(
                movement=movement, transfer_id=transfer_id, ts=ts)

            # Add movement records based on the by_ploop dict.
            for plkey, delta_list in sorted(by_ploop.items()):
                peer_id, orig_peer_id, loop_id, currency, issuer_id = plkey

                for amount_index, effect in enumerate(delta_list):
                    amount, wallet_delta, vault_delta, period_id = effect
                    row_key = (number, amount_index) + plkey
                    old_movement = movement_dict.get(row_key)

                    if old_movement is not None:
                        # The movement is already recorded.
                        movements_unseen.discard(row_key)
                        # Verify it has not changed, then continue.
                        self.verify_old_movement(
                            transfer_id=transfer_id,
                            number=number,
                            old_movement=old_movement,
                            ts=ts,
                            from_id=from_id,
                            to_id=to_id,
                            action=action,
                            amount=amount,
                            loop_id=loop_id,
                            currency=currency,
                            issuer_id=issuer_id,
                        )
                        continue

                    if write_enabled:
                        # Record the new movement.
                        movement = Movement(
                            transfer_record_id=record.id,
                            owner_id=self.owner_id,
                            number=number,
                            amount_index=amount_index,
                            peer_id=peer_id,
                            orig_peer_id=orig_peer_id,
                            loop_id=loop_id,
                            currency=currency,
                            issuer_id=issuer_id,
                            from_id=from_id,
                            to_id=to_id,
                            amount=amount,
                            action=action,
                            ts=ts,
                            wallet_delta=wallet_delta,
                            vault_delta=vault_delta,
                            period_id=period_id,
                            surplus_delta=-wallet_delta,
                        )
                        dbsession.add(movement)
                        movement_dict[row_key] = movement

                    self.change_count += 1
                    if change_log is not None:
                        change_log.append({
                            'event_type': 'movement_add',
                            'transfer_id': transfer_id,
                            'movement_number': number,
                        })

        if movements_unseen:
            old_movement_numbers = sorted(
                row_key[0] for row_key in movement_dict.keys())
            new_movement_numbers = sorted(
                movement['number'] for movement in item_movements)
            msg = (
                "Verification failure in transfer %s. "
                "Previously downloaded movement(s) are no longer available. "
                "Old movement numbers: %s, new movement numbers: %s" %
                (transfer_id, old_movement_numbers, new_movement_numbers))
            log.error(msg)
            raise VerificationFailure(msg, transfer_id=transfer_id)

        if write_enabled:
            dbsession.flush()  # Assign the movement IDs and log the movements
            configure_dblog(
                request=self.request, movement_event_type='autoreco')
            self.autoreco(
                record=record,
                movements=movement_dict.values(),
                new_record=new_record)

    def summarize_movement(self, movement, transfer_id, ts):
        """Summarize a movement.

        Return {
            (peer_id, orig_peer_id, loop_id, currency, issuer_id):
            [(amount, wallet_delta, vault_delta, period_id)],
        }, where peer_id can be 'c', but orig_peer_id can not.
        """
        write_enabled = self.write_enabled
        number = movement['number']
        from_id = movement['from_id']
        to_id = movement['to_id']

        if not to_id:
            raise AssertionError(
                "Movement %s in transfer %s has no to_id"
                % (number, transfer_id))

        day = ts.replace(tzinfo=pytz.utc).astimezone(self.timezone).date()
        owner_id = self.owner_id
        # by_ploop: {
        #     (peer_id, orig_peer_id, loop_id, currency, issuer_id): [
        #         (amount, wallet_delta, vault_delta, period_id)]}
        by_ploop = collections.defaultdict(list)

        for loop in movement['loops']:
            loop_id = loop['loop_id']
            currency = loop['currency']
            issuer_id = loop['issuer_id']
            amount = Decimal(loop['amount'])
            wallet_delta = zero
            vault_delta = zero

            if not from_id:
                # Issuance movement.
                peer_id = to_id

            elif from_id == owner_id and to_id != owner_id:
                peer_id = to_id
                if from_id == issuer_id:
                    # Notes were put into circulation.
                    vault_delta = -amount
                else:
                    # Notes were sent to an account or other wallet.
                    wallet_delta = -amount

            elif to_id == owner_id and from_id != owner_id:
                peer_id = from_id
                if to_id == issuer_id:
                    # Notes were taken out of circulation.
                    vault_delta = amount
                else:
                    # Notes were received from an account or other wallet.
                    wallet_delta = amount

            else:
                # The owner is observing a movement, but the movement
                # does not involve the owner's wallet or vault.
                # Use the issuer as the peer, but don't record any
                # wallet or vault movement.
                peer_id = issuer_id

            # Add to the 'c' (circulation) movements.
            c_key = ('c', peer_id, loop_id, currency, issuer_id)
            if write_enabled:
                c_period = self.get_open_period(
                    'c', loop_id, currency, day=day)
                if vault_delta and not c_period.has_vault:
                    c_period.has_vault = True
                c_period_id = c_period.id
            else:
                c_period_id = None
            by_ploop[c_key].append(
                (amount, wallet_delta, vault_delta, c_period_id))

            # Add to the wallet-specific or account-specific movements.
            plkey = (peer_id, peer_id, loop_id, currency, issuer_id)
            if write_enabled:
                peer_period = self.get_open_period(
                    peer_id, loop_id, currency, day=day)
                peer_period_id = peer_period.id
            else:
                peer_period_id = None
            by_ploop[plkey].append(
                (amount, wallet_delta, vault_delta, peer_period_id))

        return by_ploop

    def verify_old_movement(
            self, old_movement, transfer_id, number,
            ts, from_id, to_id, action,
            amount, issuer_id, loop_id, currency):
        if old_movement.ts != ts:
            msg = (
                "Verification failure in transfer %s. "
                "Movement %s has changed: "
                "recorded timestamp is %s, "
                "new timestamp is %s" % (
                    transfer_id, number,
                    old_movement.ts.isoformat(),
                    ts.isoformat()))
            raise VerificationFailure(msg, transfer_id=transfer_id)

        if (old_movement.from_id != from_id or
                old_movement.to_id != to_id):
            msg = (
                "Verification failure in transfer %s. "
                "Movement %s has changed: "
                "movement was from %s to %s, "
                "new movement is from %s to %s" % (
                    transfer_id, number,
                    old_movement.from_id,
                    old_movement.to_id,
                    from_id,
                    to_id))
            raise VerificationFailure(msg, transfer_id=transfer_id)

        for attr, new_value in (
                ('currency', currency),
                ('loop_id', loop_id),
                ('amount', amount),
                ('issuer_id', issuer_id),
                ('action', action),
                ):
            old_value = getattr(old_movement, attr)
            if new_value != old_value:
                msg = (
                    "Verification failure in transfer %s. "
                    "Movement %s has changed: "
                    "recorded %s is %s, new %s is %s" % (
                        transfer_id, number,
                        attr, old_value,
                        attr, new_value))
                raise VerificationFailure(msg, transfer_id=transfer_id)

    def get_open_period(self, peer_id, loop_id, currency, day):
        """Get an open Period for (peer_id, loop_id, currency, movement_date).
        """
        period_key = (peer_id, loop_id, currency, day)
        period = self.periods.get(period_key)
        if period is not None:
            return period

        list_key = (peer_id, loop_id, currency)
        dbsession = self.request.dbsession
        owner_id = self.owner_id
        period_list = self.period_lists.get(list_key)

        if not period_list:
            # Get the list of matching open Periods that already exist.
            period_list = (
                dbsession.query(Period)
                .filter(
                    Period.owner_id == owner_id,
                    Period.peer_id == peer_id,
                    Period.loop_id == loop_id,
                    Period.currency == currency,
                    ~Period.closed)
                .all())
            self.period_lists[list_key] = period_list

        # See if any of the existing periods match.
        period = get_period_for_day(period_list, day)
        if period is not None:
            # Found a matching open period.
            self.periods[period_key] = period
            return period

        # Create a new open period.
        period = add_open_period(
            request=self.request,
            peer_id=peer_id,
            loop_id=loop_id,
            currency=currency,
            event_type='add_period_for_sync')

        self.period_lists[list_key] = list(period_list) + [period]
        self.periods[period_key] = period
        self.change_count += 1
        if self.change_log is not None:
            self.change_log.append({
                'event_type': 'add_period',
                'period_id': period.id,
            })

        return period

    def autoreco(self, record, movements, new_record):
        """Auto-reconcile some of the movements in a TransferRecord.
        """
        dbsession = self.request.dbsession

        if new_record:
            # No recos exist yet for this TransferRecord.
            reco_rows = ()
            done_movement_ids = set()
        else:
            # List the existing reconciled movements in this TransferRecord.
            reco_rows = (
                dbsession.query(Movement.id)
                .filter(
                    Movement.transfer_record_id == record.id,
                    Movement.reco_id != null)
                .all())
            done_movement_ids = set(row[0] for row in reco_rows)

        internal_seqs = find_internal_movements(
            movements=movements,
            done_movement_ids=done_movement_ids)

        added = False

        for mvlist in internal_seqs:
            if len(mvlist) < 2:
                continue

            conflict = False
            wallet_total = zero
            vault_total = zero
            for movement in mvlist:
                if movement.id in done_movement_ids:
                    # This auto-reco would conflict with an existent reco.
                    # Don't create this auto-reco.
                    conflict = True
                    break
                wallet_total += movement.wallet_delta
                vault_total += movement.vault_delta

            if conflict:
                continue

            if wallet_total + vault_total != zero:
                raise AssertionError(
                    "find_internal_movements() returned an unbalanced "
                    "movement list for transfer %s: %s != %s" % (
                        record.transfer_id, wallet_total, -vault_total))

            reco = Reco(
                owner_id=self.owner_id,
                period_id=mvlist[0].period_id,
                reco_type='standard',
                internal=True)
            dbsession.add(reco)
            dbsession.flush()
            reco_id = reco.id
            added = True

            for movement in mvlist:
                movement.reco_id = reco_id

        if added:
            self.change_count += 1
            if self.change_log is not None:
                self.change_log.append({
                    'event_type': 'reco_add',
                    'reco_id': reco_id,
                })
            dbsession.flush()


@view_config(
    name='sync',
    context=API,
    permission=perms.use_app,
    renderer='json')
class SyncAPI(SyncBase):
    write_enabled = True

    def set_tzname(self):
        """If the owner doesn't have a tzname yet, try to set it."""
        request = self.request
        owner = self.owner

        if not owner.tzname:
            try:
                params = self.request.json
            except Exception:
                params = {}
            tzname = params.get('tzname', '').strip()
            if tzname and tzname in pytz.all_timezones:
                owner.tzname = tzname
                request.dbsession.add(OwnerLog(
                    owner_id=owner.id,
                    personal_id=request.personal_id,
                    event_type='tzname_init',
                    remote_addr=request.remote_addr,
                    user_agent=request.user_agent,
                    content={
                        'tzname': tzname,
                    },
                ))

    def __call__(self):
        request = self.request
        owner = self.owner

        self.set_tzname()

        if owner.first_sync_ts is None:
            # Start a new sync. Download transfers created or changed
            # after 5 minutes before the last sync. (Add 5 minutes in
            # case some transfers showed up out of order.)
            if owner.last_sync_ts is not None:
                sync_ts = (
                    owner.last_sync_ts - datetime.timedelta(seconds=60 * 5))
            else:
                sync_ts = datetime.datetime(1970, 1, 1)
            sync_transfer_id = None
            count_remain = True
        else:
            # A sync was started but not finished. Download the next batch.
            sync_ts = owner.last_sync_ts
            sync_transfer_id = owner.last_sync_transfer_id
            count_remain = False
        sync_ts_iso = sync_ts.isoformat() + 'Z'

        transfers_download = self.download_batch(
            sync_ts_iso=sync_ts_iso,
            sync_transfer_id=sync_transfer_id,
            count_remain=count_remain)

        dbsession = request.dbsession
        more = transfers_download['more']
        now = datetime.datetime.utcnow()

        if more:
            len_results = len(transfers_download['results'])
            if owner.first_sync_ts is None:
                owner.first_sync_ts = to_datetime(
                    transfers_download['first_sync_ts'])
                owner.sync_total = len_results + transfers_download['remain']
                owner.sync_done = len_results
            else:
                owner.sync_done += len_results
            owner.last_sync_ts = to_datetime(
                transfers_download['last_sync_ts'])
            owner.last_sync_transfer_id = (
                transfers_download['results'][-1]['id'])
            # Note: avoid division by zero.
            progress_percent = min(99, int(
                100.0 * owner.sync_done / owner.sync_total
                if owner.sync_total else 0.0))
        else:
            owner.first_sync_ts = None
            owner.last_sync_transfer_id = None
            owner.last_sync_ts = now
            owner.sync_total = 0
            owner.sync_done = 0
            progress_percent = 100

        opn_download = OPNDownload(
            owner_id=owner.id,
            content={
                'transfers': transfers_download,
                'more': more,
            },
        )
        dbsession.add(opn_download)
        dbsession.flush()

        self.opn_download_id = opn_download.id

        dbsession.add(OwnerLog(
            owner_id=owner.id,
            personal_id=request.personal_id,
            event_type='opn_sync',
            remote_addr=request.remote_addr,
            user_agent=request.user_agent,
            content={
                'sync_ts': sync_ts_iso,
                'progress_percent': progress_percent,
                'change_count': self.change_count,
                'transfers': {
                    'ids': sorted(
                        t['id'] for t in transfers_download['results']),
                    'count': len(transfers_download['results']),
                    'more': more,
                    'first_sync_ts': transfers_download['first_sync_ts'],
                    'last_sync_ts': transfers_download['last_sync_ts'],
                }
            },
        ))

        try:
            self.import_transfer_records(transfers_download)
        except VerificationFailure as e:
            # HTTP Error 507 is reasonably close to 'data verification error'.
            raise HTTPInsufficientStorage(json_body={
                'error': 'verification_failure',
                'error_description': str(e),
            })

        return {
            'progress_percent': progress_percent,
            'change_count': self.change_count,
            'download_count': len(transfers_download['results']),
            'more': more,
            'first_sync_ts': transfers_download['first_sync_ts'],
            'last_sync_ts': transfers_download['last_sync_ts'],
        }


@view_config(
    name='verify',
    context=API,
    permission=perms.use_app,
    renderer='json')
class VerifyAPI(SyncBase):
    """Verify existing OPN transfer records have not changed."""
    write_enabled = False

    def __call__(self):
        request = self.request
        dbsession = request.dbsession
        owner = request.owner

        self.now = datetime.datetime.utcnow()
        self.expires = self.now + datetime.timedelta(days=1)
        self.change_log = []

        # Expire old verification records.
        (dbsession.query(VerificationResult)
            .filter(VerificationResult.owner_id == owner.id)
            .filter(VerificationResult.expires <= self.now)
            .delete())

        ivr, created = self.get_ivr()
        sync_ts_iso = ivr.last_sync_ts.isoformat() + 'Z'
        transfers_download = self.download_batch(
            sync_ts_iso=sync_ts_iso,
            sync_transfer_id=ivr.last_sync_transfer_id,
            count_remain=created)

        try:
            self.import_transfer_records(transfers_download)
        except VerificationFailure as e:
            # HTTP error 507 is reasonably close to
            # 'data verification error on the server'. HTTP error 507
            # is also obscure enough that it probably won't be
            # triggered by any other error.
            raise HTTPInsufficientStorage(json_body={
                'error': 'verification_failure',
                'error_description': str(e),
            })

        self.log_download(
            ivr=ivr, created=created, transfers_download=transfers_download)

        if transfers_download['more']:
            # Note: avoid division by zero.
            progress_percent = min(99, int(
                100.0 * ivr.sync_done / ivr.sync_total
                if ivr.sync_total else 0.0))
        else:
            try:
                self.verify_final(ivr)
            except VerificationFailure as e:
                raise HTTPInsufficientStorage(json_body={
                    'error': 'verification_failure',
                    'error_description': str(e),
                })
            progress_percent = 100

        return {
            'verification_id': ivr.verification_id,
            'sync_done': ivr.sync_done,
            'sync_total': ivr.sync_total,
            'progress_percent': progress_percent,
            'change_count': self.change_count,
            'download_count': len(transfers_download['results']),
            'more': transfers_download['more'],
            'first_sync_ts': transfers_download['first_sync_ts'],
            'last_sync_ts': transfers_download['last_sync_ts'],
        }

    def get_ivr(self):
        """Get the initial VerificationResult record.

        Return (ivr, created).
        """
        request = self.request
        dbsession = request.dbsession
        owner = request.owner

        verification_id = request.params.get('verification_id')
        if not verification_id:
            # Start a new verification operation.
            verification_id = '%s.%s' % (
                datetime.datetime.utcnow().isoformat(),
                uuid.uuid4())

            ivr = VerificationResult(
                owner_id=owner.id,
                verification_id=verification_id,
                initial=True,
                last_sync_ts=datetime.datetime(1970, 1, 1),
                last_sync_transfer_id=None,
                sync_done=0,
                verified={},
                expires=self.expires,
            )
            dbsession.add(ivr)
            created = True

        else:
            # Continue a verification operation.
            ivr = (
                dbsession.query(VerificationResult)
                .filter(
                    VerificationResult.owner_id == owner.id,
                    VerificationResult.verification_id == verification_id,
                    VerificationResult.initial,
                )
                .first())
            if ivr is None:
                raise HTTPBadRequest(json_body={
                    'error': 'verification_id_not_found',
                })
            created = False

        return ivr, created

    def log_download(self, ivr, created, transfers_download):
        """Log the results of the transfer download."""
        request = self.request
        dbsession = request.dbsession
        owner = request.owner

        len_results = len(transfers_download['results'])
        verified = {
            item['id']: None
            for item in transfers_download['results']}

        for entry in self.change_log:
            transfer_id = entry.get('transfer_id')
            if transfer_id and transfer_id in verified:
                transfer_changes = verified[transfer_id]
                if transfer_changes is None:
                    verified[transfer_id] = transfer_changes = []
                entry_copy = {}
                entry_copy.update(entry)
                del entry_copy['transfer_id']
                transfer_changes.append(entry_copy)

        if created:
            ivr.first_sync_ts = to_datetime(
                transfers_download['first_sync_ts'])
            ivr.sync_total = len_results + transfers_download['remain']
            ivr.sync_done = len_results
            ivr.verified = verified
        else:
            ivr.sync_done += len_results
            dbsession.add(VerificationResult(
                owner_id=owner.id,
                verification_id=ivr.verification_id,
                initial=False,
                verified=verified,
                expires=self.expires,
            ))

        ivr.last_sync_ts = to_datetime(
            transfers_download['last_sync_ts'])
        ivr.last_sync_transfer_id = (
            transfers_download['results'][-1]['id'])

    def verify_final(self, ivr):
        """Verify the entire download.
        """
        request = self.request
        dbsession = request.dbsession
        owner = request.owner

        # Look for transfers
        # downloaded previously that were not included in the
        # download.
        rows = (
            dbsession.query(TransferRecord.transfer_id)
            .filter(TransferRecord.owner_id == owner.id)
            .all())
        stored_transfer_ids = set(row[0] for row in rows)

        rows = (
            dbsession.query(VerificationResult.verified)
            .filter(
                VerificationResult.owner_id == owner.id,
                VerificationResult.verification_id == ivr.verification_id,
            )
            .all())
        verified_transfer_ids = set.union(*(set(row[0]) for row in rows))

        missing_transfer_ids = (
            stored_transfer_ids.difference(verified_transfer_ids))

        if not missing_transfer_ids:
            return

        missing_list = sorted(missing_transfer_ids)
        transfer_id = missing_list[0]
        # Note that it's possible for clients to trigger
        # this error inappropriately by downloading
        # only part of the history while claiming all of
        # the history was downloaded. Is that a serious issue?
        msg = (
            "Verification failure in transfer %s. "
            "The transfer appears to be missing from OPN. "
            "Total missing transfers: %d, verification ID: %s" % (
                transfer_id,
                len(missing_list),
                ivr.verification_id,
            ))
        log.error(msg)
        raise VerificationFailure(msg, transfer_id=transfer_id)


def find_internal_movements(movements, done_movement_ids):
    """Find internal movements that can be auto-reconciled.

    Return [[movement]].

    Automatic reconciliation looks for sequences of internal movements
    that balance out exactly and generates automatic reconciliation
    records for them.

    Detect internal movements by looking for either "hills" or
    "valleys". A "hill" is a sequence of increases followed by
    matching decreases. A "valley" is a sequence of decreases
    followed by matching increases.

    Do not auto-reconcile if:

    - The movements in the sequence have been reconciled already.
    - The movements don't appear to be internal (based on the action name).
    - The internal movements don't look like a balanced hill or valley.
    - The internal movements do not balance.

    We could theoretically auto-reconcile more complex movements (such
    as a balanced hill with dips), but that would probably generate
    some false positives.
    """

    # Group by peer, loop_id, and currency,
    # filtering out movements that somehow moved nothing.
    # (Note that we specifically ignore Movement.orig_peer_id
    # because it is not relevant here.)
    groups = collections.defaultdict(list)
    for movement in movements:
        if movement.wallet_delta + movement.vault_delta != zero:
            key = (movement.peer_id, movement.loop_id, movement.currency)
            groups[key].append(movement)

    # all_internal_seqs is a list of movement sequences that
    # constitute internal movements.
    # all_internal_seqs: [[movement]]
    all_internal_seqs = []

    for key, group in groups.items():
        if len(group) < 2:
            # No hill or valley is possible.
            continue

        # Order the movements in the group.
        group.sort(
            key=lambda movement: (movement.number, movement.amount_index))
        refine_movement_order(group)

        internal_seqs = find_internal_movements_for_group(
            group=group,
            done_movement_ids=done_movement_ids)
        if internal_seqs:
            all_internal_seqs.extend(internal_seqs)

    return all_internal_seqs


def refine_movement_order(group):
    """Refine the order of migrated movements in a group.

    This works around an issue in migrated movements. Movements
    created by migration (which had a blank action) sometimes had
    an identical timestamp and were added in the wrong order.
    Reorder the movements temporarily for the purpose of
    auto-reconciliation, but don't change the movements.

    The reordering tries to restore the hills or valleys that existed
    in the original sequence.
    """
    by_ts = collections.defaultdict(list)

    for index, movement in enumerate(group):
        if movement.action:
            # This is the end of the migrated movements for this transfer.
            break
        by_ts[movement.ts].append((index, movement))

    if not by_ts:
        # Nothing to reorder.
        return

    for subgroup in by_ts.values():
        if len(subgroup) < 2:
            # Nothing to reorder.
            continue

        # This subgroup is eligible for reordering because all the movements
        # happened at the same time (in the same transaction). Look at the
        # next movement (in the group) after or before to determine whether
        # to form the concurrent movements into a hill or a valley.
        first_index = subgroup[0][0]
        last_index = subgroup[-1][0]
        make_valley = None

        if last_index + 1 < len(group):
            # Detect based on the next movement after the subgroup.
            movement = group[last_index + 1]
            delta = movement.wallet_delta + movement.vault_delta
            if delta < zero:
                make_valley = False
            elif delta > zero:
                make_valley = True

        if make_valley is None and first_index > 0:
            # Detect based on the previous movement before the subgroup.
            movement = group[first_index - 1]
            delta = movement.wallet_delta + movement.vault_delta
            if delta < zero:
                make_valley = True
            elif delta > zero:
                make_valley = False

        if make_valley is not None:
            # Reorder.
            # make_valley specifies whether to form a valley or a hill.

            def sort_key(item):
                index, movement = item
                delta = movement.wallet_delta + movement.vault_delta
                if make_valley:
                    forced_order = 0 if delta < zero else 1
                else:
                    forced_order = 0 if delta > zero else 1
                return (forced_order, index)

            new_order = list(subgroup)
            new_order.sort(key=sort_key)

            # Put the movements in the refined order.
            for old_item, new_item in zip(subgroup, new_order):
                index = old_item[0]
                movement = new_item[1]
                group[index] = movement


non_internal_actions = frozenset(('move',))


def find_internal_movements_for_group(group, done_movement_ids):
    # Note: group must be ordered by number and all movements
    # in the group must be for the same loop_id and currency.
    # internal_seqs: [[movement]]
    internal_seqs = []

    # hill_starts and valley_starts contain the candidate starts of
    # a hill or valley. They map an original amount to the
    # index in the groups list when the change happened.
    hill_starts = {}    # {original amount: group index}
    valley_starts = {}  # {original amount: group index}

    # hill_ends and valley_ends list the candidate ends of a balanced
    # hill or valley.
    hill_ends = []      # [(group index, new amount)]
    valley_ends = []    # [(group index, new amount)]

    # trend contains the current direction of movement: +1, -1, or 0
    # (where 0 means the trend has not yet been determined).
    trend = 0

    # prev_amount is the amount at the previous index.
    prev_amount = zero

    # min_start contains the first eligible start index of the next
    # hill or valley. It ensures hills and valleys can't overlap.
    min_start = [0]

    # find_hill() looks backward in hill_ends for a hill_start
    # value that matches. It finds the largest hill, if any,
    # and adds it to internal_seqs. find_valley() operates similarly.

    def find_hill():
        for end_index, amount in reversed(hill_ends):
            start_index = hill_starts.get(amount)
            if start_index is not None and start_index >= min_start[0]:
                # Found a hill!
                end_index_1 = end_index + 1
                mv_list = group[start_index:end_index_1]
                internal_seqs.append(mv_list)
                min_start[0] = end_index_1
                return

    def find_valley():
        for end_index, amount in reversed(valley_ends):
            start_index = valley_starts.get(amount)
            if start_index is not None and start_index >= min_start[0]:
                # Found a valley!
                end_index_1 = end_index + 1
                mv_list = group[start_index:end_index_1]
                internal_seqs.append(mv_list)
                min_start[0] = end_index_1
                return

    for index, movement in enumerate(group):
        delta = movement.wallet_delta + movement.vault_delta
        new_amount = prev_amount + delta

        if (movement.id in done_movement_ids or
                movement.action in non_internal_actions):
            # This movement is already reconciled or internal,
            # so don't detect any hill or valley that crosses it,
            # but detect hills or valleys before or after.
            if trend == 1:
                # The trend was positive (or 0),
                # so there might be a valley.
                find_valley()
            elif trend == -1:
                # The trend was negative (or 0),
                # so there might be a hill.
                find_hill()
            hill_starts.clear()
            del hill_ends[:]
            valley_starts.clear()
            del valley_ends[:]
            trend = 0

        if delta > zero:
            if trend != 1:
                # The trend was negative (or 0),
                # so there might be a hill.
                find_hill()
                # Start looking for another hill.
                hill_starts.clear()
                del hill_ends[:]
                # The trend is now positive.
                trend = 1
            # This movement could be the end of a valley.
            if valley_starts:
                valley_ends.append((index, new_amount))
            # This movement could be the start of a hill.
            hill_starts[prev_amount] = index

        elif delta < zero:
            if trend != -1:
                # The trend was positive (or 0),
                # so there might be a valley.
                find_valley()
                # Start looking for another valley.
                valley_starts.clear()
                del valley_ends[:]
                # The trend is now negative.
                trend = -1
            # This movement could be the end of a hill.
            if hill_starts:
                hill_ends.append((index, new_amount))
            # This movement could be the start of a valley.
            valley_starts[prev_amount] = index

        prev_amount = new_amount

    # Find any remaining hill or valley.
    if trend > 0:
        find_valley()
    elif trend < 0:
        find_hill()

    return internal_seqs
