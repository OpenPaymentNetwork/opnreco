import json
import os

import zope.sqlalchemy

# import or define all models here to ensure they are attached to the
# Base.metadata prior to any initialization routines
from opnreco.models.db import all_metadata_defined as __all  # noqa
from opnreco.render import get_json_default
from sqlalchemy import engine_from_config
from sqlalchemy.orm import configure_mappers, sessionmaker

# run configure_mappers after defining all of the models to ensure
# all relationships can be setup
configure_mappers()


def json_dumps_extra(value):
    return json.dumps(
        value,
        separators=(",", ":"),
        indent="",
        sort_keys=True,
        default=get_json_default,
    )


def get_engine(prefix="sqlalchemy_"):
    return engine_from_config(os.environ, prefix, json_serializer=json_dumps_extra)


def get_dbsession_factory(engine):
    factory = sessionmaker()
    factory.configure(bind=engine)
    return factory


def get_tm_dbsession(dbsession_factory, transaction_manager):
    """
    Get a ``sqlalchemy.orm.Session`` instance backed by a transaction.

    This function will hook the session to the transaction manager which
    will take care of committing any changes.

    - When using pyramid_tm it will automatically be committed or aborted
      depending on whether an exception is raised.

    - When using scripts you should wrap the session in a manager yourself.
      For example::

          import transaction

          engine = get_engine(settings)
          session_factory = get_session_factory(engine)
          with transaction.manager:
              dbsession = get_tm_session(session_factory, transaction.manager)
    """
    dbsession = dbsession_factory()
    zope.sqlalchemy.register(dbsession, transaction_manager=transaction_manager)
    return dbsession


def includeme(config):
    """
    Initialize the model for a Pyramid app.

    Activate this setup using ``config.include('testalchemy.models')``.

    """
    # use pyramid_tm to hook the transaction lifecycle to the request
    config.include("pyramid_tm")

    dbsession_factory = get_dbsession_factory(get_engine())
    config.registry["dbsession_factory"] = dbsession_factory

    def dbsession(request):
        return get_tm_dbsession(dbsession_factory, request.tm)

    # make request.dbsession available for use in Pyramid
    config.add_request_method(
        # request.tm is the transaction manager provided by pyramid_tm.
        dbsession,
        "dbsession",
        reify=True,
    )
