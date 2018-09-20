
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


class ProfileLog(Base):
    """Log of an event related to a profile"""
    __tablename__ = 'profile_log'
    id = Column(BigInteger, nullable=False, primary_key=True)
    ts = Column(DateTime, nullable=False, server_default=now_func)
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


class File(Base):
    """A permanent record of transfer records and mirror entries.

    Once a file is created and populated, this tool never changes the file
    contents.
    """
    __tablename__ = 'file'
    id = Column(BigInteger, nullable=False, primary_key=True)
    profile_id = Column(
        String, ForeignKey('profile.id'), nullable=False, index=True)
    mirror_id = Column(
        BigInteger, ForeignKey('mirror.id'), nullable=False, index=True)
    end_date = Column(Date, nullable=False)
    end_balance = Column(Numeric, nullable=False)
    subtitle = Column(Unicode, nullable=True)


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
    profile_id = Column(String, ForeignKey('profile.id'), nullable=False)
    file_id = Column(BigInteger, ForeignKey('file.id'), nullable=True)
    transfer_id = Column(String, nullable=False)

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
    TransferRecord.profile_id,
    TransferRecord.file_id,
    TransferRecord.transfer_id,
    unique=True)


class TransferDownloadRecord(Base):
    """A record of which download(s) provided TransferRecord data."""
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
    """A time-boxed record of movements that should mirror OPN transfers.

    Represents a period of time at an account at a DFI, someone else's wallet,
    or the circulating omnibus account managed by an issuer.

    The time period is defined by the file_id. When file_id is not set,
    the time period is not yet defined.

    A different mirror exists for each existent combination of
    holding profile, target_id (or 'c' for circulation),
    loop_id, currency, and file_id.
    """
    __tablename__ = 'mirror'
    id = Column(BigInteger, nullable=False, primary_key=True)
    profile_id = Column(String, ForeignKey('profile.id'), nullable=False)
    # target_id is either an OPN holder ID or
    # the letter 'c' for circulating.
    target_id = Column(String, nullable=False)
    loop_id = Column(String, nullable=False)
    currency = Column(String(3), nullable=False)
    file_id = Column(BigInteger, ForeignKey('file.id'), nullable=True)
    start_date = Column(Date, nullable=True)
    start_balance = Column(Numeric, nullable=False, default=0)
    # target_title is based on target_id only and does not refer
    # to the loop_id and currency.
    target_title = Column(Unicode, nullable=True)
    target_is_dfi_account = Column(Boolean, nullable=False, default=False)
    loop_title = Column(Unicode, nullable=True)
    # last_update is when the target_title and loop_title were last updated.
    last_update = Column(DateTime, nullable=True)

    profile = backref(Profile)

    def getstate(self):
        start_date = self.start_date
        last_update = self.last_update
        return {
            'id': str(self.id),
            'profile_id': self.profile_id,
            'target_id': self.target_id,
            'loop_id': self.loop_id,
            'currency': self.currency,
            'file_id': str(self.file_id),
            'start_date': (
                None if start_date is None
                else start_date.isoformat() + 'Z'),
            'start_balance': str(self.start_balance),
            'target_title': self.target_title,
            'target_is_dfi_account': self.target_is_dfi_account,
            'loop_title': self.loop_title,
            'last_update': (
                None if last_update is None
                else last_update.isoformat() + 'Z'),
        }


Index(
    'ix_mirror_unique',
    Mirror.profile_id,
    Mirror.target_id,
    Mirror.loop_id,
    Mirror.currency,
    Mirror.file_id,
    unique=True)


class Movement(Base):
    """A movement in a transfer applied to the profile.

    Note: movement rows are designed to be immutable.
    """
    __tablename__ = 'movement'
    id = Column(BigInteger, nullable=False, primary_key=True)
    transfer_record_id = Column(
        BigInteger, ForeignKey('transfer_record.id'), nullable=False)
    number = Column(Integer, nullable=False)

    mirror_id = Column(
        BigInteger, ForeignKey('mirror.id'),
        nullable=False, index=True)

    action = Column(String, nullable=False)
    ts = Column(DateTime, nullable=False)

    # The delta is positive for movements into the wallet or vault
    # or negative for movements out of the wallet or vault.
    delta = Column(Numeric, nullable=False)

    transfer_record = backref(TransferRecord)
    mirror = backref(Mirror)


Index(
    'ix_movement_unique',
    Movement.transfer_record_id,
    Movement.number,
    Movement.mirror_id,
    unique=True)


class MovementLog(Base):
    """Log of changes to a movement"""
    __tablename__ = 'movement_log'
    id = Column(BigInteger, nullable=False, primary_key=True)
    ts = Column(DateTime, nullable=False, server_default=now_func)
    movement_id = Column(
        BigInteger, ForeignKey('movement.id'),
        nullable=False, index=True)
    event_type = Column(String, nullable=False)
    comment = Column(Unicode, nullable=True)

    # changes is a dict. The possible changes are:
    # reco_id
    changes = Column(JSONB, nullable=False)

    movement = backref(Movement)


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


class MirrorEntryLog(Base):
    """Log of changes to a mirror entry"""
    __tablename__ = 'mirror_entry_log'
    id = Column(BigInteger, nullable=False, primary_key=True)
    ts = Column(DateTime, nullable=False, server_default=now_func)
    mirror_entry_id = Column(
        BigInteger, ForeignKey('mirror_entry.id'),
        nullable=False, index=True)
    event_type = Column(String, nullable=False)
    comment = Column(Unicode, nullable=True)

    # changes is a dict. The possible changes are:
    # reco_id, statement_id, statement_ref, entry_date, delta, and desc.
    changes = Column(JSONB, nullable=False)

    mirror_entry = backref(MirrorEntry)


class Reco(Base):
    """A reconciliation row matches movement(s) with mirror entry(ies).

    The linked movements and mirror entries must be connected to the same
    mirror. The total deltas must be equal if the
    movements are sent from or received into the
    wallet; the total deltas must be negatives of each other if the
    movements are sent from or received into the vault.
    """
    __tablename__ = 'reco'
    id = Column(BigInteger, nullable=False, primary_key=True)
    mirror_id = Column(
        BigInteger, ForeignKey('mirror.id'),
        nullable=False, index=True)
    # entry_date is copied from a mirror statement or movement.
    entry_date = Column(Date, nullable=False)
    # auto is true if the reconciliation was generated automatically.
    auto = Column(Boolean, nullable=False)

    mirror = backref(Mirror)


class MovementReco(Base):
    """Association of a movement to a Reco.

    A movement can be connected to only one Reco, but a Reco
    can be connected to multiple movements.
    """
    __tablename__ = 'movement_reco'
    movement_id = Column(
        BigInteger, ForeignKey('movement.id'),
        nullable=False, primary_key=True)
    reco_id = Column(
        BigInteger, ForeignKey('reco.id'), nullable=False, index=True)

    movement = backref(Movement)
    reco = backref(Reco)


class MirrorEntryReco(Base):
    """Association of a MirrorEntry to a Reco.

    A MirrorEntry can be connected to only one Reco, but a Reco
    can be connected to multiple MirrorEntry rows.
    """
    __tablename__ = 'mirror_entry_reco'
    mirror_entry_id = Column(
        BigInteger, ForeignKey('mirror_entry.id'),
        nullable=False, primary_key=True)
    reco_id = Column(
        BigInteger, ForeignKey('reco.id'), nullable=False, index=True)

    mirror_entry = backref(MirrorEntry)
    reco = backref(Reco)


# all_metadata_defined must be at the end of the file. It signals that
# all model classes have been defined successfully.
all_metadata_defined = True
