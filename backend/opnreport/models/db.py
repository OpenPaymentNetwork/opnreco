
from sqlalchemy.orm import backref
from sqlalchemy import BigInteger
from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import Date
from sqlalchemy import DateTime
from sqlalchemy import Numeric
from sqlalchemy import ForeignKey
from sqlalchemy import func
from sqlalchemy import Integer
from sqlalchemy import Index
from sqlalchemy import String
from sqlalchemy import Unicode
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

now_func = func.timezone('UTC', func.current_timestamp())


class Profile(Base):
    """Info about a profile that has used this tool."""
    __tablename__ = 'profile'
    # id is an OPN profile ID.
    id = Column(String, nullable=False, primary_key=True)
    title = Column(Unicode, nullable=False)
    # last_update is when the profile title was last updated
    last_update = Column(DateTime, nullable=True, server_default=now_func)
    # first_sync_ts is set when a sync has started but not
    # finished.  It contains the first_sync_ts from the first batch.
    first_sync_ts = Column(DateTime, nullable=True)
    last_sync_ts = Column(DateTime, nullable=True)
    last_sync_transfer_id = Column(String, nullable=True)


class ProfileEvent(Base):
    """Log of an event related to a profile"""
    __tablename__ = 'profile_event'
    id = Column(BigInteger, nullable=False, primary_key=True)
    ts = Column(DateTime, nullable=False, index=True, server_default=now_func)
    profile_id = Column(
        String, ForeignKey('profile.id'), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    remote_addr = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    memo = Column(JSONB, nullable=False)


class OPNDownload(Base):
    """A record of OPN data downloaded for a profile.
    """
    __tablename__ = 'opn_download'
    id = Column(BigInteger, nullable=False, primary_key=True)
    profile_id = Column(
        String, ForeignKey('profile.id'), index=True, nullable=False)
    ts = Column(DateTime, nullable=False, server_default=now_func)
    content = Column(JSONB, nullable=False)


class TransferRecord(Base):
    """A profile's transfer record.

    Each profile has a different filtered view of the list of movements
    for a transfer, so this app only keeps profile-specific transfer records,
    not cross-profile transfer records.

    Note: transfers have other fields that aren't reflected here because they
    aren't important for this app.
    """
    __tablename__ = 'transfer_record'
    id = Column(BigInteger, nullable=False, primary_key=True)
    transfer_id = Column(String, nullable=False)
    profile_id = Column(String, ForeignKey('profile.id'), nullable=False)

    workflow_type = Column(String, nullable=False)    # Never changes
    start = Column(DateTime, nullable=False)          # Never changes
    timestamp = Column(DateTime, nullable=False)      # May change
    next_activity = Column(String, nullable=False)    # May change
    completed = Column(Boolean, nullable=False)       # May change
    canceled = Column(Boolean, nullable=False)        # May change

    sender_id = Column(String, nullable=True)         # May change
    sender_uid = Column(Unicode, nullable=True)       # May change
    sender_title = Column(Unicode, nullable=True)     # May change

    recipient_id = Column(String, nullable=True)      # May change
    recipient_uid = Column(Unicode, nullable=True)    # May change
    recipient_title = Column(Unicode, nullable=True)  # May change

    profile = backref(Profile)


Index(
    'ix_transfer_record_unique',
    TransferRecord.transfer_id,
    TransferRecord.profile_id,
    unique=True)


class TransferDownloadRecord(Base):
    """A record of which downloads provided TransferRecord data."""
    __tablename__ = 'transfer_download_record'
    opn_download_id = Column(
        BigInteger, ForeignKey('opn_download.id'),
        nullable=False, primary_key=True)
    transfer_record_id = Column(
        BigInteger, ForeignKey('transfer_record.id'),
        nullable=False, primary_key=True)
    transfer_id = Column(String, nullable=False)
    changed = Column(JSONB, nullable=False)

    opn_download = backref(OPNDownload)
    transfer_record = backref(TransferRecord)


class Mirror(Base):
    """A mirror money location that a profile can reconcile with.

    Represents an account at a DFI, someone else's wallet, or the
    amount put into circulation by an issuer.
    """
    __tablename__ = 'mirror'
    id = Column(BigInteger, nullable=False, primary_key=True)
    profile_id = Column(String, ForeignKey('profile.id'), nullable=False)
    # opn_holder_id is either a holder ID or the letter 'c' for circulating.
    opn_holder_id = Column(String, nullable=False)
    title = Column(Unicode, nullable=True)

    profile = backref(Profile)


Index(
    'ix_mirror_unique',
    Mirror.profile_id,
    Mirror.opn_holder_id,
    unique=True)


class Movement(Base):
    """A movement in a transfer applied to the profile.

    Note: once created, movement rows never change.
    """
    __tablename__ = 'movement'
    id = Column(BigInteger, nullable=False, primary_key=True)
    transfer_record_id = Column(
        BigInteger, ForeignKey('transfer_record.id'),
        nullable=False, index=True)
    mirror_id = Column(
        BigInteger, ForeignKey('mirror.id'),
        nullable=False, index=True)

    loop_id = Column(String, nullable=False)
    currency = Column(String(3), nullable=False)
    action = Column(String, nullable=False)
    ts = Column(DateTime, nullable=False)  # UTC

    # The delta is positive for movements into the wallet or vault
    # or negative for movements out of the wallet or vault.
    delta = Column(Numeric, nullable=False)

    transfer_record = backref(TransferRecord)
    mirror = backref(Mirror)


class MovementEvent(Base):
    """Historical record of changes to a movement"""
    __tablename__ = 'movement_event'
    id = Column(BigInteger, nullable=False, primary_key=True)
    movement_id = Column(
        BigInteger, ForeignKey('movement.id'),
        nullable=False, index=True)
    ts = Column(DateTime, nullable=True)
    profile_id = Column(String, nullable=False)
    comment = Column(Unicode, nullable=True)
    reco_entry_id = Column(BigInteger, nullable=True)

    movement = backref(Movement)


class MirrorBalance(Base):
    """A record of a mirror's balance at the start of a day."""
    __tablename__ = 'mirror_balance'
    mirror_id = Column(
        BigInteger, ForeignKey('mirror.id'),
        nullable=False, primary_key=True)
    loop_id = Column(String, nullable=False, primary_key=True)
    currency = Column(String(3), nullable=False, primary_key=True)
    day = Column(Date, nullable=False, primary_key=True)
    balance = Column(Numeric, nullable=False)

    profile = backref(Profile)


class MirrorStatement(Base):
    """A statement of movements to/from a mirror."""
    __tablename__ = 'mirror_statement'
    id = Column(BigInteger, nullable=False, primary_key=True)
    mirror_id = Column(
        BigInteger, ForeignKey('mirror.id'),
        nullable=False, index=True)
    ts = Column(DateTime, nullable=False, server_default=now_func)
    content = Column(JSONB, nullable=False)

    profile = backref(Profile)


class MirrorEntry(Base):
    """An entry in a mirror account statement."""
    __tablename__ = 'mirror_entry'
    id = Column(BigInteger, nullable=False, primary_key=True)
    mirror_id = Column(
        BigInteger, ForeignKey('mirror.id'),
        nullable=False, index=True)

    statement_id = Column(
        BigInteger, ForeignKey('mirror_statement.id'),
        nullable=True, index=True)
    statement_ref = Column(JSONB, nullable=True)
    entry_date = Column(Date, nullable=False)
    loop_id = Column(String, nullable=False)
    currency = Column(String(3), nullable=False)

    # The delta is negative for account decreases.
    # Note: we use the terms increase and decrease instead of debit/credit
    # because debit/credit is ambiguous: an increase of a checking account is
    # both a *credit* to the account holder's asset account and a *debit* to
    # the bank's liability account.
    delta = Column(Numeric, nullable=False)

    # desc contains descriptive info provided by the bank.
    desc = Column(JSONB, nullable=False)

    profile = backref(Profile)
    statement = backref(MirrorStatement)


class MirrorEntryEvent(Base):
    """Historical record of changes to a mirror entry"""
    __tablename__ = 'mirror_entry_event'
    id = Column(BigInteger, nullable=False, primary_key=True)
    mirror_entry_id = Column(
        BigInteger, ForeignKey('mirror_entry.id'),
        nullable=False, index=True)
    ts = Column(DateTime, nullable=True)
    profile_id = Column(String, nullable=False)

    comment = Column(Unicode, nullable=True)
    reco_entry_id = Column(BigInteger, nullable=True)

    # Attributes of MirrorEntry that may change:
    statement_id = Column(BigInteger, nullable=True)
    statement_ref = Column(JSONB, nullable=True)
    entry_date = Column(Date, nullable=True)
    loop_id = Column(String, nullable=True)
    currency = Column(String(3), nullable=True)
    delta = Column(Numeric, nullable=True)
    desc = Column(JSONB, nullable=True)

    mirror_entry = backref(MirrorEntry)


class RecoEntry(Base):
    """A reconciliation entry matches a movement with a mirror entry.

    The linked movements and mirror entries must have matching
    currency and loop_id values. The total deltas must be equal if the
    movements are sent from or received into the
    wallet; the total deltas must be negatives of each other if the
    movements are sent from or received into the vault.

    A RecoEntry may be marked as reconciled externally, in which case the
    movement summary or mirror entry may be permanently missing.
    """
    __tablename__ = 'reco_entry'
    id = Column(BigInteger, nullable=False, primary_key=True)
    mirror_id = Column(
        BigInteger, ForeignKey('mirror.id'),
        nullable=False, index=True)
    # entry_date is copied from a mirror statement.
    entry_date = Column(Date, nullable=False)

    # Note: hidden reconciliations are generated for internal OPN note
    # movements such as swaps, splits, divisions, and unifications.
    hidden = Column(Boolean, nullable=False)

    profile = backref(Profile)
    mirror = backref(Mirror)


class MovementReco(Base):
    """Association of a movement to a RecoEntry.

    A movement can be connected to only one RecoEntry, but a RecoEntry
    can be connected to multiple movements.
    """
    __tablename__ = 'movement_reco'
    movement_id = Column(
        BigInteger, ForeignKey('movement.id'),
        nullable=False, primary_key=True)
    reco_entry_id = Column(
        BigInteger, ForeignKey('reco_entry.id'), nullable=True, index=True)

    movement = backref(Movement)
    reco_entry = backref(RecoEntry)


class MirrorEntryReco(Base):
    """Association of a MirrorEntry to a RecoEntry.

    A MirrorEntry can be connected to only one RecoEntry, but a RecoEntry
    can be connected to multiple MirrorEntry rows.
    """
    __tablename__ = 'mirror_entry_reco'
    mirror_entry_id = Column(
        BigInteger, ForeignKey('mirror_entry.id'),
        nullable=False, primary_key=True)
    reco_entry_id = Column(
        BigInteger, ForeignKey('reco_entry.id'), nullable=True, index=True)

    mirror_entry = backref(MirrorEntry)
    reco_entry = backref(RecoEntry)


# all_metadata_defined must be at the end of the file. It signals that
# all model classes have been defined successfully.
all_metadata_defined = True
