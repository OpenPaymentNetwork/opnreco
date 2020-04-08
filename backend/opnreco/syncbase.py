
from decimal import Decimal
from opnreco.models.db import File
from opnreco.models.db import Movement
from opnreco.models.db import now_func
from opnreco.models.db import OwnerLog
from opnreco.models.db import Peer
from opnreco.models.db import TransferDownloadRecord
from opnreco.models.db import TransferRecord
from opnreco.mvinterp import MovementInterpreter
from opnreco.util import check_requests_response
from opnreco.util import to_datetime
from pyramid.decorator import reify
import collections
import logging
import os
import requests

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
    batch_limit = None

    def __init__(self, request):
        self.request = request
        self.owner = owner = request.owner
        self.owner_id = owner.id
        self.api_url = os.environ['opn_api_url']
        self.change_log = []

        # peers is a cache of {peer_id: Peer}.
        self.peers = {}

    def download_batch(self, sync_ts_iso, sync_transfer_id, count_remain):
        url = '%s/wallet/history_sync' % self.api_url
        postdata = {
            'sync_ts': sync_ts_iso,
            'transfer_id': sync_transfer_id,
        }
        if count_remain:
            postdata['count_remain'] = 'true'
        if self.batch_limit:
            postdata['limit'] = self.batch_limit

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
            .filter(
                TransferRecord.owner_id == owner_id,
                TransferRecord.transfer_id.in_(transfer_ids),
            )
            .all())

        record_map = {record.transfer_id: record for record in record_list}
        existing_movements_map = self.get_existing_movements_map(transfer_ids)

        # peer_ids is the set of all peer IDs referenced by the transfers.
        peer_ids = set()
        peer_ids.add(self.owner_id)
        for tsum in transfers_download['results']:
            sender_id = tsum['sender_id']
            if sender_id:
                peer_ids.add(sender_id)
            recipient_id = tsum['recipient_id']
            if recipient_id:
                peer_ids.add(recipient_id)
            for m in tsum['movements']:
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
            self.import_peer(self.owner_id, None)

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

            bundle_transfer_id = tsum.get('bundle_transfer_id')
            if bundle_transfer_id:
                bundle_transfer_id = str(bundle_transfer_id)

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
                'bundle_transfer_id': bundle_transfer_id,
            }

            record = record_map.get(transfer_id)
            if record is None:
                # Add a TransferRecord.
                is_new_record = True
                if write_enabled:
                    record = TransferRecord(
                        transfer_id=transfer_id,
                        owner_id=owner_id,
                        **kw)
                    changed.append(kw)
                    dbsession.add(record)
                    dbsession.flush()  # Assign record.id
                    record_map[transfer_id] = record
                change_log.append({
                    'event_type': 'transfer_add',
                    'transfer_id': transfer_id,
                })

            else:
                # Update a TransferRecord.
                is_new_record = False
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

            if record is not None:
                self.import_movements(
                    record, tsum,
                    is_new_record=is_new_record,
                    existing_movements=existing_movements_map[record.id])

        dbsession.flush()

    def get_existing_movements_map(self, transfer_ids):
        """List all movements recorded for the given transfer IDs.

        Return a defaultdict: {transfer_record_id: [Movement]}.
        """
        dbsession = self.request.dbsession
        owner_id = self.owner_id

        all_movements = (
            dbsession.query(Movement)
            .join(
                TransferRecord,
                TransferRecord.id == Movement.transfer_record_id)
            .filter(
                TransferRecord.owner_id == owner_id,
                TransferRecord.transfer_id.in_(transfer_ids))
            .all())

        res = collections.defaultdict(list)
        for m in all_movements:
            res[m.transfer_record_id].append(m)

        return res

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

        if peer_id == self.owner_id:
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

    def import_movements(
            self, record, item, is_new_record, existing_movements):
        transfer_id = item['id']
        dbsession = self.request.dbsession
        write_enabled = self.write_enabled
        change_log = self.change_log

        # Prepare movement_dict, a dict of movements already imported.
        # movement_dict: {
        #     (number, amount_index, loop_id, currency, issuer_id): Movement
        # }
        movement_dict = {}
        for movement in existing_movements:
            row_key = (
                movement.number,
                movement.amount_index,
                movement.loop_id,
                movement.currency,
                movement.issuer_id,
            )
            movement_dict[row_key] = movement
        movements_unseen = set(movement_dict.keys())

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

            by_loop = self.summarize_movement(
                movement=movement, transfer_id=transfer_id, ts=ts)

            # Add movement records based on the by_ploop dict.
            for loop_key, delta_list in sorted(by_loop.items()):
                loop_id, currency, issuer_id = loop_key

                for amount_index, amount in enumerate(delta_list):
                    row_key = (number, amount_index) + loop_key
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
                            loop_id=loop_id,
                            currency=currency,
                            issuer_id=issuer_id,
                            from_id=from_id,
                            to_id=to_id,
                            amount=amount,
                            action=action,
                            ts=ts,
                        )
                        dbsession.add(movement)
                        movement_dict[row_key] = movement
                        existing_movements.append(movement)

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
            for interpreter in self.interpreters:
                interpreter.sync_file_movements(
                    record=record,
                    movements=list(movement_dict.values()),
                    is_new_record=is_new_record)

    def summarize_movement(self, movement, transfer_id, ts):
        """Summarize a movement.

        Return {(loop_id, currency, issuer_id): [amount]}.
        """
        if not movement['to_id']:
            number = movement['number']
            raise AssertionError(
                "Movement %s in transfer %s has no to_id"
                % (number, transfer_id))

        # res: {(loop_id, currency, issuer_id): [amount]}
        res = collections.defaultdict(list)

        for loop in movement['loops']:
            loop_id = loop['loop_id']
            currency = loop['currency']
            issuer_id = loop['issuer_id']
            amount = Decimal(loop['amount'])
            res[(loop_id, currency, issuer_id)].append(amount)

        return res

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

    @reify
    def interpreters(self):
        """Prepare the owner's file-specific movement interpreters.

        Ignore all archived Files.
        """
        request = self.request
        dbsession = request.dbsession
        owner_id = self.owner_id

        files = (
            dbsession.query(File)
            .filter(File.owner_id == owner_id, ~File.archived)
            .order_by(File.id)
            .all())

        return [
            MovementInterpreter(
                request=self.request,
                file=file,
                change_log=self.change_log)
            for file in files]

    def sync_missing(self):
        """Fill in any missing transfer interpretations for the user's Files.
        """
        for interpreter in self.interpreters:
            interpreter.sync_missing()
