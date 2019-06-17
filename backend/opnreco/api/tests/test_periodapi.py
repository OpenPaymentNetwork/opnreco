
from decimal import Decimal
from opnreco.testing import DBSessionFixture
import datetime
import pyramid.testing
import unittest

zero = Decimal()


def setup_module():
    global dbsession_fixture
    dbsession_fixture = DBSessionFixture()


def teardown_module():
    dbsession_fixture.close()


class Test_detect_date_overlap(unittest.TestCase):

    def setUp(self):
        self.config = pyramid.testing.setUp()
        self.dbsession, self.close_session = dbsession_fixture.begin_session()

    def tearDown(self):
        self.close_session()
        pyramid.testing.tearDown()

    def _call(self, *args, **kw):
        from ..periodapi import detect_date_overlap
        return detect_date_overlap(*args, **kw)

    def register_peer(self):
        from opnreco.models import db
        dbsession = self.dbsession

        owner = db.Owner(
            id='102',
            title="Testy Owner",
            username='testowner',
        )
        dbsession.add(owner)
        dbsession.flush()

        file = db.File(
            id=1239,
            owner_id=owner.id,
            title='Test File',
            currency='USD',
            loop_id='0',
            peer_id=None)
        dbsession.add(file)
        dbsession.flush()

        peer = db.Peer(
            owner_id='102',
            peer_id='c',
            title="Testy Owner",
            username='testowner',
        )
        dbsession.add(peer)

    def register_periods(self):
        from opnreco.models import db
        dbsession = self.dbsession

        self.register_peer()

        self.p2014 = p2014 = db.Period(
            owner_id='102',
            file_id=1239,
            start_date=None,
            end_date=datetime.date(2014, 12, 31),
        )
        dbsession.add(p2014)

        self.p2016 = p2016 = db.Period(
            owner_id='102',
            file_id=1239,
            start_date=datetime.date(2016, 1, 1),
            end_date=datetime.date(2016, 12, 31),
        )
        dbsession.add(p2016)

        self.p2018 = p2018 = db.Period(
            owner_id='102',
            file_id=1239,
            start_date=datetime.date(2018, 1, 1),
            end_date=None,
        )
        dbsession.add(p2018)

        dbsession.flush()

    def test_no_conflict_without_periods(self):
        from opnreco.models import db

        self.register_peer()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=datetime.date(2014, 1, 1),
            new_end_date=datetime.date(2018, 12, 31))

        self.assertIsNone(conflict_row)

    def test_no_conflict_in_2015(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=datetime.date(2015, 1, 1),
            new_end_date=datetime.date(2015, 12, 31))

        self.assertIsNone(conflict_row)

    def test_no_conflict_in_2017(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=datetime.date(2017, 1, 1),
            new_end_date=datetime.date(2017, 12, 31))

        self.assertIsNone(conflict_row)

    def test_conflict_in_2014_and_2015(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=datetime.date(2014, 12, 1),
            new_end_date=datetime.date(2015, 12, 31))

        self.assertIsNotNone(conflict_row)

    def test_conflict_with_2015_through_2017(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=datetime.date(2015, 7, 1),
            new_end_date=datetime.date(2017, 7, 1))

        self.assertIsNotNone(conflict_row)

    def test_conflict_with_large_period(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=datetime.date(2000, 12, 1),
            new_end_date=datetime.date(2020, 12, 31))

        self.assertIsNotNone(conflict_row)

    def test_conflict_with_infinite(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=None,
            new_end_date=None)

        self.assertIsNotNone(conflict_row)

    def test_conflict_with_start_infinite(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=None,
            new_end_date=datetime.date(2020, 12, 31))

        self.assertIsNotNone(conflict_row)

    def test_conflict_with_end_infinite(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=datetime.date(2000, 1, 1),
            new_end_date=None)

        self.assertIsNotNone(conflict_row)

    def test_conflict_with_period_in_2016(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=datetime.date(2016, 7, 1),
            new_end_date=datetime.date(2016, 7, 1))

        self.assertIsNotNone(conflict_row)

    def test_conflict_with_period_in_2000(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=datetime.date(2000, 7, 1),
            new_end_date=datetime.date(2000, 7, 1))

        self.assertIsNotNone(conflict_row)

    def test_conflict_with_period_in_2020(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=datetime.date(2020, 7, 1),
            new_end_date=datetime.date(2020, 7, 1))

        self.assertIsNotNone(conflict_row)

    def test_conflict_with_new_period_for_2015_and_earlier(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=None,
            new_end_date=datetime.date(2015, 1, 1))

        self.assertIsNotNone(conflict_row)

    def test_conflict_with_new_period_for_2013_and_earlier(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=None,
            new_end_date=datetime.date(2013, 1, 1))

        self.assertIsNotNone(conflict_row)

    def test_no_conflict_when_expanding_2014(self):
        self.register_periods()

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=self.p2014,
            new_start_date=None,
            new_end_date=datetime.date(2015, 12, 21))

        self.assertIsNone(conflict_row)

    def test_conflict_with_new_period_for_2017_and_later(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=datetime.date(2017, 1, 1),
            new_end_date=None)

        self.assertIsNotNone(conflict_row)

    def test_conflict_with_new_period_for_2020_and_later(self):
        from opnreco.models import db

        self.register_periods()

        period = db.Period(
            owner_id='102',
            file_id=1239,
        )

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=period,
            new_start_date=datetime.date(2020, 1, 1),
            new_end_date=None)

        self.assertIsNotNone(conflict_row)

    def test_no_conflict_when_expanding_2018(self):
        self.register_periods()

        conflict_row = self._call(
            dbsession=self.dbsession,
            period=self.p2018,
            new_start_date=datetime.date(2017, 1, 1),
            new_end_date=None)

        self.assertIsNone(conflict_row)
