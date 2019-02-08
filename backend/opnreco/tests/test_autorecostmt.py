
from decimal import Decimal
from opnreco.testing import DBSessionFixture
from sqlalchemy import func
import collections
import datetime
import pyramid.testing
import unittest


def setup_module():
    global dbsession_fixture
    dbsession_fixture = DBSessionFixture()


def teardown_module():
    dbsession_fixture.close()


class TestSortableMatch(unittest.TestCase):

    @property
    def _class(self):
        from ..autorecostmt import SortableMatch
        return SortableMatch

    def _make(
            self,
            delta=Decimal('5.00'),
            account_entry_id=33,
            entry_date=datetime.date(2019, 1, 15),
            description='Banco T23486735',
            movement_ids=[55],
            movement_date=datetime.date(2019, 1, 13),
            transfer_id='2348673501',
            ):

        class Row:
            def __init__(self):
                self.delta = delta
                self.account_entry_id = account_entry_id
                self.entry_date = entry_date
                self.description = description
                self.movement_ids = movement_ids
                self.movement_date = movement_date
                self.transfer_id = transfer_id

        return self._class(Row())

    def test_with_partial_description_match(self):
        obj = self._make()
        self.assertGreater(obj.score, 23)
        self.assertLess(obj.score, 24)
        self.assertEqual(
            (obj.score,  datetime.date(2019, 1, 15), 33, (55,)),
            obj.sort_key)

    def test_with_full_description_match(self):
        obj = self._make(description='Banco T2348673501 Sent')
        self.assertGreater(obj.score, 55)
        self.assertLess(obj.score, 56)
        self.assertEqual(
            (obj.score,  datetime.date(2019, 1, 15), 33, (55,)),
            obj.sort_key)

    def test_with_no_description_match(self):
        obj = self._make(description='REDEEM')
        self.assertEqual(-2, obj.score)
        self.assertEqual(
            (obj.score,  datetime.date(2019, 1, 15), 33, (55,)),
            obj.sort_key)


class Test_auto_reco_statement(unittest.TestCase):

    def setUp(self):
        self.config = pyramid.testing.setUp()
        self.dbsession, self.close_session = dbsession_fixture.begin_session()

    def tearDown(self):
        self.close_session()
        pyramid.testing.tearDown()

    def _call(self, *args, **kw):
        from ..autorecostmt import auto_reco_statement
        return auto_reco_statement(*args, **kw)

    def add_peer(self):
        from opnreco.models import db
        dbsession = self.dbsession

        self.owner = owner = db.Owner(
            id='102',
            title="Testy Owner",
            username='testowner',
            tzname='UTC',
        )
        dbsession.add(owner)
        dbsession.flush()

        dbsession.query(
            func.set_config('opnreco.personal_id', str(owner.id), True),
            func.set_config('opnreco.movement.event_type', 'test', True),
            func.set_config('opnreco.account_entry.event_type', 'test', True),
        ).one()

        self.peer = peer = db.Peer(
            owner_id='102',
            peer_id='c',
            title="Testy Owner",
            username='testowner',
        )
        dbsession.add(peer)

        return peer

    def add_period(self):
        from opnreco.models import db
        dbsession = self.dbsession

        self.period = period = db.Period(
            owner_id='102',
            peer_id='c',
            loop_id='0',
            currency='USD',
            has_vault=True,
            start_date=datetime.date(2018, 1, 1),
            end_date=None,
        )
        dbsession.add(period)

        dbsession.flush()

    def add_transfer_6502(
            self,
            amount='2.00',
            bundle_transfer_id=None,
            transfer_id='6502',
            ):
        from opnreco.models import db
        dbsession = self.dbsession

        r = db.TransferRecord(
            owner_id='102',
            transfer_id=transfer_id,
            workflow_type='redeem',
            start=datetime.datetime(2018, 1, 15, 6, 0, 0),
            currency='USD',
            amount=Decimal(amount),
            timestamp=datetime.datetime(2018, 1, 15, 6, 0, 1),
            next_activity='completed',
            completed=True,
            canceled=False,
            sender_id='11',
            sender_uid='wingcash:11',
            sender_info={'title': "Testy User"},
            recipient_id='211',
            recipient_uid='wingcash:211',
            recipient_info={'title': "My Account"},
            bundle_transfer_id=bundle_transfer_id,
        )
        dbsession.add(r)
        dbsession.flush()

        m = db.Movement(
            owner_id='102',
            transfer_record_id=r.id,
            number=2,
            amount_index=0,
            peer_id='c',
            orig_peer_id='211',
            loop_id='0',
            currency='USD',
            issuer_id='19',
            from_id='19',
            to_id='211',
            amount=Decimal(amount),
            action='deposit',
            ts=datetime.datetime(2018, 1, 15, 6, 0, 1),
            wallet_delta=0,
            vault_delta=Decimal(amount),
            period_id=self.period.id,
            surplus_delta=0,
        )
        dbsession.add(m)
        dbsession.flush()

        return r, m

    def add_transfer_6510(
            self,
            amount='10.00',
            bundle_transfer_id=None,
            transfer_id='6510',
            ):
        from opnreco.models import db
        dbsession = self.dbsession

        r = db.TransferRecord(
            owner_id='102',
            transfer_id=transfer_id,
            workflow_type='redeem',
            start=datetime.datetime(2018, 1, 15, 6, 0, 0),
            currency='USD',
            amount=Decimal(amount),
            timestamp=datetime.datetime(2018, 1, 15, 6, 0, 1),
            next_activity='completed',
            completed=True,
            canceled=False,
            sender_id='11',
            sender_uid='wingcash:11',
            sender_info={'title': "Testy User"},
            recipient_id='211',
            recipient_uid='wingcash:211',
            recipient_info={'title': "My Account"},
            bundle_transfer_id=bundle_transfer_id,
        )
        dbsession.add(r)
        dbsession.flush()

        m = db.Movement(
            owner_id='102',
            transfer_record_id=r.id,
            number=2,
            amount_index=0,
            peer_id='c',
            orig_peer_id='211',
            loop_id='0',
            currency='USD',
            issuer_id='19',
            from_id='19',
            to_id='211',
            amount=Decimal(amount),
            action='deposit',
            ts=datetime.datetime(2018, 1, 15, 6, 0, 1),
            wallet_delta=0,
            vault_delta=Decimal(amount),
            period_id=self.period.id,
            surplus_delta=0,
        )
        dbsession.add(m)
        dbsession.flush()

        return r, m

    def add_transfer_6512(
            self,
            amount='12.00',
            transfer_id='6512',
            bundled_transfer_ids=('6502', '6510'),
            bundled_amounts=('2.00', '10.00'),
            ):
        from opnreco.models import db
        dbsession = self.dbsession

        r = db.TransferRecord(
            owner_id='102',
            transfer_id=transfer_id,
            workflow_type='ach_file_bundle',  # Not a real workflow_type
            start=datetime.datetime(2018, 1, 15, 6, 0, 0),
            currency='USD',
            amount=Decimal(amount),
            timestamp=datetime.datetime(2018, 1, 15, 6, 0, 1),
            next_activity='completed',
            completed=True,
            canceled=False,
            sender_id='11',
            sender_uid='wingcash:11',
            sender_info={'title': "Testy User"},
            recipient_id='11',
            recipient_uid='wingcash:11',
            recipient_info={'title': "Testy User"},
            bundle_transfer_id=None,
            bundled_transfers=[
                {
                    'transfer_id': bundled_transfer_ids[0],
                    'currency': 'USD',
                    'loop_id': '0',
                    'issuer_id': '19',
                    'amount': bundled_amounts[0],
                },
                {
                    'transfer_id': bundled_transfer_ids[1],
                    'currency': 'USD',
                    'loop_id': '0',
                    'issuer_id': '19',
                    'amount': bundled_amounts[1],
                },
            ],
        )
        dbsession.add(r)
        dbsession.flush()

        return r

    def add_statement(
            self,
            e1value='-2.00',
            e1date=datetime.date(2018, 1, 16),
            e2value='-10.00',
            e2date=datetime.date(2018, 1, 16),
            ):
        from opnreco.models import db
        dbsession = self.dbsession

        self.statement = s = db.Statement(
            owner_id='102',
            peer_id='c',
            period_id=self.period.id,
            loop_id='0',
            currency='USD',
            source='TestSource',
        )
        dbsession.add(s)
        dbsession.flush()

        e = db.AccountEntry(
            owner_id='102',
            peer_id='c',
            period_id=self.period.id,
            statement_id=s.id,
            entry_date=e1date,
            loop_id='0',
            currency='USD',
            delta=Decimal(e1value),
            description='ACH T6502',
        )
        dbsession.add(e)

        e = db.AccountEntry(
            owner_id='102',
            peer_id='c',
            period_id=self.period.id,
            statement_id=s.id,
            entry_date=e2date,
            loop_id='0',
            currency='USD',
            delta=Decimal(e2value),
            description='ACH T6510',
        )
        dbsession.add(e)

        dbsession.flush()

    def assert_recos(
            self,
            expect_recos=None,
            expect_movements=0,
            expect_account_entries=0):
        """Verify all the recos balance.

        Optionally count the recos, movements, and account entries.
        """
        from opnreco.models import db
        dbsession = self.dbsession

        recos = dbsession.query(db.Reco).all()
        if expect_recos is not None:
            self.assertEqual(expect_recos, len(recos))

        rows = dbsession.query(db.Movement).all()
        if expect_movements is not None:
            self.assertEqual(expect_movements, len(rows))

        movements = collections.defaultdict(list)
        for m in rows:
            movements[m.reco_id].append(m)

        rows = dbsession.query(db.AccountEntry).all()
        if expect_account_entries is not None:
            self.assertEqual(expect_account_entries, len(rows))

        account_entries = collections.defaultdict(list)
        for e in rows:
            account_entries[e.reco_id].append(e)

        for reco in recos:
            m_total = sum((
                m.vault_delta + m.wallet_delta
                for m in movements[reco.id]), 0)
            e_total = sum((e.delta for e in account_entries[reco.id]), 0)
            self.assertEqual(0, m_total + e_total)

    def test_full_match(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502()
        self.add_transfer_6510()
        self.add_statement()
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=2,
            expect_movements=2,
            expect_account_entries=2)

    def test_one_match(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502()
        self.add_statement()
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=1,
            expect_movements=1,
            expect_account_entries=2)

    def test_no_match(self):
        self.add_peer()
        self.add_period()
        self.add_statement()
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=0,
            expect_movements=0,
            expect_account_entries=2)

    def test_value_mismatch(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502()
        self.add_transfer_6510()
        self.add_statement(e2value='-9.00')  # 9 instead of 10
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=1,
            expect_movements=2,
            expect_account_entries=2)

    def test_sign_mismatch(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502()
        self.add_transfer_6510()
        self.add_statement(e2value='10.00')  # money added rather than removed
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=1,
            expect_movements=2,
            expect_account_entries=2)

    def test_same_amount_on_statement_resolved_by_transfer_id_to_6502(self):
        self.add_peer()
        self.add_period()
        r2, m2 = self.add_transfer_6502()
        r10, m10 = self.add_transfer_6510()
        self.add_statement(e2value='-2.00')  # same as e1value
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=1,
            expect_movements=2,
            expect_account_entries=2)
        self.assertIsNotNone(m2.reco_id)
        self.assertIsNone(m10.reco_id)

    def test_same_amount_on_statement_resolved_by_transfer_id_to_6510(self):
        self.add_peer()
        self.add_period()
        r2, m2 = self.add_transfer_6502()
        r10, m10 = self.add_transfer_6510()
        self.add_statement(e1value='-10.00')  # same as e2value
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=1,
            expect_movements=2,
            expect_account_entries=2)
        self.assertIsNone(m2.reco_id)
        self.assertIsNotNone(m10.reco_id)

    def test_same_amount_in_movements_resolved_by_transfer_id_to_6502(self):
        self.add_peer()
        self.add_period()
        r2, m2 = self.add_transfer_6502(amount='2.00')
        r10, m10 = self.add_transfer_6510(amount='2.00')
        self.add_statement()
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=1,
            expect_movements=2,
            expect_account_entries=2)
        self.assertIsNotNone(m2.reco_id)
        self.assertIsNone(m10.reco_id)

    def test_match_entry_on_same_day(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502()
        self.add_statement(e1date=datetime.date(2018, 1, 15))
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=1,
            expect_movements=1,
            expect_account_entries=2)

    def test_dont_match_entry_before_movement(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502()
        self.add_statement(e1date=datetime.date(2018, 1, 1))
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=0,
            expect_movements=1,
            expect_account_entries=2)

    def test_dont_match_entry_months_after_movement(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502()
        self.add_statement(e1date=datetime.date(2018, 3, 1))
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=0,
            expect_movements=1,
            expect_account_entries=2)

    def test_match_complete_bundle(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502(amount='-2.00', bundle_transfer_id='6512')
        self.add_transfer_6510(amount='-10.00', bundle_transfer_id='6512')
        self.add_transfer_6512()
        self.add_statement(e1value='12.00', e2value='3.14')
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=1,
            expect_movements=2,
            expect_account_entries=2)

        # Assert that both movements are part of the same reco.
        from opnreco.models import db
        dbsession = self.dbsession

        rows = dbsession.query(db.Movement).all()
        reco_ids = set(row.reco_id for row in rows)
        self.assertEqual(1, len(reco_ids))

    def test_no_match_incomplete_bundle(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502(amount='-2.00', bundle_transfer_id='6512')
        self.add_transfer_6512()
        self.add_statement(e1value='12.00', e2value='3.14')
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=0,
            expect_movements=1,
            expect_account_entries=2)

    def test_no_match_without_bundle(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502(amount='-2.00', bundle_transfer_id='6512')
        self.add_transfer_6510(amount='-10.00', bundle_transfer_id='6512')
        self.add_statement(e1value='12.00', e2value='3.14')
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=0,
            expect_movements=2,
            expect_account_entries=2)

    def test_no_match_incorrect_bundle(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502(amount='-2.00', bundle_transfer_id='6512')
        self.add_transfer_6510(amount='-10.01', bundle_transfer_id='6512')
        self.add_transfer_6512()
        self.add_statement(e1value='12.00', e2value='3.14')
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=0,
            expect_movements=2,
            expect_account_entries=2)

    def test_match_bundle_and_single_at_once(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502(amount='-2.00', bundle_transfer_id='6512')
        self.add_transfer_6510(amount='-10.00', bundle_transfer_id='6512')
        self.add_transfer_6512()
        self.add_transfer_6502(transfer_id='7502', amount='3.14')
        self.add_statement(e1value='12.00', e2value='-3.14')
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=2,
            expect_movements=3,
            expect_account_entries=2)

    def test_match_transfers_in_7500_range(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502(
            amount='-2.50', transfer_id='7502', bundle_transfer_id='7512')
        self.add_transfer_6510(
            amount='-10.50', transfer_id='7510', bundle_transfer_id='7512')
        self.add_transfer_6512(
            transfer_id='7512',
            bundled_transfer_ids=['7502', '7510'],
            bundled_amounts=['2.50', '10.50'])
        self.add_statement(e1value='1.00', e2value='13.00')
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=1,
            expect_movements=2,
            expect_account_entries=2)

    def test_match_two_bundles_at_once(self):
        self.add_peer()
        self.add_period()
        self.add_transfer_6502(amount='-2.00', bundle_transfer_id='6512')
        self.add_transfer_6510(amount='-10.00', bundle_transfer_id='6512')
        self.add_transfer_6512()
        self.add_transfer_6502(
            amount='-2.50', transfer_id='7502', bundle_transfer_id='7512')
        self.add_transfer_6510(
            amount='-10.50', transfer_id='7510', bundle_transfer_id='7512')
        self.add_transfer_6512(
            transfer_id='7512',
            bundled_transfer_ids=['7510', '7502'],
            bundled_amounts=['10.50', '2.50'])
        self.add_statement(e1value='12.00', e2value='13.00')
        self._call(
            dbsession=self.dbsession,
            owner=self.owner,
            period=self.period,
            statement=self.statement,
        )
        self.assert_recos(
            expect_recos=2,
            expect_movements=4,
            expect_account_entries=2)
