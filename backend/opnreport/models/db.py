
from sqlalchemy.orm import backref
from sqlalchemy import BigInteger
from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.schema import MetaData


# Recommended naming convention used by Alembic, as various different database
# providers will autogenerate vastly different names making migrations more
# difficult. See: http://alembic.readthedocs.org/en/latest/naming.html
NAMING_CONVENTION = {
    "ix": 'ix_%(column_0_label)s',
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=NAMING_CONVENTION)
Base = declarative_base(metadata=metadata)


class Transfer(Base):
    """A transfer record.

    Note: transfers have other fields that aren't reflected here because they
    aren't important for this app.
    """
    __tablename__ = 'transfer'
    id = Column(String, primary_key=True, nullable=False)
    workflow_type = Column(String, nullable=False)  # Never changes
    start = Column(DateTime, nullable=False)        # Never changes
    end = Column(DateTime, nullable=True)           # Changes once
    completed = Column(Boolean, nullable=False)     # May change
    canceled = Column(Boolean, nullable=False)      # May change

    sender_id = Column(String, nullable=True)       # May change
    sender_uid = Column(String, nullable=True)      # May change
    recipient_id = Column(String, nullable=True)    # May change
    recipient_uid = Column(String, nullable=True)   # May change

    movements = Column(JSONB, nullable=False)       # Append-only


class RecoTransferEntry(Base):
    """The transfer side of a RecoEntry."""
    __tablename__ = 'reco_transfer_entry'
    id = Column(BigInteger, nullable=False, primary_key=True)
    transfer_id = Column(String, nullable=False)
    activity_index = Column(Integer, nullable=False)
    movement_index = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False)


        #     'action': str,
        #     'notegroups': [{
        #         'issuer_id': int,
        #         'currency': str,
        #         'loop_id': int,
        #         'amount': str,
        #         'note_ids': [int],
        #     }],
        #     'from_id': int,
        #     'to_id': int,
        #     'release': bool,
        #     ['timestamp': UTC ISO str,]


class RecoDFIEntry(Base):
    """The DFI side of a RecoEntry."""
    __tablename__ = 'reco_dfi_entry'
    id = Column(BigInteger, nullable=False, primary_key=True)


class RecoEntry(Base):
    """Reconciliation entry"""
    __tablename__ = 'reco_entry'
    entry_id = Column(BigInteger, nullable=False, primary_key=True)
    wingcash_profile_id = Column(String, nullable=False, index=True)
    transfer_entry_id = Column(
        BigInteger, ForeignKey('reco_transfer_entry.id'), nullable=True)
    dfi_entry_id = Column(
        BigInteger, ForeignKey('reco_dfi_entry.id'), nullable=True)

    transfer_entry = backref(RecoTransferEntry, lazy='dynamic')
    dfi_entry = backref(RecoDFIEntry, lazy='dynamic')


# all_metadata_defined must be at the end of the file. It signals that
# all model classes have been defined successfully.
all_metadata_defined = True
