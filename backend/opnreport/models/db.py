
from sqlalchemy.orm import backref
from sqlalchemy import BigInteger
from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import Date
from sqlalchemy import DateTime
from sqlalchemy import Numeric
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


class Movement(Base):
    """The transfer side of a Reco."""
    __tablename__ = 'movement'
    id = Column(BigInteger, nullable=False, primary_key=True)
    transfer_id = Column(
        String, ForeignKey('transfer.id'), nullable=False, index=True)
    movement_index = Column(Integer, nullable=False)
    issuer_id = Column(String, nullable=False)
    loop_id = Column(String, nullable=False)
    currency = Column(String(3), nullable=False)
    amount = Column(Numeric, nullable=False)
    from_id = Column(String, nullable=False)
    to_id = Column(String, nullable=False)
    # Reconciliation is expected if the money was moved to/from the issuer.
    reco_expected = Column(Boolean, nullable=False)
    reco_id = Column(BigInteger, ForeignKey('reco.id'), nullable=True)

    transfer = backref(Transfer)


class DFIEntry(Base):
    """The DFI side of a Reco."""
    __tablename__ = 'dfi_entry'
    id = Column(BigInteger, nullable=False, primary_key=True)
    entry_date = Column(Date, nullable=False, index=True)
    issuer_id = Column(String, nullable=False)
    loop_id = Column(String, nullable=False)
    currency = Column(String(3), nullable=False)
    amount = Column(Numeric, nullable=False)
    increase = Column(Boolean, nullable=False)  # else it's a decrease
    # desc contains descriptive info provided by the bank.
    desc = Column(JSONB, nullable=False)
    reco_id = Column(BigInteger, ForeignKey('reco.id'), nullable=True)


class Reco(Base):
    """Reconciliation entry"""
    __tablename__ = 'reco'
    id = Column(BigInteger, nullable=False, primary_key=True)
    issuer_id = Column(String, nullable=False, index=True)
    movement_id = Column(
        BigInteger, ForeignKey('movement.id'), nullable=True, index=True)
    dfi_entry_id = Column(
        BigInteger, ForeignKey('dfi_entry.id'), nullable=True, index=True)
    ts = Column(DateTime, nullable=False)
    by = Column(String, nullable=False)

    movement = backref(Movement)
    dfi_entry = backref(DFIEntry)


class RecoLog(Base):
    """Log of reconciliation activity"""
    __tablename__ = 'reco_log'
    id = Column(BigInteger, nullable=False, primary_key=True)
    ts = Column(DateTime, nullable=False)  # Timestamp
    issuer_id = Column(String, nullable=True)
    transfer_id = Column(String, nullable=True)
    movement_id = Column(BigInteger, nullable=True)
    dfi_entry_id = Column(BigInteger, nullable=True)
    reco_id = Column(BigInteger, nullable=True)
    content = Column(JSONB, nullable=False)


# all_metadata_defined must be at the end of the file. It signals that
# all model classes have been defined successfully.
all_metadata_defined = True
