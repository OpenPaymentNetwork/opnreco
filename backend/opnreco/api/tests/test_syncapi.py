import datetime
import os
import unittest
from decimal import Decimal

import pyramid.testing
import responses
from opnreco.testing import DBSessionFixture

zero = Decimal()


def setup_module():
    global dbsession_fixture
    dbsession_fixture = DBSessionFixture()


def teardown_module():
    dbsession_fixture.close()


class TestSyncAPI(unittest.TestCase):
    def setUp(self):
        os.environ["opn_api_url"] = "https://opn.example.com:9999"
        self.config = pyramid.testing.setUp()
        self.dbsession, self.close_session = dbsession_fixture.begin_session()

    def tearDown(self):
        self.close_session()
        pyramid.testing.tearDown()

    @property
    def _class(self):
        from ..syncapi import SyncAPI

        return SyncAPI

    def _make(self, owner_id="11", file_type="open_circ", auto_enable_loops=False):
        from opnreco.models.db import File, Owner

        owner = Owner(
            id=owner_id,
            title="Test Profile",
            username="testy",
        )
        self.dbsession.add(owner)
        self.dbsession.flush()

        file = File(
            id=1239,
            owner_id=owner_id,
            file_type=file_type,
            title="Test File",
            currency="USD",
            has_vault=True,
            auto_enable_loops=auto_enable_loops,
        )
        self.dbsession.add(file)
        self.dbsession.flush()

        request = pyramid.testing.DummyRequest(
            dbsession=self.dbsession,
            owner=owner,
            personal_id="12",
            access_token="example-token",
            remote_addr="127.0.0.1",
            user_agent="Test UA",
            wallet_info={
                "profile": {
                    "accounts": [
                        {
                            "id": "1102",
                            "redacted_account_num": "XXX45",
                            "rdfi_name": "Test Bank",
                            "alias": "myacct",
                        }
                    ]
                }
            },
        )
        obj = self._class(request)
        obj.change_log = []
        return obj

    @responses.activate
    def test_with_no_transfers(self):
        from opnreco.models import db

        responses.add(
            responses.POST,
            "https://opn.example.com:9999/wallet/history_sync",
            json={
                "results": [],
                "more": False,
                "first_sync_ts": None,
                "last_sync_ts": None,
            },
        )
        obj = self._make()
        obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual("11", downloads[0].owner_id)

        events = self.dbsession.query(db.OwnerLog).order_by(db.OwnerLog.id).all()
        self.assertEqual(1, len(events))
        self.assertEqual("11", events[0].owner_id)
        self.assertEqual("opn_sync", events[0].event_type)

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(0, len(records))

    @responses.activate
    def test_redeem_from_sender_perspective(self):
        from opnreco.models import db

        responses.add(
            responses.POST,
            "https://opn.example.com:9999/wallet/history_sync",
            json={
                "results": [
                    {
                        "id": "500",
                        "workflow_type": "redeem",
                        "start": "2018-08-01T04:05:06Z",
                        "currency": "USD",
                        "amount": "1.25",
                        "timestamp": "2018-08-01T04:05:08Z",
                        "next_activity": "completed",
                        "completed": True,
                        "canceled": False,
                        "sender_id": "11",
                        "sender_uid": "wingcash:11",
                        "sender_info": {
                            "title": "Tester",
                            "screen_name": "testy",
                        },
                        "recipient_id": "1102",
                        "recipient_uid": "wingcash:1102",
                        "recipient_info": {
                            "title": "Acct",
                            "is_dfi_account": True,
                        },
                        "movements": [
                            {
                                "number": 2,
                                "timestamp": "2018-01-02T05:06:07Z",
                                "action": "deposit",
                                "from_id": "11",
                                "to_id": "1102",
                                "loops": [
                                    {
                                        "currency": "USD",
                                        "loop_id": "0",
                                        "amount": "1.00",
                                        "issuer_id": "19",
                                    },
                                    {
                                        "currency": "USD",
                                        "loop_id": "0",
                                        "amount": "0.25",
                                        "issuer_id": "20",
                                    },
                                ],
                            }
                        ],
                    }
                ],
                "more": False,
                "first_sync_ts": "2018-08-01T04:05:10Z",
                "last_sync_ts": "2018-08-01T04:05:11Z",
            },
        )

        responses.add(
            responses.GET,
            "https://opn.example.com:9999/p/19",
            json={"title": "Super Bank 19", "username": "bank19"},
        )

        responses.add(
            responses.GET,
            "https://opn.example.com:9999/p/20",
            json={"title": "Super Bank 20", "username": "bank20"},
        )

        responses.add(
            responses.GET,
            "https://opn.example.com:9999/p/1102",
            json={"title": "Tester's Super Bank Checking Account"},
        )

        obj = self._make()
        obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual("11", downloads[0].owner_id)

        events = self.dbsession.query(db.OwnerLog).all()
        self.assertEqual(
            [
                "opn_sync",
                "peer_add",
                "peer_add",
                "add_period_for_sync",
            ],
            [e.event_type for e in events],
        )
        event = events[0]
        self.assertEqual("11", event.owner_id)
        self.assertEqual(
            {"sync_ts", "progress_percent", "transfers", "change_count"},
            set(event.content.keys()),
        )

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual("redeem", record.workflow_type)
        self.assertEqual(datetime.datetime(2018, 8, 1, 4, 5, 6), record.start)
        self.assertEqual(datetime.datetime(2018, 8, 1, 4, 5, 8), record.timestamp)
        self.assertEqual(True, record.completed)
        self.assertEqual(False, record.canceled)
        self.assertEqual("11", record.sender_id)
        self.assertEqual("wingcash:11", record.sender_uid)
        self.assertEqual("1102", record.recipient_id)
        self.assertEqual("wingcash:1102", record.recipient_uid)

        peers = self.dbsession.query(db.Peer).order_by(db.Peer.peer_id).all()
        self.assertEqual(2, len(peers))

        self.assertEqual("11", peers[0].owner_id)
        self.assertEqual("11", peers[0].peer_id)
        self.assertEqual("Test Profile", peers[0].title)
        self.assertEqual("testy", peers[0].username)
        self.assertEqual(False, peers[0].is_dfi_account)

        self.assertEqual("11", peers[1].owner_id)
        self.assertEqual("1102", peers[1].peer_id)
        self.assertEqual("XXX45 at Test Bank (myacct)", peers[1].title)
        self.assertEqual("", peers[1].username)
        self.assertEqual(True, peers[1].is_dfi_account)

        periods = self.dbsession.query(db.Period).all()
        self.assertEqual(1, len(periods))
        period = periods[0]
        self.assertEqual("11", period.owner_id)
        self.assertEqual(1239, period.file_id)

        movements = (
            self.dbsession.query(db.FileMovement, db.Movement)
            .join(db.Movement, db.FileMovement.movement_id == db.Movement.id)
            .order_by(db.Movement.id)
            .all()
        )
        self.assertEqual(2, len(movements))
        fm, m = movements[0]
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual(2, m.number)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("19", m.issuer_id)
        self.assertEqual(datetime.datetime(2018, 1, 2, 5, 6, 7), m.ts)
        self.assertEqual("1102", fm.peer_id)
        self.assertEqual(Decimal("-1.00"), fm.wallet_delta)

        fm, m = movements[1]
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual(2, m.number)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("20", m.issuer_id)
        self.assertEqual(datetime.datetime(2018, 1, 2, 5, 6, 7), m.ts)
        self.assertEqual("1102", fm.peer_id)
        self.assertEqual(Decimal("-0.25"), fm.wallet_delta)

        events = self.dbsession.query(db.FileMovementLog).all()
        self.assertEqual(2, len(events))
        event = events[0]
        self.assertEqual("sync_file_movements", event.event_type)

        recos = self.dbsession.query(db.Reco).all()
        self.assertEqual(0, len(recos))

    @responses.activate
    def test_redeem_from_issuer_perspective(self):
        from opnreco.models import db

        responses.add(
            responses.POST,
            "https://opn.example.com:9999/wallet/history_sync",
            json={
                "results": [
                    {
                        "id": "500",
                        "workflow_type": "redeem",
                        "start": "2018-08-01T04:05:06Z",
                        "currency": "USD",
                        "amount": "1.00",
                        "timestamp": "2018-08-01T04:05:08Z",
                        "next_activity": "completed",
                        "completed": True,
                        "canceled": False,
                        "sender_id": "11",
                        "sender_uid": "wingcash:11",
                        "sender_info": {
                            "title": "Tester",
                        },
                        "recipient_id": "1102",
                        "recipient_uid": "wingcash:1102",
                        "recipient_info": {
                            "title": "Acct",
                        },
                        "movements": [
                            {
                                "number": 1,
                                "timestamp": "2018-08-02T05:06:07Z",
                                "action": "deposit",
                                "from_id": "1102",
                                "to_id": "19",
                                "loops": [
                                    {
                                        "currency": "USD",
                                        "loop_id": "0",
                                        "amount": "1.00",
                                        "issuer_id": "19",
                                    }
                                ],
                            }
                        ],
                    }
                ],
                "more": False,
                "first_sync_ts": "2018-08-01T04:05:10Z",
                "last_sync_ts": "2018-08-01T04:05:11Z",
            },
        )

        responses.add(
            responses.GET,
            "https://opn.example.com:9999/p/19",
            json={"title": "Super Bank 19", "username": "bank19"},
        )

        obj = self._make(owner_id="19")
        obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual("19", downloads[0].owner_id)

        events = self.dbsession.query(db.OwnerLog).order_by(db.OwnerLog.id).all()
        self.assertEqual(5, len(events))
        event = events[0]
        self.assertEqual("19", event.owner_id)
        self.assertEqual("opn_sync", event.event_type)
        self.assertEqual(
            {"sync_ts", "progress_percent", "transfers", "change_count"},
            set(event.content.keys()),
        )

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual("redeem", record.workflow_type)
        self.assertEqual(datetime.datetime(2018, 8, 1, 4, 5, 6), record.start)
        self.assertEqual(datetime.datetime(2018, 8, 1, 4, 5, 8), record.timestamp)
        self.assertEqual(True, record.completed)
        self.assertEqual(False, record.canceled)
        self.assertEqual("11", record.sender_id)
        self.assertEqual("wingcash:11", record.sender_uid)
        self.assertEqual("1102", record.recipient_id)
        self.assertEqual("wingcash:1102", record.recipient_uid)

        periods = self.dbsession.query(db.Period).all()
        self.assertEqual(1, len(periods))
        period = periods[0]
        self.assertEqual("19", period.owner_id)
        self.assertEqual(1239, period.file_id)

        movements = (
            self.dbsession.query(db.FileMovement, db.Movement)
            .join(db.Movement, db.FileMovement.movement_id == db.Movement.id)
            .order_by(db.Movement.id)
            .all()
        )
        self.assertEqual(1, len(movements))

        fm, m = movements[0]
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("1102", fm.peer_id)
        self.assertEqual(Decimal("1.00"), fm.vault_delta)

        events = self.dbsession.query(db.FileMovementLog).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual("sync_file_movements", event.event_type)

        recos = self.dbsession.query(db.Reco).all()
        self.assertEqual(0, len(recos))

    @responses.activate
    def test_grant_from_recipient_perspective(self):
        from opnreco.models import db

        responses.add(
            responses.POST,
            "https://opn.example.com:9999/wallet/history_sync",
            json={
                "results": [
                    {
                        "id": "501",
                        "workflow_type": "grant",
                        "start": "2018-08-01T04:05:06Z",
                        "currency": "USD",
                        "amount": "1.25",
                        "timestamp": "2018-08-01T04:05:08Z",
                        "next_activity": "completed",
                        "completed": True,
                        "canceled": False,
                        "sender_id": "19",
                        "sender_uid": "wingcash:19",
                        "sender_info": {
                            "title": "Issuer",
                        },
                        "recipient_id": "11",
                        "recipient_uid": "wingcash:11",
                        "recipient_info": {
                            "title": "Some Tester",
                        },
                        "movements": [
                            {
                                # Issued $1.00
                                "number": 2,
                                "timestamp": "2018-08-02T05:06:07Z",
                                "action": "grant",
                                "from_id": "19",
                                "to_id": "11",
                                "loops": [
                                    {
                                        "currency": "USD",
                                        "loop_id": "0",
                                        "amount": "1.00",
                                        "issuer_id": "19",
                                    }
                                ],
                            },
                            {
                                # Issued $0.25
                                "number": 3,
                                "timestamp": "2018-08-02T05:06:09Z",
                                "action": "grant",
                                "from_id": "19",
                                "to_id": "11",
                                "loops": [
                                    {
                                        "currency": "USD",
                                        "loop_id": "0",
                                        "amount": "0.25",
                                        "issuer_id": "19",
                                    }
                                ],
                            },
                        ],
                    }
                ],
                "more": False,
                "first_sync_ts": "2018-08-01T04:05:10Z",
                "last_sync_ts": "2018-08-01T04:05:11Z",
            },
        )

        responses.add(
            responses.GET,
            "https://opn.example.com:9999/p/19",
            json={"title": "Super Bank 19", "username": "bank19"},
        )

        responses.add(
            responses.GET,
            "https://opn.example.com:9999/p/1102",
            json={"title": "Tester's Super Bank Checking Account"},
        )

        obj = self._make(owner_id="11")
        obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual("11", downloads[0].owner_id)

        events = self.dbsession.query(db.OwnerLog).all()
        self.assertEqual(
            [
                "opn_sync",
                "peer_add",
                "peer_add",
                "add_period_for_sync",
            ],
            [e.event_type for e in events],
        )
        event = events[0]
        self.assertEqual("11", event.owner_id)
        self.assertEqual("opn_sync", event.event_type)
        self.assertEqual(
            {"sync_ts", "progress_percent", "transfers", "change_count"},
            set(event.content.keys()),
        )

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual("grant", record.workflow_type)
        self.assertEqual(datetime.datetime(2018, 8, 1, 4, 5, 6), record.start)
        self.assertEqual(datetime.datetime(2018, 8, 1, 4, 5, 8), record.timestamp)
        self.assertEqual(True, record.completed)
        self.assertEqual(False, record.canceled)
        self.assertEqual("19", record.sender_id)
        self.assertEqual("wingcash:19", record.sender_uid)
        self.assertEqual("11", record.recipient_id)
        self.assertEqual("wingcash:11", record.recipient_uid)

        peers = self.dbsession.query(db.Peer).order_by(db.Peer.peer_id).all()
        self.assertEqual(2, len(peers))

        self.assertEqual("11", peers[0].owner_id)
        self.assertEqual("11", peers[0].peer_id)
        self.assertEqual("Test Profile", peers[0].title)
        self.assertEqual("testy", peers[0].username)
        self.assertEqual(False, peers[0].is_dfi_account)

        self.assertEqual("11", peers[1].owner_id)
        self.assertEqual("19", peers[1].peer_id)
        self.assertEqual("Issuer", peers[1].title)
        self.assertEqual(None, peers[1].username)
        self.assertEqual(False, peers[1].is_dfi_account)

        periods = self.dbsession.query(db.Period).all()
        self.assertEqual(1, len(periods))
        period = periods[0]
        self.assertEqual("11", period.owner_id)
        self.assertEqual(1239, period.file_id)

        movements = (
            self.dbsession.query(db.FileMovement, db.Movement)
            .join(db.Movement, db.FileMovement.movement_id == db.Movement.id)
            .order_by(db.Movement.id)
            .all()
        )
        self.assertEqual(2, len(movements))
        fm, m = movements[0]
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("19", fm.peer_id)
        self.assertEqual(Decimal("1.00"), fm.wallet_delta)

        fm, m = movements[1]
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("19", fm.peer_id)
        self.assertEqual(Decimal("0.25"), fm.wallet_delta)

        events = self.dbsession.query(db.FileMovementLog).all()
        self.assertEqual(2, len(events))
        event = events[0]
        self.assertEqual("sync_file_movements", event.event_type)

    @responses.activate
    def test_grant_from_issuer_perspective(self):
        from opnreco.models import db

        responses.add(
            responses.POST,
            "https://opn.example.com:9999/wallet/history_sync",
            json={
                "results": [
                    {
                        "id": "501",
                        "workflow_type": "grant",
                        "start": "2018-08-01T04:05:06Z",
                        "currency": "USD",
                        "amount": "1.25",
                        "timestamp": "2018-08-01T04:05:08Z",
                        "next_activity": "completed",
                        "completed": True,
                        "canceled": False,
                        "sender_id": "19",
                        "sender_uid": "wingcash:19",
                        "sender_info": {
                            "title": "Issuer",
                        },
                        "recipient_id": "11",
                        "recipient_uid": "wingcash:11",
                        "recipient_info": {
                            "title": "Some Tester",
                        },
                        "movements": [
                            {
                                # Issuance movement
                                "number": 1,
                                "timestamp": "2018-08-02T05:06:06Z",
                                "action": "issue",
                                "from_id": None,
                                "to_id": "19",
                                "loops": [
                                    {
                                        "currency": "USD",
                                        "loop_id": "0",
                                        "amount": "1.25",
                                        "issuer_id": "19",
                                    }
                                ],
                            },
                            {
                                # Issued $1.00
                                "number": 2,
                                "timestamp": "2018-08-02T05:06:07Z",
                                "action": "grant",
                                "from_id": "19",
                                "to_id": "11",
                                "loops": [
                                    {
                                        "currency": "USD",
                                        "loop_id": "0",
                                        "amount": "1.00",
                                        "issuer_id": "19",
                                    }
                                ],
                            },
                            {
                                # Issued $0.25
                                "number": 3,
                                "timestamp": "2018-08-02T05:06:07Z",
                                "action": "grant",
                                "from_id": "19",
                                "to_id": "11",
                                "loops": [
                                    {
                                        "currency": "USD",
                                        "loop_id": "0",
                                        "amount": "0.25",
                                        "issuer_id": "19",
                                    }
                                ],
                            },
                        ],
                    }
                ],
                "more": False,
                "first_sync_ts": "2018-08-01T04:05:10Z",
                "last_sync_ts": "2018-08-01T04:05:11Z",
            },
        )
        obj = self._make(owner_id="19")
        obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual("19", downloads[0].owner_id)

        events = self.dbsession.query(db.OwnerLog).order_by(db.OwnerLog.id).all()
        self.assertEqual(
            [
                "opn_sync",
                "peer_add",
                "peer_add",
                "add_period_for_sync",
            ],
            [e.event_type for e in events],
        )
        event = events[0]
        self.assertEqual("19", event.owner_id)
        self.assertEqual(
            {"sync_ts", "progress_percent", "transfers", "change_count"},
            set(event.content.keys()),
        )

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual("grant", record.workflow_type)
        self.assertEqual(datetime.datetime(2018, 8, 1, 4, 5, 6), record.start)
        self.assertEqual(datetime.datetime(2018, 8, 1, 4, 5, 8), record.timestamp)
        self.assertEqual(True, record.completed)
        self.assertEqual(False, record.canceled)
        self.assertEqual("19", record.sender_id)
        self.assertEqual("wingcash:19", record.sender_uid)
        self.assertEqual("11", record.recipient_id)
        self.assertEqual("wingcash:11", record.recipient_uid)

        periods = self.dbsession.query(db.Period).all()
        self.assertEqual(1, len(periods))
        period = periods[0]
        self.assertEqual("19", period.owner_id)
        self.assertEqual(1239, period.file_id)

        movements = (
            self.dbsession.query(db.Movement, db.FileMovement)
            .outerjoin(db.FileMovement, db.FileMovement.movement_id == db.Movement.id)
            .order_by(db.Movement.id)
            .all()
        )
        self.assertEqual(3, len(movements))
        m, fm = movements[0]
        self.assertIsNone(fm)
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)

        m, fm = movements[1]
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("11", fm.peer_id)
        self.assertEqual(Decimal("-1.00"), fm.vault_delta)
        self.assertEqual(zero, fm.wallet_delta)

        m, fm = movements[2]
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("11", fm.peer_id)
        self.assertEqual(Decimal("-0.25"), fm.vault_delta)
        self.assertEqual(zero, fm.wallet_delta)

        events = self.dbsession.query(db.FileMovementLog).all()
        self.assertEqual(2, len(events))
        event = events[0]
        self.assertEqual("sync_file_movements", event.event_type)

    def test_redownload_with_updates(self):
        from opnreco.models import db

        def _make_transfer_result():
            return {
                "id": "500",
                "workflow_type": "redeem",
                "start": "2018-08-01T04:05:06Z",
                "currency": "USD",
                "amount": "1.00",
                "timestamp": "2018-08-01T04:05:08Z",
                "next_activity": "someactivity",
                "completed": False,
                "canceled": False,
                "sender_id": "11",
                "sender_uid": "wingcash:11",
                "sender_info": {
                    "title": "Tester",
                },
                "recipient_id": "1102",
                "recipient_uid": "wingcash:1102",
                "recipient_info": {
                    "title": "Acct",
                },
                # No movements yet.
                "movements": [],
            }

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [_make_transfer_result()],
                    "more": False,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                },
            )
            obj = self._make(owner_id="19")
            obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual("19", downloads[0].owner_id)

        events = self.dbsession.query(db.OwnerLog).order_by(db.OwnerLog.id).all()
        self.assertEqual(4, len(events))
        event = events[0]
        self.assertEqual("19", event.owner_id)
        self.assertEqual("opn_sync", event.event_type)
        self.assertEqual(
            {"sync_ts", "progress_percent", "transfers", "change_count"},
            set(event.content.keys()),
        )

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual("redeem", record.workflow_type)
        self.assertEqual(datetime.datetime(2018, 8, 1, 4, 5, 6), record.start)
        self.assertEqual(datetime.datetime(2018, 8, 1, 4, 5, 8), record.timestamp)
        self.assertEqual(False, record.completed)
        self.assertEqual(False, record.canceled)
        self.assertEqual("11", record.sender_id)
        self.assertEqual("wingcash:11", record.sender_uid)
        self.assertEqual("1102", record.recipient_id)
        self.assertEqual("wingcash:1102", record.recipient_uid)

        periods = self.dbsession.query(db.Period).all()
        self.assertEqual(0, len(periods))

        ms = self.dbsession.query(db.Movement).all()
        self.assertEqual(0, len(ms))

        recos = self.dbsession.query(db.Reco).all()
        self.assertEqual(0, len(recos))

        # Simulate the transfer completing the return of the cash
        # to the issuer and re-download.
        result1 = _make_transfer_result()
        result1["movements"] = [
            {
                "number": 1,
                "timestamp": "2018-08-02T05:06:06Z",
                "action": "redeem",
                "from_id": "1102",
                "to_id": "19",
                "loops": [
                    {
                        "currency": "USD",
                        "loop_id": "0",
                        "amount": "1.00",
                        "issuer_id": "19",
                    }
                ],
            }
        ]

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [result1],
                    "more": False,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                },
            )

            obj()

        events = self.dbsession.query(db.OwnerLog).order_by(db.OwnerLog.id).all()
        self.assertEqual(6, len(events))
        event = events[0]
        self.assertEqual("19", event.owner_id)
        self.assertEqual("opn_sync", event.event_type)
        self.assertEqual(
            {"sync_ts", "progress_percent", "transfers", "change_count"},
            set(event.content.keys()),
        )

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        self.assertFalse(records[0].canceled)

        periods = self.dbsession.query(db.Period).all()
        self.assertEqual(1, len(periods))
        period = periods[0]
        self.assertEqual("19", period.owner_id)
        self.assertEqual(1239, period.file_id)

        movements = (
            self.dbsession.query(db.FileMovement, db.Movement)
            .join(db.Movement, db.FileMovement.movement_id == db.Movement.id)
            .order_by(db.Movement.id)
            .all()
        )

        self.assertEqual(1, len(movements))
        fm, m = movements[0]
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("1102", fm.peer_id)
        self.assertEqual(Decimal("1.00"), fm.vault_delta)

        # Simulate a failed redemption: the issuer re-issues cash to
        # the profile. Re-download.
        result1 = _make_transfer_result()
        result1["canceled"] = True
        result1["next_activity"] = "canceled"
        result1["movements"] = [
            # The redeem movement remains.
            {
                "number": 1,
                "timestamp": "2018-08-02T05:06:06Z",
                "action": "redeem",
                "from_id": "1102",
                "to_id": "19",
                "loops": [
                    {
                        "currency": "USD",
                        "loop_id": "0",
                        "amount": "1.00",
                        "issuer_id": "19",
                    }
                ],
            },
            # The refund movement offsets the original movement.
            {
                "number": 2,
                "timestamp": "2018-08-02T05:06:07Z",
                "action": "refund",
                "from_id": "19",
                "to_id": "1102",
                "loops": [
                    {
                        "currency": "USD",
                        "loop_id": "0",
                        "amount": "1.00",
                        "issuer_id": "19",
                    }
                ],
            },
        ]

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [result1],
                    "more": False,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                },
            )
            obj()

        events = self.dbsession.query(db.OwnerLog).order_by(db.OwnerLog.id).all()
        self.assertEqual(7, len(events))
        event = events[-1]
        self.assertEqual("19", event.owner_id)
        self.assertEqual("opn_sync", event.event_type)
        self.assertEqual(
            {"sync_ts", "progress_percent", "transfers", "change_count"},
            set(event.content.keys()),
        )

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        self.assertTrue(records[0].canceled)

        periods = self.dbsession.query(db.Period).all()
        self.assertEqual(1, len(periods))
        period = periods[0]
        self.assertEqual("19", period.owner_id)
        self.assertEqual(1239, period.file_id)

        movements = (
            self.dbsession.query(db.FileMovement, db.Movement)
            .join(db.Movement, db.FileMovement.movement_id == db.Movement.id)
            .order_by(db.Movement.id)
            .all()
        )
        self.assertEqual(2, len(movements))
        fm, m = movements[0]
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("1102", fm.peer_id)
        self.assertEqual(Decimal("1.00"), fm.vault_delta)

        fm, m = movements[1]
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("1102", fm.peer_id)
        self.assertEqual(Decimal("-1.00"), fm.vault_delta)

    def test_redownload_with_no_movements_and_no_updates(self):
        from opnreco.models import db

        def _make_transfer_result():
            return {
                "id": "500",
                "workflow_type": "redeem",
                "start": "2018-08-01T04:05:06Z",
                "currency": "USD",
                "amount": "1.00",
                "timestamp": "2018-08-01T04:05:08Z",
                "next_activity": "send_to_dfi",
                "completed": False,
                "canceled": False,
                "sender_id": "11",
                "sender_uid": "wingcash:11",
                "sender_info": {
                    "title": "Tester",
                },
                "recipient_id": "1102",
                "recipient_uid": "wingcash:1102",
                "recipient_info": {
                    "title": "Acct",
                },
                # No movements yet.
                "movements": [],
            }

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [_make_transfer_result()],
                    "more": False,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                },
            )
            obj = self._make(owner_id="19")
            obj()

        periods = self.dbsession.query(db.Period).all()
        self.assertEqual(0, len(periods))

        movements = self.dbsession.query(db.Movement).order_by(db.Movement.number).all()
        self.assertEqual(0, len(movements))

        result1 = _make_transfer_result()

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [result1],
                    "more": False,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                },
            )
            obj()

        movements = self.dbsession.query(db.Movement).all()
        self.assertEqual(0, len(movements))

    def test_redownload_with_movements_but_no_updates(self):
        from opnreco.models import db

        def _make_transfer_result():
            return {
                "id": "500",
                "workflow_type": "redeem",
                "start": "2018-08-01T04:05:06Z",
                "currency": "USD",
                "amount": "1.00",
                "timestamp": "2018-08-01T04:05:08Z",
                "next_activity": "send_to_dfi",
                "completed": False,
                "canceled": False,
                "sender_id": "11",
                "sender_uid": "wingcash:11",
                "sender_info": {
                    "title": "Tester",
                },
                "recipient_id": "1102",
                "recipient_uid": "wingcash:1102",
                "recipient_info": {
                    "title": "Acct",
                },
                "movements": [
                    {
                        "number": 1,
                        "timestamp": "2018-08-02T05:06:06Z",
                        "action": "redeem",
                        "from_id": "1102",
                        "to_id": "19",
                        "loops": [
                            {
                                "currency": "USD",
                                "loop_id": "0",
                                "amount": "1.00",
                                "issuer_id": "19",
                            }
                        ],
                    },
                ],
            }

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [_make_transfer_result()],
                    "more": False,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                },
            )

            obj = self._make(owner_id="19")
            obj()

        periods = self.dbsession.query(db.Period).all()
        self.assertEqual(1, len(periods))
        period = periods[0]
        self.assertEqual("19", period.owner_id)
        self.assertEqual(1239, period.file_id)

        movements = (
            self.dbsession.query(db.Movement, db.FileMovement)
            .outerjoin(db.FileMovement, db.FileMovement.movement_id == db.Movement.id)
            .order_by(db.Movement.id)
            .all()
        )
        self.assertEqual(1, len(movements))
        m, fm = movements[0]
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("1102", fm.peer_id)
        self.assertEqual(Decimal("1.00"), fm.vault_delta)

        result1 = _make_transfer_result()

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [result1],
                    "more": False,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                },
            )
            obj()

        mss = self.dbsession.query(db.Movement).all()
        self.assertEqual(1, len(mss))

    def test_redownload_with_profile_updates(self):
        from opnreco.models import db

        def _make_transfer_result():
            return {
                "id": "500",
                "workflow_type": "return",
                "start": "2018-08-01T04:05:06Z",
                "currency": "USD",
                "amount": "1.00",
                "timestamp": "2018-08-01T04:05:08Z",
                "next_activity": "send_to_dfi",
                "completed": False,
                "canceled": False,
                "sender_id": "11",
                "sender_uid": "wingcash:11",
                "sender_info": {
                    "title": "Tester",
                },
                "recipient_id": "19",
                "recipient_uid": "wingcash:19",
                "recipient_info": {
                    "title": "Issuer",
                },
                "movements": [
                    {
                        "number": 1,
                        "timestamp": "2018-08-02T05:06:06Z",
                        "action": "redeem",
                        "from_id": "11",
                        "to_id": "19",
                        "loops": [
                            {
                                "currency": "USD",
                                "loop_id": "0",
                                "amount": "1.00",
                                "issuer_id": "19",
                            }
                        ],
                    },
                ],
            }

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [_make_transfer_result()],
                    "more": False,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                },
            )

            obj = self._make(owner_id="19")
            obj()

        periods = self.dbsession.query(db.Period).all()
        self.assertEqual(1, len(periods))
        period = periods[0]
        self.assertEqual("19", period.owner_id)
        self.assertEqual(1239, period.file_id)

        mss = self.dbsession.query(db.Movement).all()
        self.assertEqual(1, len(mss))

        movements = (
            self.dbsession.query(db.Movement, db.FileMovement)
            .outerjoin(db.FileMovement, db.FileMovement.movement_id == db.Movement.id)
            .order_by(db.Movement.id)
            .all()
        )
        self.assertEqual(1, len(movements))
        m, fm = movements[0]
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("11", fm.peer_id)
        self.assertEqual(Decimal("1.00"), fm.vault_delta)

        result1 = _make_transfer_result()
        result1["sender_info"]["screen_name"] = "somefella"

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [result1],
                    "more": False,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                },
            )
            obj()

        mss = self.dbsession.query(db.Movement).all()
        self.assertEqual(1, len(mss))

        events = self.dbsession.query(db.OwnerLog).order_by(db.OwnerLog.id).all()
        self.assertEqual(
            [
                "opn_sync",
                "peer_add",
                "peer_add",
                "add_period_for_sync",
                "opn_sync",
                "peer_update",
            ],
            [e.event_type for e in events],
        )

        self.assertEqual(
            {
                "changes": {"username": "somefella"},
                "peer_id": "11",
            },
            events[-1].content,
        )

    def test_verification_failure_due_to_changed_workflow_type(self):
        from pyramid.httpexceptions import HTTPInsufficientStorage

        def _make_transfer_result():
            return {
                "id": "500",
                "workflow_type": "redeem",
                "start": "2018-08-01T04:05:06Z",
                "currency": "USD",
                "amount": "1.00",
                "timestamp": "2018-08-01T04:05:08Z",
                "next_activity": "send_to_dfi",
                "completed": False,
                "canceled": False,
                "sender_id": "11",
                "sender_uid": "wingcash:11",
                "sender_info": {
                    "title": "Tester",
                },
                "recipient_id": "1102",
                "recipient_uid": "wingcash:1102",
                "recipient_info": {
                    "title": "Acct",
                },
                "movements": [
                    {
                        "number": 1,
                        "timestamp": "2018-08-02T05:06:06Z",
                        "action": "redeem",
                        "from_id": "1102",
                        "to_id": "19",
                        "loops": [
                            {
                                "currency": "USD",
                                "loop_id": "0",
                                "amount": "1.00",
                                "issuer_id": "19",
                            }
                        ],
                    },
                ],
            }

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [_make_transfer_result()],
                    "more": False,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                },
            )

            obj = self._make(owner_id="19")
            obj()

        result1 = _make_transfer_result()
        result1["workflow_type"] = "raspberry"

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [result1],
                    "more": False,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                },
            )
            with self.assertRaises(HTTPInsufficientStorage) as cm:
                obj()
            self.assertRegex(
                cm.exception.json["error_description"],
                r"Immutable attribute changed",
            )

    def test_download_batches(self):
        from opnreco.models import db

        def _make_transfer_result():
            return {
                "id": "501",
                "workflow_type": "grant",
                "start": "2018-08-01T04:05:06Z",
                "currency": "USD",
                "amount": "1.00",
                "timestamp": "2018-08-01T04:05:08Z",
                "next_activity": "someactivity",
                "completed": False,
                "canceled": False,
                "sender_id": "19",
                "sender_uid": "wingcash:19",
                "sender_info": {
                    "title": "Issuer",
                },
                "recipient_id": "11",
                "recipient_uid": "wingcash:11",
                "recipient_info": {
                    "title": "Tester",
                },
                "movements": [
                    {
                        "number": 1,
                        "timestamp": "2018-08-02T05:06:06Z",
                        "action": "redeem",
                        "from_id": "19",
                        "to_id": "11",
                        "loops": [
                            {
                                "currency": "USD",
                                "loop_id": "0",
                                "amount": "1.00",
                                "issuer_id": "19",
                            }
                        ],
                    },
                ],
            }

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [_make_transfer_result()],
                    "more": True,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                    "remain": 1,
                },
            )

            obj = self._make(owner_id="11")
            download_status = obj()
            self.assertGreaterEqual(download_status["progress_percent"], 0.0)
            self.assertLessEqual(download_status["progress_percent"], 100.0)
            self.assertEqual(
                {
                    "change_count": 5,
                    "download_count": 1,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                    "more": True,
                    "progress_percent": 50,
                },
                download_status,
            )

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual("11", downloads[0].owner_id)

        events = self.dbsession.query(db.OwnerLog).all()
        self.assertEqual(
            [
                "opn_sync",
                "peer_add",
                "peer_add",
                "add_period_for_sync",
            ],
            [e.event_type for e in events],
        )

        event = events[0]
        self.assertEqual("11", event.owner_id)
        self.assertEqual(
            {"sync_ts", "progress_percent", "transfers", "change_count"},
            set(event.content.keys()),
        )

        period = self.dbsession.query(db.Period).one()

        mss = (
            self.dbsession.query(db.Movement)
            .filter_by(loop_id="0", currency="USD")
            .all()
        )
        self.assertEqual(1, len(mss))

        mvlog_entries = self.dbsession.query(db.FileMovementLog).all()
        self.assertEqual(1, len(mvlog_entries))

        # Download the last batch.

        with responses.RequestsMock() as rsps:
            transfer_result = _make_transfer_result()
            transfer_result["id"] = "502"
            rsps.add(
                responses.POST,
                "https://opn.example.com:9999/wallet/history_sync",
                json={
                    "results": [transfer_result],
                    "more": False,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                },
            )
            download_status = obj()
            self.assertEqual(
                {
                    "change_count": 7,
                    "download_count": 1,
                    "first_sync_ts": "2018-08-01T04:05:10Z",
                    "last_sync_ts": "2018-08-01T04:05:11Z",
                    "more": False,
                    "progress_percent": 100,
                },
                download_status,
            )

        events = self.dbsession.query(db.OwnerLog).order_by(db.OwnerLog.id).all()
        self.assertEqual(
            [
                "opn_sync",
                "peer_add",
                "peer_add",
                "add_period_for_sync",
                "opn_sync",
            ],
            [e.event_type for e in events],
        )
        event = events[-1]
        self.assertEqual("11", event.owner_id)
        self.assertEqual(
            {"sync_ts", "progress_percent", "transfers", "change_count"},
            set(event.content.keys()),
        )

        records = (
            self.dbsession.query(db.TransferRecord).order_by(db.TransferRecord.id).all()
        )
        self.assertEqual(2, len(records))
        record = records[-1]
        self.assertFalse(record.canceled)
        self.assertEqual("502", record.transfer_id)

        periods = self.dbsession.query(db.Period).all()
        self.assertEqual(1, len(periods))
        period = periods[0]
        self.assertEqual("11", period.owner_id)
        self.assertEqual(1239, period.file_id)

        movements = (
            self.dbsession.query(db.Movement, db.FileMovement)
            .outerjoin(db.FileMovement, db.FileMovement.movement_id == db.Movement.id)
            .order_by(db.Movement.id)
            .all()
        )
        self.assertEqual(2, len(movements))
        m, fm = movements[0]
        self.assertEqual(records[0].id, m.transfer_record_id)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("19", fm.peer_id)
        self.assertEqual(Decimal("1.00"), fm.wallet_delta)

        m, fm = movements[1]
        self.assertEqual(records[1].id, m.transfer_record_id)
        self.assertEqual("0", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("19", fm.peer_id)
        self.assertEqual(Decimal("1.00"), fm.wallet_delta)

        mvlogs = (
            self.dbsession.query(db.FileMovementLog)
            .order_by(db.FileMovementLog.id)
            .all()
        )

        self.assertEqual(2, len(mvlogs))
        mvlog = mvlogs[0]
        self.assertEqual("sync_file_movements", mvlog.event_type)
        mvlog = mvlogs[1]
        self.assertEqual("sync_file_movements", mvlog.event_type)

    @responses.activate
    def test_closed_loop_send_design(self):
        # Reconcile closed loop cash for the distributor (profile 12).
        # The issuer is profile 15 and the recipient is profile 11.
        from opnreco.models import db

        responses.add(
            responses.POST,
            "https://opn.example.com:9999/wallet/history_sync",
            json={
                "results": [
                    {
                        "id": "501",
                        "workflow_type": "send_design",
                        "start": "2018-08-01T04:05:06Z",
                        "currency": "USD",
                        "amount": "1.25",
                        "timestamp": "2018-08-01T04:05:08Z",
                        "next_activity": "completed",
                        "completed": True,
                        "canceled": False,
                        "sender_id": "12",
                        "sender_uid": "wingcash:12",
                        "sender_info": {
                            "title": "Issuer",
                        },
                        "recipient_id": "11",
                        "recipient_uid": "wingcash:11",
                        "recipient_info": {
                            "title": "Some Tester",
                        },
                        "movements": [
                            {
                                # Note creation movement
                                "number": 1,
                                "timestamp": "2018-08-02T05:06:06Z",
                                "action": "issue",
                                "from_id": None,
                                "to_id": "15",
                                "loops": [
                                    {
                                        "currency": "USD",
                                        "loop_id": "41",
                                        "amount": "1.25",
                                        "issuer_id": "15",
                                    }
                                ],
                            },
                            {
                                # Issued $1.00 to the distributor (profile 12)
                                "number": 2,
                                "timestamp": "2018-08-02T05:06:07Z",
                                "action": "issue",
                                "from_id": "15",
                                "to_id": "12",
                                "loops": [
                                    {
                                        "currency": "USD",
                                        "loop_id": "41",
                                        "amount": "1.00",
                                        "issuer_id": "15",
                                    }
                                ],
                            },
                            {
                                # Issued $0.25 to the distributor (profile 12)
                                "number": 3,
                                "timestamp": "2018-08-02T05:06:07Z",
                                "action": "issue",
                                "from_id": "15",
                                "to_id": "12",
                                "loops": [
                                    {
                                        "currency": "USD",
                                        "loop_id": "41",
                                        "amount": "0.25",
                                        "issuer_id": "15",
                                    }
                                ],
                            },
                            {
                                # Sent from the distributor (profile 12)
                                # to the recipient (profile 11)
                                "number": 4,
                                "timestamp": "2018-08-02T05:06:07Z",
                                "action": "send",
                                "from_id": "12",
                                "to_id": "11",
                                "loops": [
                                    {
                                        "currency": "USD",
                                        "loop_id": "41",
                                        "amount": "1.25",
                                        "issuer_id": "15",
                                    }
                                ],
                            },
                        ],
                    }
                ],
                "more": False,
                "first_sync_ts": "2018-08-01T04:05:10Z",
                "last_sync_ts": "2018-08-01T04:05:11Z",
            },
        )
        # This is file is a reconciliation for the distributor (profile 12).
        obj = self._make(owner_id="12", file_type="closed_circ", auto_enable_loops=True)
        obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual("12", downloads[0].owner_id)

        events = self.dbsession.query(db.OwnerLog).order_by(db.OwnerLog.id).all()
        self.assertEqual(
            [
                "opn_sync",
                "peer_add",
                "peer_add",
                "add_file_loop_config",
                "add_period_for_sync",
            ],
            [e.event_type for e in events],
        )
        event = events[0]
        self.assertEqual("12", event.owner_id)
        self.assertEqual(
            {"sync_ts", "progress_percent", "transfers", "change_count"},
            set(event.content.keys()),
        )

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual("send_design", record.workflow_type)
        self.assertEqual(datetime.datetime(2018, 8, 1, 4, 5, 6), record.start)
        self.assertEqual(datetime.datetime(2018, 8, 1, 4, 5, 8), record.timestamp)
        self.assertEqual(True, record.completed)
        self.assertEqual(False, record.canceled)
        self.assertEqual("12", record.sender_id)
        self.assertEqual("wingcash:12", record.sender_uid)
        self.assertEqual("11", record.recipient_id)
        self.assertEqual("wingcash:11", record.recipient_uid)

        periods = self.dbsession.query(db.Period).all()
        self.assertEqual(1, len(periods))
        period = periods[0]
        self.assertEqual("12", period.owner_id)
        self.assertEqual(1239, period.file_id)

        movements = (
            self.dbsession.query(db.Movement, db.FileMovement)
            .outerjoin(db.FileMovement, db.FileMovement.movement_id == db.Movement.id)
            .order_by(db.Movement.id)
            .all()
        )
        self.assertEqual(4, len(movements))
        m, fm = movements[0]
        self.assertIsNone(fm)  # Don't reconcile the note creation
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("41", m.loop_id)
        self.assertEqual("USD", m.currency)

        m, fm = movements[1]
        self.assertIsNone(fm)
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("41", m.loop_id)
        self.assertEqual("USD", m.currency)

        m, fm = movements[2]
        self.assertIsNone(fm)
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("41", m.loop_id)
        self.assertEqual("USD", m.currency)

        m, fm = movements[3]
        self.assertEqual(record.id, m.transfer_record_id)
        self.assertEqual("41", m.loop_id)
        self.assertEqual("USD", m.currency)
        self.assertEqual("11", fm.peer_id)
        self.assertEqual(Decimal("-1.25"), fm.vault_delta)
        self.assertEqual(zero, fm.wallet_delta)

        events = self.dbsession.query(db.FileMovementLog).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual("sync_file_movements", event.event_type)
