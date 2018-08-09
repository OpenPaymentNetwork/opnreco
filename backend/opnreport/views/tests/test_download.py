
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

    def _make(self):
        from opnreport.models.db import Profile

        profile = Profile(
            id='11',
            title="Test Profile",
            last_download=datetime.datetime(2018, 7, 1, 5, 6, 7),
        )
        self.dbsession.add(profile)
        self.dbsession.flush()

        request = pyramid.testing.DummyRequest(
            dbsession=self.dbsession,
            profile=profile,
            access_token='example-token-for-11',
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
    def test_with_1_usd_transfer_from_wallet_to_account(self):
        from opnreport.models import db

        responses.add(
            responses.POST,
            'https://opn.example.com:9999/wallet/history_download',
            json={'results': [{
                'id': '500',
                'workflow_type': 'profile_to_profile',
                'start': '2018-08-01T04:05:06Z',
                'timestamp': '2018-08-01T04:05:08Z',
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
        self.assertEqual('profile_to_profile', record.workflow_type)
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
