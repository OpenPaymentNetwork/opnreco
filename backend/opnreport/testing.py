
from pyramid.decorator import reify
from sqlalchemy.engine import create_engine
from sqlalchemy.orm.session import Session


class DBSessionFixture:

    @reify
    def engine(self):
        return create_engine('postgresql:///opnreporttest')

    @reify
    def connection(self):
        from opnreport.models.db import Base

        connection = self.engine.connect()
        self.transaction = connection.begin()
        Base.metadata.create_all(connection)
        return connection

    def close(self):
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
        connection = self.connection
        txn = connection.begin_nested()
        dbsession = Session(connection)

        def close_session():
            dbsession.close()
            txn.rollback()

        return dbsession, close_session
