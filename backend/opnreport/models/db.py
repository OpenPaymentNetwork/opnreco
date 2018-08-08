
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
    last_update = Column(DateTime, nullable=True, server_default=now_func)
    last_download = Column(DateTime, nullable=True)


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
    activity_ts = Column(DateTime, nullable=False)    # May change
    completed = Column(Boolean, nullable=False)       # May change
    canceled = Column(Boolean, nullable=False)        # May change

    sender_id = Column(String, nullable=True)         # May change
    sender_uid = Column(Unicode, nullable=True)       # May change
    sender_title = Column(Unicode, nullable=True)     # May change

    recipient_id = Column(String, nullable=True)      # May change
    recipient_uid = Column(Unicode, nullable=True)    # May change
    recipient_title = Column(Unicode, nullable=True)  # May change

    movement_lists = Column(JSONB, nullable=False)    # Append-only

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
    movement_list_index = Column(Integer, nullable=False)
    changed = Column(JSONB, nullable=False)

    opn_download = backref(OPNDownload)
    transfer_record = backref(TransferRecord)


class MovementSummary(Base):
    """The summary of some movements in a transfer applied to the profile.

    A MovementSummary is the unit of reconciliation on the OPN side.
    """
    __tablename__ = 'movement_summary'
    id = Column(BigInteger, nullable=False, primary_key=True)
    transfer_record_id = Column(
        BigInteger, ForeignKey('transfer_record.id'), nullable=False)

    profile_id = Column(
        String, ForeignKey('profile.id'), nullable=False, index=True)
    account_id = Column(String, nullable=False)

    # movement_list_index specifies which movement list in the TransferRecord
    # this summary is based on. If more movements happen later, we'll add
    # another MovementSummary that offsets the previous MovementSummary.
    movement_list_index = Column(Integer, nullable=False)

    loop_id = Column(String, nullable=False)
    currency = Column(String(3), nullable=False)

    # The delta is positive for movements into the wallet or vault
    # or negative for movements out of the wallet or vault.
    delta = Column(Numeric, nullable=False)

    # A MovementSummary must be assigned to zero or one RecoEntry.
    reco_entry_id = Column(
        BigInteger, ForeignKey('reco_entry.id'), nullable=True)

    transfer_record = backref(TransferRecord)


Index(
    'ix_movement_summary_by_transfer',
    MovementSummary.transfer_record_id,
    MovementSummary.movement_list_index,
    unique=True)


class Account(Base):
    """An account that a profile can reconcile with.

    Represents an account at a DFI, someone else's wallet, or the
    amount put into circulation by an issuer.
    """
    __tablename__ = 'account'
    profile_id = Column(
        String, ForeignKey('profile.id'), nullable=False, primary_key=True)
    # account_id is either a holder ID or the letter 'c' for circulating.
    account_id = Column(String, nullable=False, primary_key=True)
    title = Column(Unicode, nullable=True)

    profile = backref(Profile)


class AccountBalance(Base):
    """A record of an account's balance at the start of a day."""
    __tablename__ = 'account_balance'
    profile_id = Column(
        String, ForeignKey('profile.id'), nullable=False, primary_key=True)
    account_id = Column(String, nullable=False, primary_key=True)
    loop_id = Column(String, nullable=False, primary_key=True)
    currency = Column(String(3), nullable=False, primary_key=True)
    day = Column(Date, nullable=False, primary_key=True)
    balance = Column(Numeric, nullable=False)

    profile = backref(Profile)


class AccountStatement(Base):
    """A statement of movement to/from an account."""
    __tablename__ = 'account_statement'
    id = Column(BigInteger, nullable=False, primary_key=True)
    profile_id = Column(
        String, ForeignKey('profile.id'), nullable=False, index=True)
    account_id = Column(String, nullable=False)
    ts = Column(DateTime, nullable=False, server_default=now_func)
    content = Column(JSONB, nullable=False)

    profile = backref(Profile)


class AccountEntry(Base):
    """The account side of a RecoEntry."""
    __tablename__ = 'account_entry'
    id = Column(BigInteger, nullable=False, primary_key=True)
    profile_id = Column(
        String, ForeignKey('profile.id'), nullable=False, index=True)
    account_id = Column(String, nullable=False)
    statement_id = Column(
        BigInteger, ForeignKey('account_statement.id'),
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

    # An AccountEntry must be assigned to zero or one RecoEntry.
    reco_entry_id = Column(
        BigInteger, ForeignKey('reco_entry.id'), nullable=True)

    # desc contains descriptive info provided by the bank.
    desc = Column(JSONB, nullable=False)

    profile = backref(Profile)
    statement = backref(AccountStatement)


class RecoEntry(Base):
    """A reconciliation entry matches a movement summary with an account entry.

    The linked movement summary and linked account entry must have matching
    currency and loop_id values. The deltas must match if the account entry
    is for the wallet (because the money is sent from or received into the
    wallet); the deltas must be negatives of each other if the
    account entry is for the vault (because the money is sent from or received
    into someone else's wallet.)

    A RecoEntry may be marked as reconciled externally, in which case the
    movement summary or account entry may be permanently missing.
    """
    __tablename__ = 'reco_entry'
    id = Column(BigInteger, nullable=False, primary_key=True)
    profile_id = Column(
        String, ForeignKey('profile.id'), nullable=False, index=True)
    account_id = Column(String, nullable=False)
    movement_summary_id = Column(
        BigInteger, ForeignKey('movement_summary.id'),
        nullable=True, index=True)
    account_entry_id = Column(
        BigInteger, ForeignKey('account_entry.id'), nullable=True, index=True)
    comment = Column(Unicode, nullable=True)
    reco_ts = Column(DateTime, nullable=True)
    reco_by = Column(String, nullable=True)

    profile = backref(Profile)
    movement_summary = backref(MovementSummary)
    account_entry = backref(AccountEntry)


class RecoEntryEvent(Base):
    """Log of an event related to a RecoEntry"""
    __tablename__ = 'reco_entry_event'
    id = Column(BigInteger, nullable=False, primary_key=True)
    ts = Column(DateTime, nullable=False, index=True, server_default=now_func)
    reco_entry_id = Column(
        BigInteger, ForeignKey('reco_entry.id'), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    memo = Column(JSONB, nullable=False)

    reco_entry = backref(RecoEntry)


# all_metadata_defined must be at the end of the file. It signals that
# all model classes have been defined successfully.
all_metadata_defined = True
