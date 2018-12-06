
from pyramid.decorator import reify
from sqlalchemy.engine import create_engine
from sqlalchemy.orm.session import Session


class DBSessionFixture:
    """Provide a short lived connection to Postgres for testing.

    The database should be empty (no tables or other objects). The schema
    will be created inside a transaction that never commits.

    Create an instance of this class in setup_module().

    Test modules using this class should contain the following code:

        def setup_module():
            global dbsession_fixture
            dbsession_fixture = DBSessionFixture()


        def teardown_module():
            dbsession_fixture.close()


        class TestX(unittest.TestCase):

            def setUp(self):
                self.dbsession, self.close_session = (
                    dbsession_fixture.begin_session())

            def tearDown(self):
                self.close_session()

    This pattern lets test methods share the temporary database schema
    to reduce the number of times the schema needs to be created.
    """

    @reify
    def engine(self):
        from opnreco.models.dbmeta import json_dumps_extra

        return create_engine(
            'postgresql:///opnrecotest',
            json_serializer=json_dumps_extra)

    @reify
    def connection(self):
        from opnreco.models.db import Base

        connection = self.engine.connect()
        self.transaction = connection.begin()
        Base.metadata.create_all(connection)
        return connection

    def close(self):
        """Abort the transaction and drop the connection.

        Call this in teardown_module().
        """
        self_vars = vars(self)
        connection = self_vars.get('connection')
        if connection is not None:
            self.transaction.rollback()
            connection.close()
            del self.connection
            del self.transaction
        engine = self_vars.get('engine')
        if engine is not None:
            engine.dispose()
            del self.engine

    def begin_session(self):
        """Start a session. Return (dbsession, close_session).

        """
        connection = self.connection
        txn = connection.begin_nested()
        dbsession = Session(connection)

        def close_session():
            dbsession.close()
            txn.rollback()

        return dbsession, close_session
