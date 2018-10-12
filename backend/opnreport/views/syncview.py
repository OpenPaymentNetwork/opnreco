
from decimal import Decimal
from opnreport.models.db import Exchange
from opnreport.models.db import File
from opnreport.models.db import Movement
from opnreport.models.db import MovementLog
from opnreport.models.db import MovementReco
from opnreport.models.db import now_func
from opnreport.models.db import OPNDownload
from opnreport.models.db import OwnerLog
from opnreport.models.db import Peer
from opnreport.models.db import Reco
from opnreport.models.db import TransferDownloadRecord
from opnreport.models.db import TransferRecord
from opnreport.models.site import API
from opnreport.util import check_requests_response
from opnreport.util import to_datetime
from pyramid.decorator import reify
from pyramid.view import view_config
import collections
import datetime
import logging
import os
import requests

log = logging.getLogger(__name__)
zero = Decimal()
null = None


class SyncError(Exception):
    """Data synchronization error"""


@view_config(
    name='sync',
    context=API,
    permission='use_app',
    renderer='json')
class SyncView:
    """Sync with OPN.

    This view downloads all transfers and movements since the last sync.
    """
    def __init__(self, request):
        self.request = request
        self.owner = owner = request.owner
        self.owner_id = owner.id
        self.api_url = os.environ['opn_api_url']

        # peers is a cache of {peer_id: Peer}.
        self.peers = {}

        # cash_designs is a cache of {loop_id: CashDesign}.
        self.cash_designs = {}

        # files: {(peer_id, loop_id, currency): file}
        self.files = {}

    def __call__(self):
        request = self.request
        owner = self.owner

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
            headers={'Authorization': 'Bearer %s' % request.access_token})
        check_requests_response(r)

        transfers_download = r.json()
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
            owner.last_transfer_id = (
                transfers_download['results'][-1]['id'])
            # Note: avoid division by zero.
            progress_percent = int(
                100.0 * owner.sync_done / owner.sync_total
                if owner.sync_total else 0.0)
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
            event_type='opn_sync',
            remote_addr=request.remote_addr,
            user_agent=request.user_agent,
            memo={
                'sync_ts': sync_ts_iso,
                'progress_percent': progress_percent,
                'transfers': {
                    'ids': sorted(
                        t['id'] for t in transfers_download['results']),
                    'count': len(transfers_download['results']),
                    'more': transfers_download['more'],
                    'first_sync_ts': transfers_download['first_sync_ts'],
                    'last_sync_ts': transfers_download['last_sync_ts'],
                }
            },
        ))

        self.import_transfer_records(transfers_download)

        return {
            'count': len(transfers_download['results']),
            'more': more,
            'progress_percent': progress_percent,
            'last_sync_ts': transfers_download['last_sync_ts'],
        }

    def import_transfer_records(self, transfers_download):
        """Add and update TransferRecord rows."""
        dbsession = self.request.dbsession
        owner_id = self.owner_id

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
        peer_ids = set()
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
            .filter(Peer.owner_id == owner_id)
            .filter(Peer.peer_id.in_(peer_ids))
            .all())

        for peer in peer_rows:
            self.peers[peer.peer_id] = peer

        for item in transfers_download['results']:
            self.import_peer(item['sender_id'], item['sender_info'])
            self.import_peer(item['recipient_id'], item['recipient_info'])

            changed = []
            kw = {
                'workflow_type': item['workflow_type'],
                'start': to_datetime(item['start']),
                'currency': item['currency'],
                'amount': Decimal(item['amount']),
                'timestamp': to_datetime(item['timestamp']),
                'next_activity': item['next_activity'],
                'completed': item['completed'],
                'canceled': item['canceled'],
                'sender_id': item['sender_id'] or None,
                'sender_uid': item['sender_uid'] or None,
                'sender_info': item['sender_info'],
                'recipient_id': item['recipient_id'] or None,
                'recipient_uid': item['recipient_uid'] or None,
                'recipient_info': item['recipient_info'],
            }

            transfer_id = item['id']
            record = record_map.get(transfer_id)
            if record is None:
                # Add a TransferRecord.
                new_record = True
                record = TransferRecord(
                    transfer_id=transfer_id,
                    owner_id=owner_id,
                    **kw)
                changed.append(kw)
                dbsession.add(record)
                dbsession.flush()  # Assign record.id
                record_map[transfer_id] = record

            else:
                # Update a TransferRecord.
                new_record = False
                immutable_attrs = ('workflow_type', 'start')
                for attr in immutable_attrs:
                    if kw[attr] != getattr(record, attr):
                        raise SyncError(
                            "Transfer %s: Immutable attribute changed. "
                            "Old %s was %s, new %s is %s" %
                            (transfer_id, attr, repr(getattr(record, attr)),
                                attr, repr(kw[attr])))

                changed_map = {}
                for attr, value in sorted(kw.items()):
                    if getattr(record, attr) != value:
                        setattr(record, attr, value)
                        changed_map[attr] = value
                if changed_map:
                    changed.append(changed_map)

            dbsession.add(TransferDownloadRecord(
                opn_download_id=self.opn_download_id,
                transfer_record_id=record.id,
                transfer_id=transfer_id,
                changed=changed))

            if item['movements']:
                self.import_movements(record, item, new_record=new_record)

    @reify
    def account_map(self):
        # Get the map of accounts from /wallet/info.
        account_list = self.request.wallet_info['profile']['accounts']
        return {a['id']: a for a in account_list}

    def import_peer(self, peer_id, info):
        """Import a peer from a transfer record or other source."""
        if peer_id == self.owner_id or peer_id == 'c':
            # Get better info from the owner profile.
            info = {
                'title': self.owner.title,
                'screen_name': self.owner.username,
                'is_dfi_account': False,
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
                }

        peer = self.peers.get(peer_id)
        if peer is None:
            peer = Peer(
                owner_id=self.owner_id,
                peer_id=peer_id,
                title=info.get('title'),
                username=info.get('screen_name'),
                is_dfi_account=info.get('is_dfi_account'),
                last_update=now_func,
            )
            dbsession = self.request.dbsession
            dbsession.add(peer)
            self.peers[peer_id] = peer

            dbsession.add(OwnerLog(
                owner_id=self.owner_id,
                event_type='add_peer',
                memo={
                    'peer_id': peer_id,
                    'info': info,
                }))

        else:
            found = 0
            changes = {}
            attrs = (
                ('title', 'title'),
                ('screen_name', 'username'),
                ('is_dfi_account', 'is_dfi_account'),
            )
            for source_attr, dest_attr in attrs:
                value = info.get(source_attr)
                if value:
                    found += 1
                    if getattr(peer, dest_attr) != value:
                        changes[dest_attr] = value
                        setattr(peer, dest_attr, value)
            if found:
                peer.last_update = now_func

                if changes:
                    self.request.dbsession.add(OwnerLog(
                        owner_id=self.owner_id,
                        event_type='update_peer',
                        memo={
                            'peer_id': peer_id,
                            'changes': changes,
                        }))

    def import_movements(self, record, item, new_record):
        transfer_id = item['id']
        dbsession = self.request.dbsession

        # Prepare movement_dict, a dict of movements already imported.
        rows = (
            dbsession.query(Movement)
            .filter_by(transfer_record_id=record.id)
            .all())
        # movement_rows: {
        #     (number, peer_id, orig_peer_id, loop_id, currency,
        #      issuer_id):
        #     Movement
        # }
        movement_dict = {}
        for movement in rows:
            key6 = (
                movement.number,
                movement.peer_id,
                movement.orig_peer_id,
                movement.loop_id,
                movement.currency,
                movement.issuer_id,
            )
            movement_dict[key6] = movement

        for movement in item['movements']:
            number = movement.get('number')
            if not number:
                raise ValueError(
                    "The OPN service needs to be migrated to support "
                    "movement numbers. (OPN: upgrade and run bin/resummarize)")
            ts = to_datetime(movement['timestamp'])
            action = movement['action']
            from_id = movement['from_id']
            to_id = movement['to_id']

            by_peer = self.summarize_movement(
                movement, transfer_id=transfer_id)

            # Add movement records based on the by_peer dict.
            for key5, deltas in sorted(by_peer.items()):
                amount, wallet_delta, vault_delta = deltas
                key6 = (number,) + key5
                old_movement = movement_dict.get(key6)

                if old_movement is not None:
                    # The movement is already recorded.
                    # Verify it has not changed.
                    if old_movement.ts != ts:
                        raise ValueError(
                            "Movement %s in transfer %s has changed:"
                            "recorded timestamp is %s, new timestamp is %s" % (
                                number, transfer_id,
                                old_movement.ts.isoformat(), ts.isoformat()))
                    if (old_movement.from_id != from_id or
                            old_movement.to_id != to_id):
                        raise ValueError(
                            "Movement %s in transfer %s has changed:"
                            "movement was from %s to %s, "
                            "new movement is from %s to %s" % (
                                number, transfer_id,
                                old_movement.from_id,
                                old_movement.to_id,
                                from_id,
                                to_id))
                    if old_movement.action != action:
                        raise ValueError(
                            "Movement %s in transfer %s has changed:"
                            "recorded action is %s, new action is %s" % (
                                number, transfer_id,
                                old_movement.action, action))
                    if (old_movement.wallet_delta != wallet_delta or
                            old_movement.vault_delta != vault_delta):
                        raise ValueError(
                            "Movement %s in transfer %s has changed:"
                            "recorded delta is (%s, %s, %s), "
                            "new delta is (%s, %s, %s)" % (
                                number, transfer_id,
                                old_movement.amount,
                                old_movement.wallet_delta,
                                old_movement.vault_delta,
                                amount,
                                wallet_delta,
                                vault_delta))
                    continue

                # Record the movement.
                peer_id, orig_peer_id, loop_id, currency, issuer_id = key5
                movement = Movement(
                    transfer_record_id=record.id,
                    number=number,
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
                )
                dbsession.add(movement)
                dbsession.flush()  # Assign row.id

                movement_dict[key6] = movement

                dbsession.add(MovementLog(
                    movement_id=movement.id,
                    event_type='download',
                    # Only the immutable attributes changed.
                    # There were no changes to mutable attributes.
                    changes={},
                ))

        self.autoreco(
            record=record,
            movements=movement_dict.values(),
            new_record=new_record)

    def summarize_movement(self, movement, transfer_id):
        """Summarize a movement.

        Return {
            (peer_id, orig_peer_id, loop_id, currency, issuer_id):
            [amount, wallet_delta, vault_delta],
        }, where peer_id can be 'c', but orig_peer_id can not.
        """
        number = movement['number']
        from_id = movement['from_id']
        to_id = movement['to_id']

        if not to_id:
            raise AssertionError(
                "Movement %s in transfer %s has no to_id"
                % (number, transfer_id))

        owner_id = self.owner_id
        # by_peer:
        # {(peer_id, loop_id, currency): [amount, wallet_delta, vault_delta]}
        by_peer = collections.defaultdict(
            lambda: [zero, zero, zero])

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

            elif issuer_id == owner_id:
                # The issuer is observing a movement, but the movement
                # does not involve the issuer's wallet or vault.
                # Use the issuer as the peer, but don't record any
                # wallet or vault movement.
                peer_id = issuer_id

            else:
                # Ignore movements from the owner to itself.
                continue

            # Add to the 'c' (circulation/common) movements.
            c_peer_key = ('c', peer_id, loop_id, currency, issuer_id)
            c_file = self.prepare_file('c', loop_id, currency)
            amounts = by_peer[c_peer_key]
            amounts[0] += amount
            if vault_delta:
                amounts[2] += vault_delta
                if not c_file.has_vault:
                    c_file.has_vault = True
            if wallet_delta:
                amounts[1] += wallet_delta

            # Add to the wallet-specific or account-specific movements.
            peer_key = (peer_id, peer_id, loop_id, currency, issuer_id)
            file = self.prepare_file(peer_id, loop_id, currency)
            amounts = by_peer[peer_key]
            amounts[0] += amount
            if vault_delta:
                amounts[2] += vault_delta
                if not file.has_vault:
                    file.has_vault = True
            if wallet_delta:
                amounts[1] += wallet_delta

        return by_peer

    def prepare_file(self, peer_id, loop_id, currency):
        """Return the current file for (peer_id, loop_id, currency).
        """
        key = (peer_id, loop_id, currency)
        file = self.files.get(key)
        if file is not None:
            return file

        dbsession = self.request.dbsession
        owner_id = self.owner_id
        file = (
            dbsession.query(File)
            .filter(
                File.owner_id == owner_id,
                File.peer_id == peer_id,
                File.loop_id == loop_id,
                File.currency == currency,
                File.current)
            .first())

        if file is not None:
            self.files[key] = file

        else:
            file = File(
                owner_id=owner_id,
                peer_id=peer_id,
                loop_id=loop_id,
                currency=currency,
                current=True)
            dbsession.add(file)  # Assign file.id

            self.files[key] = file

            dbsession.add(OwnerLog(
                owner_id=self.owner_id,
                event_type='add_file',
                memo={
                    'file_id': file.id,
                    'peer_id': peer_id,
                    'loop_id': loop_id,
                    'currency': currency,
                }))

        return file

    # def get_target_info(self, target_id):
    #     """Return {title, is_dfi_account, username (optional)}."""
    #     if target_id == 'c':
    #         return {
    #             'title': self.profile.title,
    #             'username': self.profile.username,
    #             'is_dfi_account': False,
    #         }

    #     account = self.account_map.get(target_id)
    #     if account:
    #         title = '%s at %s' % (
    #             account['redacted_account_num'],
    #             account['rdfi_name'],
    #         )
    #         if account['alias']:
    #             title += ' (%s)' % account['alias']

    #         return {
    #             'title': title,
    #             'username': '',
    #             'is_dfi_account': True,
    #         }

    #     profile_titles = self.profile_titles
    #     profile_usernames = self.profile_usernames

    #     title = profile_titles.get(target_id)
    #     if title:
    #         res = {'title': title, 'is_dfi_account': False}
    #         if target_id in profile_usernames:
    #             res['username'] = profile_usernames[target_id]
    #         return res

    #     url = '%s/p/%s' % (self.api_url, target_id)
    #     headers = {'Authorization': 'Bearer %s' % self.request.access_token}
    #     r = requests.get(url, headers=headers)
    #     if check_requests_response(r, raise_exc=False):
    #         r_json = r.json()
    #         title = r_json['title']
    #         if title:
    #             username = r_json['username'] or ''
    #             profile_titles[target_id] = title
    #             profile_usernames[target_id] = username
    #             return {
    #                 'title': title,
    #                 'username': username,
    #                 'is_dfi_account': False,
    #             }

    #     log.warning("Unable to get the title of holder %s", target_id)

    #     profile_titles[target_id] = ''  # Don't try again.
    #     return {
    #         'title': '',
    #         'is_dfi_account': False,
    #     }

    # def get_loop_title(self, loop_id):
    #     """Return the title of a note design."""
    #     loop_titles = self.loop_titles

    #     title = loop_titles.get(loop_id)
    #     if title:
    #         return title, False

    #     url = '%s/design/%s' % (self.api_url, loop_id)
    #     headers = {'Authorization': 'Bearer %s' % self.request.access_token}
    #     r = requests.get(url, headers=headers)
    #     if check_requests_response(r, raise_exc=False):
    #         title = r.json()['title']
    #         loop_titles[loop_id] = title
    #         return title

    #     # The error details were logged by
    #     # check_requests_response().
    #     log.warning("Unable to get the title of cash loop %s", loop_id)

    #     return ''

    # def update_mirrors(self):
    #     """Update the target_* and loop_title of the profile's mirrors."""
    #     update_check_time = (
    #         datetime.datetime.utcnow() - datetime.timedelta(seconds=60 * 10))
    #     dbsession = self.request.dbsession
    #     seen = []

    #     while True:
    #         mirrors = (
    #             dbsession.query(Mirror)
    #             .filter_by(profile_id=self.profile_id)
    #             .filter(~Mirror.id.in_(seen))
    #             .filter(or_(
    #                 Mirror.last_update == null,
    #                 Mirror.last_update < update_check_time,
    #             ))
    #             .order_by(Mirror.id)
    #             .limit(100)
    #             .all())

    #         if not mirrors:
    #             break

    #         for mirror in mirrors:
    #             # Get the title and other info about the target.
    #             target_info = self.get_target_info(mirror.target_id)
    #             target_title = target_info['title']
    #             target_is_dfi_account = target_info['is_dfi_account']

    #             changes = {}
    #             if target_title:
    #                 if target_title != mirror.target_title:
    #                     mirror.target_title = target_title
    #                     changes['target_title'] = target_title

    #                 if target_is_dfi_account != mirror.target_is_dfi_account:
    #                     mirror.target_is_dfi_account = target_is_dfi_account
    #                     changes['target_is_dfi_account'] = (
    #                         target_is_dfi_account)

    #                 if 'username' in target_info:
    #                     username = target_info['username']
    #                     if mirror.target_username != username:
    #                         mirror.target_username = username
    #                         changes['target_username'] = username

    #             if mirror.loop_id != '0':
    #                 loop_title = self.get_loop_title(mirror.loop_id)
    #                 if loop_title and loop_title != mirror.loop_title:
    #                     mirror.loop_title = loop_title
    #                     changes['loop_title'] = loop_title

    #             if changes:
    #                 dbsession.add(ProfileLog(
    #                     profile_id=self.profile_id,
    #                     event_type='update_mirror',
    #                     memo={
    #                         'mirror_id': mirror.id,
    #                         'target_id': mirror.target_id,
    #                         'changes': changes,
    #                     }))

    #             mirror.last_update = now_func

    #         dbsession.flush()
    #         seen.extend(m.id for m in mirrors)

    def autoreco(self, record, movements, new_record):
        """Auto-reconcile some of the movements in a TransferRecord.
        """
        dbsession = self.request.dbsession

        if new_record:
            # No recos exist yet for this TransferRecord.
            reco_rows = ()
            done_movement_ids = set()
        else:
            # List the existing recos for this TransferRecord.
            reco_rows = (
                dbsession.query(Movement.id, Reco.id)
                .join(
                    TransferRecord,
                    TransferRecord.id == Movement.transfer_record_id)
                .join(
                    MovementReco,
                    MovementReco.movement_id == Movement.id)
                .join(
                    Reco,
                    Reco.id == MovementReco.reco_id)
                .filter(TransferRecord.id == record.id)
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
                    conflict = True
                    break
                wallet_total += movement.wallet_delta
                vault_total += movement.vault_delta

            if conflict:
                continue

            if wallet_total != -vault_total:
                raise AssertionError(
                    "find_internal_movements() returned an unbalanced "
                    "movement list for transfer %s: %s != %s" % (
                        record.transfer_id, wallet_total, -vault_total))

            sample_movement = mvlist[-1]  # Use the date of the last movement
            peer_id = sample_movement.peer_id
            loop_id = sample_movement.loop_id
            currency = sample_movement.currency

            file = self.prepare_file(peer_id, loop_id, currency)
            reco = Reco(
                file_id=file.id,
                entry_date=sample_movement.ts.date(),
                auto=True,
            )
            dbsession.add(reco)
            dbsession.flush()
            reco_id = reco.id
            added = True

            for movement in mvlist:
                dbsession.add(MovementReco(
                    movement_id=movement.id,
                    reco_id=reco_id))
                dbsession.add(MovementLog(
                    movement_id=movement.id,
                    event_type='autoreco',
                    changes={'reco_id': reco_id},
                ))

            if wallet_total:
                # Add an Exchange record to balance the wallet and vault
                # totals.
                dbsession.add(Exchange(
                    transfer_record_id=record.id,
                    peer_id=peer_id,
                    loop_id=loop_id,
                    currency=currency,
                    origin_reco_id=reco_id,
                    wallet_delta=-wallet_total,
                    vault_delta=-vault_total,
                ))

        if added:
            dbsession.flush()


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
        group.sort(key=lambda movement: movement.number)

        internal_seqs = find_internal_movements_for_group(
            group=group,
            done_movement_ids=done_movement_ids)
        if internal_seqs:
            all_internal_seqs.extend(internal_seqs)

    return all_internal_seqs


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
