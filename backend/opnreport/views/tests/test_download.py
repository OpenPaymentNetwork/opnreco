
from decimal import Decimal
from opnreport.testing import DBSessionFixture
import datetime
import os
import pyramid.testing
import responses
import unittest


def setup_module():
    global dbsession_fixture
    dbsession_fixture = DBSessionFixture()


def teardown_module():
    dbsession_fixture.close()


class TestDownloadView(unittest.TestCase):

    def setUp(self):
        os.environ['opn_api_url'] = 'https://opn.example.com:9999'
        self.config = pyramid.testing.setUp()
        self.dbsession, self.close_session = dbsession_fixture.begin_session()

    def tearDown(self):
        self.close_session()
        pyramid.testing.tearDown()

    @property
    def _class(self):
        from ..download import DownloadView
        return DownloadView

    def _make(self, profile_id='11'):
        from opnreport.models.db import Profile

        profile = Profile(
            id=profile_id,
            title="Test Profile",
            last_download=datetime.datetime(2018, 7, 1, 5, 6, 7),
        )
        self.dbsession.add(profile)
        self.dbsession.flush()

        request = pyramid.testing.DummyRequest(
            dbsession=self.dbsession,
            profile=profile,
            access_token='example-token',
            remote_addr='127.0.0.1',
            user_agent='Test UA',
        )
        return self._class(request)

    @responses.activate
    def test_with_no_transfers(self):
        from opnreport.models import db

        responses.add(
            responses.POST,
            'https://opn.example.com:9999/wallet/history_download',
            json={'results': [], 'more': False})
        obj = self._make()
        obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual('11', downloads[0].profile_id)

        events = self.dbsession.query(db.ProfileEvent).all()
        self.assertEqual(1, len(events))
        self.assertEqual('11', events[0].profile_id)

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(0, len(records))

    @responses.activate
    def test_redeem_from_sender_perspective(self):
        from opnreport.models import db

        responses.add(
            responses.POST,
            'https://opn.example.com:9999/wallet/history_download',
            json={'results': [{
                'id': '500',
                'workflow_type': 'redeem',
                'start': '2018-08-01T04:05:06Z',
                'timestamp': '2018-08-01T04:05:08Z',
                'next_activity': 'completed',
                'activity_ts': '2018-08-01T04:05:10Z',
                'completed': True,
                'canceled': False,
                'sender_id': '11',
                'sender_uid': 'wingcash:11',
                'sender_info': {
                    'title': "Tester",
                },
                'recipient_id': '1102',
                'recipient_uid': 'wingcash:1102',
                'recipient_info': {
                    'title': "Acct",
                },
                'movements': [{
                    'from_id': '11',
                    'to_id': '1102',
                    'loops': [{
                        'currency': 'USD',
                        'loop_id': '0',
                        'amount': '1.00',
                        'issuer_id': '19',
                    }],
                }, {
                    'from_id': '11',
                    'to_id': '1102',
                    'loops': [{
                        'currency': 'USD',
                        'loop_id': '0',
                        'amount': '0.25',
                        'issuer_id': '20',
                    }],
                }],
            }], 'more': False})
        obj = self._make()
        obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual('11', downloads[0].profile_id)

        events = self.dbsession.query(db.ProfileEvent).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual('11', event.profile_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual(
            {'since_activity_ts', 'transfers'}, set(event.memo.keys()))

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual('redeem', record.workflow_type)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 6), record.start)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 8), record.timestamp)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 10), record.activity_ts)
        self.assertEqual(True, record.completed)
        self.assertEqual(False, record.canceled)
        self.assertEqual('11', record.sender_id)
        self.assertEqual('wingcash:11', record.sender_uid)
        self.assertEqual('Tester', record.sender_title)
        self.assertEqual('1102', record.recipient_id)
        self.assertEqual('wingcash:1102', record.recipient_uid)
        self.assertEqual('Acct', record.recipient_title)

        mss = self.dbsession.query(db.MovementSummary).all()
        self.assertEqual(1, len(mss))
        ms = mss[0]
        self.assertEqual(record.id, ms.transfer_record_id)
        self.assertEqual('11', ms.profile_id)
        self.assertEqual('1102', ms.account_id)
        self.assertEqual(0, ms.movement_list_index)
        self.assertEqual('0', ms.loop_id)
        self.assertEqual('USD', ms.currency)
        self.assertEqual(Decimal('-1.25'), ms.delta)

        reco_entries = self.dbsession.query(db.RecoEntry).all()
        self.assertEqual(1, len(reco_entries))
        reco_entry = reco_entries[0]
        self.assertEqual('11', reco_entry.profile_id)
        self.assertEqual('1102', reco_entry.account_id)
        self.assertEqual(ms.id, reco_entry.movement_summary_id)
        self.assertIsNone(reco_entry.account_entry_id)
        self.assertIsNone(reco_entry.comment)
        self.assertIsNone(reco_entry.reco_ts)
        self.assertIsNone(reco_entry.reco_by)

        events = self.dbsession.query(db.RecoEntryEvent).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual(reco_entry.id, event.reco_entry_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual({'transfer_id': '500'}, event.memo)

    @responses.activate
    def test_redeem_from_issuer_perspective(self):
        from opnreport.models import db

        responses.add(
            responses.POST,
            'https://opn.example.com:9999/wallet/history_download',
            json={'results': [{
                'id': '500',
                'workflow_type': 'redeem',
                'start': '2018-08-01T04:05:06Z',
                'timestamp': '2018-08-01T04:05:08Z',
                'next_activity': 'completed',
                'activity_ts': '2018-08-01T04:05:10Z',
                'completed': True,
                'canceled': False,
                'sender_id': '11',
                'sender_uid': 'wingcash:11',
                'sender_info': {
                    'title': "Tester",
                },
                'recipient_id': '1102',
                'recipient_uid': 'wingcash:1102',
                'recipient_info': {
                    'title': "Acct",
                },
                'movements': [{
                    'from_id': '1102',
                    'to_id': '19',
                    'loops': [{
                        'currency': 'USD',
                        'loop_id': '0',
                        'amount': '1.00',
                        'issuer_id': '19',
                    }],
                }],
            }], 'more': False})
        obj = self._make(profile_id='19')
        obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual('19', downloads[0].profile_id)

        events = self.dbsession.query(db.ProfileEvent).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual('19', event.profile_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual(
            {'since_activity_ts', 'transfers'}, set(event.memo.keys()))

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual('redeem', record.workflow_type)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 6), record.start)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 8), record.timestamp)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 10), record.activity_ts)
        self.assertEqual(True, record.completed)
        self.assertEqual(False, record.canceled)
        self.assertEqual('11', record.sender_id)
        self.assertEqual('wingcash:11', record.sender_uid)
        self.assertEqual('Tester', record.sender_title)
        self.assertEqual('1102', record.recipient_id)
        self.assertEqual('wingcash:1102', record.recipient_uid)
        self.assertEqual('Acct', record.recipient_title)

        mss = self.dbsession.query(db.MovementSummary).all()
        self.assertEqual(1, len(mss))
        ms = mss[0]
        self.assertEqual(record.id, ms.transfer_record_id)
        self.assertEqual('19', ms.profile_id)
        self.assertEqual('c', ms.account_id)
        self.assertEqual(0, ms.movement_list_index)
        self.assertEqual('0', ms.loop_id)
        self.assertEqual('USD', ms.currency)
        self.assertEqual(Decimal('1.00'), ms.delta)

        reco_entries = self.dbsession.query(db.RecoEntry).all()
        self.assertEqual(1, len(reco_entries))
        reco_entry = reco_entries[0]
        self.assertEqual('19', reco_entry.profile_id)
        self.assertEqual('c', reco_entry.account_id)
        self.assertEqual(ms.id, reco_entry.movement_summary_id)
        self.assertIsNone(reco_entry.account_entry_id)
        self.assertIsNone(reco_entry.comment)
        self.assertIsNone(reco_entry.reco_ts)
        self.assertIsNone(reco_entry.reco_by)

        events = self.dbsession.query(db.RecoEntryEvent).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual(reco_entry.id, event.reco_entry_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual({'transfer_id': '500'}, event.memo)

    @responses.activate
    def test_grant_from_recipient_perspective(self):
        from opnreport.models import db

        responses.add(
            responses.POST,
            'https://opn.example.com:9999/wallet/history_download',
            json={'results': [{
                'id': '501',
                'workflow_type': 'grant',
                'start': '2018-08-01T04:05:06Z',
                'timestamp': '2018-08-01T04:05:08Z',
                'next_activity': 'completed',
                'activity_ts': '2018-08-01T04:05:10Z',
                'completed': True,
                'canceled': False,
                'sender_id': '19',
                'sender_uid': 'wingcash:19',
                'sender_info': {
                    'title': "Issuer",
                },
                'recipient_id': '11',
                'recipient_uid': 'wingcash:11',
                'recipient_info': {
                    'title': "Some Tester",
                },
                'movements': [
                    {
                        # Issued $1.00
                        'from_id': '19',
                        'to_id': '11',
                        'loops': [{
                            'currency': 'USD',
                            'loop_id': '0',
                            'amount': '1.00',
                            'issuer_id': '19',
                        }],
                    }, {
                        # Issued $0.25
                        'from_id': '19',
                        'to_id': '11',
                        'loops': [{
                            'currency': 'USD',
                            'loop_id': '0',
                            'amount': '0.25',
                            'issuer_id': '19',
                        }],
                    },
                ],
            }], 'more': False})
        obj = self._make(profile_id='11')
        obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual('11', downloads[0].profile_id)

        events = self.dbsession.query(db.ProfileEvent).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual('11', event.profile_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual(
            {'since_activity_ts', 'transfers'}, set(event.memo.keys()))

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual('grant', record.workflow_type)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 6), record.start)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 8), record.timestamp)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 10), record.activity_ts)
        self.assertEqual(True, record.completed)
        self.assertEqual(False, record.canceled)
        self.assertEqual('19', record.sender_id)
        self.assertEqual('wingcash:19', record.sender_uid)
        self.assertEqual('Issuer', record.sender_title)
        self.assertEqual('11', record.recipient_id)
        self.assertEqual('wingcash:11', record.recipient_uid)
        self.assertEqual('Some Tester', record.recipient_title)

        mss = self.dbsession.query(db.MovementSummary).all()
        self.assertEqual(1, len(mss))
        ms = mss[0]
        self.assertEqual(record.id, ms.transfer_record_id)
        self.assertEqual('11', ms.profile_id)
        self.assertEqual('19', ms.account_id)
        self.assertEqual(0, ms.movement_list_index)
        self.assertEqual('0', ms.loop_id)
        self.assertEqual('USD', ms.currency)
        self.assertEqual(Decimal('1.25'), ms.delta)

        reco_entries = self.dbsession.query(db.RecoEntry).all()
        self.assertEqual(1, len(reco_entries))
        reco_entry = reco_entries[0]
        self.assertEqual('11', reco_entry.profile_id)
        self.assertEqual('19', reco_entry.account_id)
        self.assertEqual(ms.id, reco_entry.movement_summary_id)
        self.assertIsNone(reco_entry.account_entry_id)
        self.assertIsNone(reco_entry.comment)
        self.assertIsNone(reco_entry.reco_ts)
        self.assertIsNone(reco_entry.reco_by)

        events = self.dbsession.query(db.RecoEntryEvent).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual(reco_entry.id, event.reco_entry_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual({'transfer_id': '501'}, event.memo)

    @responses.activate
    def test_grant_from_issuer_perspective(self):
        from opnreport.models import db

        responses.add(
            responses.POST,
            'https://opn.example.com:9999/wallet/history_download',
            json={'results': [{
                'id': '501',
                'workflow_type': 'grant',
                'start': '2018-08-01T04:05:06Z',
                'timestamp': '2018-08-01T04:05:08Z',
                'next_activity': 'completed',
                'activity_ts': '2018-08-01T04:05:10Z',
                'completed': True,
                'canceled': False,
                'sender_id': '19',
                'sender_uid': 'wingcash:19',
                'sender_info': {
                    'title': "Issuer",
                },
                'recipient_id': '11',
                'recipient_uid': 'wingcash:11',
                'recipient_info': {
                    'title': "Some Tester",
                },
                'movements': [
                    {
                        # Issuance movement to ignore
                        'from_id': None,
                        'to_id': '19',
                        'loops': [{
                            'currency': 'USD',
                            'loop_id': '0',
                            'amount': '1.25',
                            'issuer_id': '19',
                        }],
                    }, {
                        # Issued $1.00
                        'from_id': '19',
                        'to_id': '11',
                        'loops': [{
                            'currency': 'USD',
                            'loop_id': '0',
                            'amount': '1.00',
                            'issuer_id': '19',
                        }],
                    }, {
                        # Issued $0.25
                        'from_id': '19',
                        'to_id': '11',
                        'loops': [{
                            'currency': 'USD',
                            'loop_id': '0',
                            'amount': '0.25',
                            'issuer_id': '19',
                        }],
                    },
                ],
            }], 'more': False})
        obj = self._make(profile_id='19')
        obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual('19', downloads[0].profile_id)

        events = self.dbsession.query(db.ProfileEvent).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual('19', event.profile_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual(
            {'since_activity_ts', 'transfers'}, set(event.memo.keys()))

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual('grant', record.workflow_type)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 6), record.start)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 8), record.timestamp)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 10), record.activity_ts)
        self.assertEqual(True, record.completed)
        self.assertEqual(False, record.canceled)
        self.assertEqual('19', record.sender_id)
        self.assertEqual('wingcash:19', record.sender_uid)
        self.assertEqual('Issuer', record.sender_title)
        self.assertEqual('11', record.recipient_id)
        self.assertEqual('wingcash:11', record.recipient_uid)
        self.assertEqual('Some Tester', record.recipient_title)

        mss = self.dbsession.query(db.MovementSummary).all()
        self.assertEqual(1, len(mss))
        ms = mss[0]
        self.assertEqual(record.id, ms.transfer_record_id)
        self.assertEqual('19', ms.profile_id)
        self.assertEqual('c', ms.account_id)
        self.assertEqual(0, ms.movement_list_index)
        self.assertEqual('0', ms.loop_id)
        self.assertEqual('USD', ms.currency)
        self.assertEqual(Decimal('-1.25'), ms.delta)

        reco_entries = self.dbsession.query(db.RecoEntry).all()
        self.assertEqual(1, len(reco_entries))
        reco_entry = reco_entries[0]
        self.assertEqual('19', reco_entry.profile_id)
        self.assertEqual('c', reco_entry.account_id)
        self.assertEqual(ms.id, reco_entry.movement_summary_id)
        self.assertIsNone(reco_entry.account_entry_id)
        self.assertIsNone(reco_entry.comment)
        self.assertIsNone(reco_entry.reco_ts)
        self.assertIsNone(reco_entry.reco_by)

        events = self.dbsession.query(db.RecoEntryEvent).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual(reco_entry.id, event.reco_entry_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual({'transfer_id': '501'}, event.memo)

    def test_redownload_with_updates(self):
        from opnreport.models import db

        def _make_transfer_result():
            return {
                'id': '500',
                'workflow_type': 'redeem',
                'start': '2018-08-01T04:05:06Z',
                'timestamp': '2018-08-01T04:05:08Z',
                'next_activity': 'someactivity',
                'activity_ts': '2018-08-01T04:05:10Z',
                'completed': False,
                'canceled': False,
                'sender_id': '11',
                'sender_uid': 'wingcash:11',
                'sender_info': {
                    'title': "Tester",
                },
                'recipient_id': '1102',
                'recipient_uid': 'wingcash:1102',
                'recipient_info': {
                    'title': "Acct",
                },
                # No movements yet.
                'movements': [],
            }

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                'https://opn.example.com:9999/wallet/history_download',
                json={'results': [_make_transfer_result()], 'more': False})
            obj = self._make(profile_id='19')
            obj()

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual('19', downloads[0].profile_id)

        events = self.dbsession.query(db.ProfileEvent).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual('19', event.profile_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual(
            {'since_activity_ts', 'transfers'}, set(event.memo.keys()))

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual('redeem', record.workflow_type)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 6), record.start)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 8), record.timestamp)
        self.assertEqual(
            datetime.datetime(2018, 8, 1, 4, 5, 10), record.activity_ts)
        self.assertEqual(False, record.completed)
        self.assertEqual(False, record.canceled)
        self.assertEqual('11', record.sender_id)
        self.assertEqual('wingcash:11', record.sender_uid)
        self.assertEqual('Tester', record.sender_title)
        self.assertEqual('1102', record.recipient_id)
        self.assertEqual('wingcash:1102', record.recipient_uid)
        self.assertEqual('Acct', record.recipient_title)

        mss = self.dbsession.query(db.MovementSummary).all()
        self.assertEqual(0, len(mss))

        reco_entries = self.dbsession.query(db.RecoEntry).all()
        self.assertEqual(0, len(reco_entries))

        events = self.dbsession.query(db.RecoEntryEvent).all()
        self.assertEqual(0, len(events))

        # Simulate the transfer completing the return of the cash
        # to the issuer and re-download.
        result1 = _make_transfer_result()
        result1['movements'] = [{
            'from_id': '1102',
            'to_id': '19',
            'loops': [{
                'currency': 'USD',
                'loop_id': '0',
                'amount': '1.00',
                'issuer_id': '19',
            }],
        }]

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                'https://opn.example.com:9999/wallet/history_download',
                json={'results': [result1], 'more': False})
            obj()

        events = (
            self.dbsession.query(db.ProfileEvent)
            .order_by(db.ProfileEvent.id).all())
        self.assertEqual(2, len(events))
        event = events[-1]
        self.assertEqual('19', event.profile_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual(
            {'since_activity_ts', 'transfers'}, set(event.memo.keys()))

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        self.assertFalse(records[0].canceled)

        mss = self.dbsession.query(db.MovementSummary).all()
        self.assertEqual(1, len(mss))
        ms = mss[0]
        self.assertEqual(record.id, ms.transfer_record_id)
        self.assertEqual('19', ms.profile_id)
        self.assertEqual('c', ms.account_id)
        self.assertEqual(1, ms.movement_list_index)
        self.assertEqual('0', ms.loop_id)
        self.assertEqual('USD', ms.currency)
        self.assertEqual(Decimal('1.00'), ms.delta)

        reco_entries = self.dbsession.query(db.RecoEntry).all()
        self.assertEqual(1, len(reco_entries))
        reco_entry = reco_entries[0]
        self.assertEqual('19', reco_entry.profile_id)
        self.assertEqual('c', reco_entry.account_id)
        self.assertEqual(ms.id, reco_entry.movement_summary_id)
        self.assertIsNone(reco_entry.account_entry_id)
        self.assertIsNone(reco_entry.comment)
        self.assertIsNone(reco_entry.reco_ts)
        self.assertIsNone(reco_entry.reco_by)

        events = self.dbsession.query(db.RecoEntryEvent).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual(reco_entry.id, event.reco_entry_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual({'transfer_id': '500'}, event.memo)

        # Simulate a failed redemption: the issuer re-issues cash to
        # the profile. Re-download.
        result1 = _make_transfer_result()
        result1['canceled'] = True
        result1['next_activity'] = 'canceled'
        result1['movements'] = [
            # The redeem movement remains.
            {
                'from_id': '1102',
                'to_id': '19',
                'loops': [{
                    'currency': 'USD',
                    'loop_id': '0',
                    'amount': '1.00',
                    'issuer_id': '19',
                }],
            },
            # The return movement offsets the original movement.
            {
                'from_id': '19',
                'to_id': '1102',
                'loops': [{
                    'currency': 'USD',
                    'loop_id': '0',
                    'amount': '1.00',
                    'issuer_id': '19',
                }],
            },
        ]

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                'https://opn.example.com:9999/wallet/history_download',
                json={'results': [result1], 'more': False})
            obj()

        events = (
            self.dbsession.query(db.ProfileEvent)
            .order_by(db.ProfileEvent.id).all())
        self.assertEqual(3, len(events))
        event = events[-1]
        self.assertEqual('19', event.profile_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual(
            {'since_activity_ts', 'transfers'}, set(event.memo.keys()))

        records = self.dbsession.query(db.TransferRecord).all()
        self.assertEqual(1, len(records))
        self.assertTrue(records[0].canceled)

        mss = (
            self.dbsession.query(db.MovementSummary)
            .order_by(db.MovementSummary.id).all())
        self.assertEqual(2, len(mss))
        ms = mss[-1]
        self.assertEqual(record.id, ms.transfer_record_id)
        self.assertEqual('19', ms.profile_id)
        self.assertEqual('c', ms.account_id)
        self.assertEqual(2, ms.movement_list_index)
        self.assertEqual('0', ms.loop_id)
        self.assertEqual('USD', ms.currency)
        self.assertEqual(Decimal('-1.00'), ms.delta)

        reco_entries = (
            self.dbsession.query(db.RecoEntry)
            .order_by(db.RecoEntry.id).all())
        self.assertEqual(2, len(reco_entries))
        reco_entry = reco_entries[-1]
        self.assertEqual('19', reco_entry.profile_id)
        self.assertEqual('c', reco_entry.account_id)
        self.assertEqual(ms.id, reco_entry.movement_summary_id)
        self.assertIsNone(reco_entry.account_entry_id)
        self.assertIsNone(reco_entry.comment)
        self.assertIsNone(reco_entry.reco_ts)
        self.assertIsNone(reco_entry.reco_by)

        events = (
            self.dbsession.query(db.RecoEntryEvent)
            .order_by(db.RecoEntryEvent.id).all())
        self.assertEqual(2, len(events))
        event = events[-1]
        self.assertEqual(reco_entry.id, event.reco_entry_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual({'transfer_id': '500'}, event.memo)

    def test_redownload_with_no_movements_and_no_updates(self):
        from opnreport.models import db

        def _make_transfer_result():
            return {
                'id': '500',
                'workflow_type': 'redeem',
                'start': '2018-08-01T04:05:06Z',
                'timestamp': '2018-08-01T04:05:08Z',
                'next_activity': 'send_to_dfi',
                'activity_ts': '2018-08-01T04:05:10Z',
                'completed': False,
                'canceled': False,
                'sender_id': '11',
                'sender_uid': 'wingcash:11',
                'sender_info': {
                    'title': "Tester",
                },
                'recipient_id': '1102',
                'recipient_uid': 'wingcash:1102',
                'recipient_info': {
                    'title': "Acct",
                },
                # No movements yet.
                'movements': [],
            }

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                'https://opn.example.com:9999/wallet/history_download',
                json={'results': [_make_transfer_result()], 'more': False})
            obj = self._make(profile_id='19')
            obj()

        mss = self.dbsession.query(db.MovementSummary).all()
        self.assertEqual(0, len(mss))

        reco_entries = self.dbsession.query(db.RecoEntry).all()
        self.assertEqual(0, len(reco_entries))

        events = self.dbsession.query(db.RecoEntryEvent).all()
        self.assertEqual(0, len(events))

        result1 = _make_transfer_result()

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                'https://opn.example.com:9999/wallet/history_download',
                json={'results': [result1], 'more': False})
            obj()

        mss = self.dbsession.query(db.MovementSummary).all()
        self.assertEqual(0, len(mss))

    def test_redownload_with_movements_but_no_updates(self):
        from opnreport.models import db

        def _make_transfer_result():
            return {
                'id': '500',
                'workflow_type': 'redeem',
                'start': '2018-08-01T04:05:06Z',
                'timestamp': '2018-08-01T04:05:08Z',
                'next_activity': 'send_to_dfi',
                'activity_ts': '2018-08-01T04:05:10Z',
                'completed': False,
                'canceled': False,
                'sender_id': '11',
                'sender_uid': 'wingcash:11',
                'sender_info': {
                    'title': "Tester",
                },
                'recipient_id': '1102',
                'recipient_uid': 'wingcash:1102',
                'recipient_info': {
                    'title': "Acct",
                },
                'movements': [
                    {
                        'from_id': '1102',
                        'to_id': '19',
                        'loops': [{
                            'currency': 'USD',
                            'loop_id': '0',
                            'amount': '1.00',
                            'issuer_id': '19',
                        }],
                    },
                ],
            }

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                'https://opn.example.com:9999/wallet/history_download',
                json={'results': [_make_transfer_result()], 'more': False})
            obj = self._make(profile_id='19')
            obj()

        mss = self.dbsession.query(db.MovementSummary).all()
        self.assertEqual(1, len(mss))
        ms = mss[0]
        self.assertEqual('19', ms.profile_id)
        self.assertEqual('c', ms.account_id)
        self.assertEqual(0, ms.movement_list_index)
        self.assertEqual('0', ms.loop_id)
        self.assertEqual('USD', ms.currency)
        self.assertEqual(Decimal('1.00'), ms.delta)

        result1 = _make_transfer_result()

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                'https://opn.example.com:9999/wallet/history_download',
                json={'results': [result1], 'more': False})
            obj()

        mss = self.dbsession.query(db.MovementSummary).all()
        self.assertEqual(1, len(mss))

    def test_sync_error(self):
        from opnreport.views.download import SyncError

        def _make_transfer_result():
            return {
                'id': '500',
                'workflow_type': 'redeem',
                'start': '2018-08-01T04:05:06Z',
                'timestamp': '2018-08-01T04:05:08Z',
                'next_activity': 'send_to_dfi',
                'activity_ts': '2018-08-01T04:05:10Z',
                'completed': False,
                'canceled': False,
                'sender_id': '11',
                'sender_uid': 'wingcash:11',
                'sender_info': {
                    'title': "Tester",
                },
                'recipient_id': '1102',
                'recipient_uid': 'wingcash:1102',
                'recipient_info': {
                    'title': "Acct",
                },
                'movements': [
                    {
                        'from_id': '1102',
                        'to_id': '19',
                        'loops': [{
                            'currency': 'USD',
                            'loop_id': '0',
                            'amount': '1.00',
                            'issuer_id': '19',
                        }],
                    },
                ],
            }

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                'https://opn.example.com:9999/wallet/history_download',
                json={'results': [_make_transfer_result()], 'more': False})
            obj = self._make(profile_id='19')
            obj()

        result1 = _make_transfer_result()
        result1['workflow_type'] = 'raspberry'

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                'https://opn.example.com:9999/wallet/history_download',
                json={'results': [result1], 'more': False})
            with self.assertRaisesRegexp(
                    SyncError, r'Immutable attribute changed'):
                obj()

    def test_download_batches(self):
        from opnreport.models import db

        def _make_transfer_result():
            return {
                'id': '501',
                'workflow_type': 'grant',
                'start': '2018-08-01T04:05:06Z',
                'timestamp': '2018-08-01T04:05:08Z',
                'next_activity': 'someactivity',
                'activity_ts': '2018-08-01T04:05:10Z',
                'completed': False,
                'canceled': False,
                'sender_id': '19',
                'sender_uid': 'wingcash:19',
                'sender_info': {
                    'title': "Issuer",
                },
                'recipient_id': '11',
                'recipient_uid': 'wingcash:11',
                'recipient_info': {
                    'title': "Tester",
                },
                'movements': [
                    {
                        'from_id': '19',
                        'to_id': '11',
                        'loops': [{
                            'currency': 'USD',
                            'loop_id': '0',
                            'amount': '1.00',
                            'issuer_id': '19',
                        }],
                    },
                ],
            }

        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                'https://opn.example.com:9999/wallet/history_download',
                json={'results': [_make_transfer_result()], 'more': True})
            obj = self._make(profile_id='11')
            download_status = obj()
            self.assertGreaterEqual(download_status['progress_percent'], 0.0)
            self.assertLessEqual(download_status['progress_percent'], 100.0)
            self.assertEqual({
                'count': 1,
                'more': True,
                'progress_percent': download_status['progress_percent'],
                'last_activity_ts': '2018-08-01T04:05:10Z',
            }, download_status)

        downloads = self.dbsession.query(db.OPNDownload).all()
        self.assertEqual(1, len(downloads))
        self.assertEqual('11', downloads[0].profile_id)

        events = self.dbsession.query(db.ProfileEvent).all()
        self.assertEqual(1, len(events))
        event = events[0]
        self.assertEqual('11', event.profile_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual(
            {'since_activity_ts', 'transfers'}, set(event.memo.keys()))

        mss = self.dbsession.query(db.MovementSummary).all()
        self.assertEqual(1, len(mss))

        reco_entries = self.dbsession.query(db.RecoEntry).all()
        self.assertEqual(1, len(reco_entries))

        events = self.dbsession.query(db.RecoEntryEvent).all()
        self.assertEqual(1, len(events))

        # Download the last batch.

        with responses.RequestsMock() as rsps:
            transfer_result = _make_transfer_result()
            transfer_result['id'] = '502'
            rsps.add(
                responses.POST,
                'https://opn.example.com:9999/wallet/history_download',
                json={'results': [transfer_result], 'more': False})
            download_status = obj()
            self.assertEqual({
                'count': 1,
                'more': False,
                'progress_percent': 100.0,
                'last_activity_ts': '2018-08-01T04:05:10Z',
            }, download_status)

        events = (
            self.dbsession.query(db.ProfileEvent)
            .order_by(db.ProfileEvent.id).all())
        self.assertEqual(2, len(events))
        event = events[-1]
        self.assertEqual('11', event.profile_id)
        self.assertEqual('opn_download', event.event_type)
        self.assertEqual(
            {'since_activity_ts', 'transfers'}, set(event.memo.keys()))

        records = (
            self.dbsession.query(db.TransferRecord)
            .order_by(db.TransferRecord.id).all())
        self.assertEqual(2, len(records))
        record = records[-1]
        self.assertFalse(record.canceled)
        self.assertEqual('502', record.transfer_id)

        mss = (
            self.dbsession.query(db.MovementSummary)
            .order_by(db.MovementSummary.id).all())
        self.assertEqual(2, len(mss))
        ms = mss[-1]
        self.assertEqual(record.id, ms.transfer_record_id)
        self.assertEqual('11', ms.profile_id)
        self.assertEqual('19', ms.account_id)
        self.assertEqual(0, ms.movement_list_index)
        self.assertEqual('0', ms.loop_id)
        self.assertEqual('USD', ms.currency)
        self.assertEqual(Decimal('1.00'), ms.delta)

        reco_entries = (
            self.dbsession.query(db.RecoEntry)
            .order_by(db.RecoEntry.id).all())
        self.assertEqual(2, len(reco_entries))
        reco_entry = reco_entries[-1]
        self.assertEqual('11', reco_entry.profile_id)
        self.assertEqual('19', reco_entry.account_id)
        self.assertEqual(ms.id, reco_entry.movement_summary_id)
        self.assertIsNone(reco_entry.account_entry_id)
        self.assertIsNone(reco_entry.comment)
        self.assertIsNone(reco_entry.reco_ts)
        self.assertIsNone(reco_entry.reco_by)
