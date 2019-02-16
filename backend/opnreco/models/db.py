
from sqlalchemy import and_
from sqlalchemy import BigInteger
from sqlalchemy import Boolean
from sqlalchemy import CheckConstraint
from sqlalchemy import Column
from sqlalchemy import Date
from sqlalchemy import DateTime
from sqlalchemy import DDL
from sqlalchemy import event
from sqlalchemy import ForeignKey
from sqlalchemy import ForeignKeyConstraint
from sqlalchemy import func
from sqlalchemy import Index
from sqlalchemy import Integer
from sqlalchemy import LargeBinary
from sqlalchemy import Numeric
from sqlalchemy import or_
from sqlalchemy import String
from sqlalchemy import Unicode
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import deferred
from sqlalchemy.orm import relationship
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
null = None


class Owner(Base):
    """Info about an OPN profile that has used this tool."""
    __tablename__ = 'owner'
    # id is an OPN profile ID.
    id = Column(String, nullable=False, primary_key=True)
    title = Column(Unicode, nullable=False)
    username = Column(String, nullable=False)
    tzname = Column(String, nullable=True)
    # last_update is when the title and username were last updated.
    last_update = Column(DateTime, nullable=True, server_default=now_func)
    # first_sync_ts is set when a sync has started but not
    # finished.  It contains the first_sync_ts from the first batch.
    first_sync_ts = Column(DateTime, nullable=True)
    last_sync_ts = Column(DateTime, nullable=True)
    last_sync_transfer_id = Column(String, nullable=True)
    # sync_total is the number of transfer records in this sync operation.
    sync_total = Column(BigInteger, nullable=False, default=0)
    # sync_done is the number of transfer records downloaded
    # successfully in this sync operation.
    sync_done = Column(BigInteger, nullable=False, default=0)
    # If show_non_circ_with_circ is true, the owner can select
    # both non-circulation and circulation peers.
    show_non_circ_with_circ = Column(Boolean, nullable=False, default=False)


class OwnerLog(Base):
    """Log of an event related to an owner.

    Logging is done by the application rather than triggers because
    we often want only one log entry for a change to several tables.
    """
    __tablename__ = 'owner_log'
    id = Column(BigInteger, nullable=False, primary_key=True)
    ts = Column(DateTime, nullable=False, server_default=now_func)
    owner_id = Column(
        String, ForeignKey('owner.id'), nullable=False, index=True)
    # personal_id is the OPN personal profile ID. May be equal to owner_id.
    personal_id = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    remote_addr = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    content = Column(JSONB, nullable=False)


class Peer(Base):
    """Info about a peer.

    A peer is an OPN wallet, account, or the circulating omnibus account
    managed by an issuer.
    """
    __tablename__ = 'peer'
    owner_id = Column(
        String, ForeignKey('owner.id'), nullable=False, primary_key=True)
    peer_id = Column(String, nullable=False, primary_key=True)

    title = Column(Unicode, nullable=True)
    username = Column(String, nullable=True)
    is_dfi_account = Column(Boolean, nullable=False, default=False)
    # is_own_dfi_account is true for DFI accounts linked to the owner.
    is_own_dfi_account = Column(Boolean, nullable=False, default=False)

    # Note: don't try to update if removed.
    removed = Column(Boolean, nullable=False, default=False)
    last_update = Column(DateTime, nullable=True)


class Loop(Base):
    """Info about a cash design loop."""
    __tablename__ = 'loop'
    owner_id = Column(
        String, ForeignKey('owner.id'), nullable=False, primary_key=True)
    loop_id = Column(String, nullable=False, primary_key=True)

    title = Column(Unicode, nullable=True)

    # Note: don't try to update if removed.
    removed = Column(Boolean, nullable=False, default=False)
    last_update = Column(DateTime, nullable=True)


class Period(Base):
    """A time-boxed record of movements in OPN transfers.

    Holds the reconciliations created for a peer loop during the specified
    time period.
    """
    __tablename__ = 'period'
    id = Column(BigInteger, nullable=False, primary_key=True)
    owner_id = Column(String, ForeignKey('owner.id'), nullable=False)
    # peer_id is either an OPN holder ID or
    # the letter 'c' for circulating.
    peer_id = Column(String, nullable=False)
    loop_id = Column(String, nullable=False)
    currency = Column(String, nullable=False)

    # has_vault becomes true if money ever moves in or out of the
    # vault connected with this period. (has_vault is an attr of Period rather
    # than Peer because an issuer might hold notes of multiple
    # currencies / loops, but issue only one currency / loop.)
    # The value of has_vault spreads to other periods of the same peer.
    has_vault = Column(Boolean, nullable=False, default=False)

    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    start_circ = Column(Numeric, nullable=False, default=0)
    end_circ = Column(Numeric, nullable=True)

    start_surplus = Column(Numeric, nullable=False, default=0)
    end_surplus = Column(Numeric, nullable=True)

    closed = Column(Boolean, nullable=False, default=False)

    owner = relationship(Owner)

    __table_args__ = (
        CheckConstraint(or_(
            ~closed,
            and_(
                # The dates and end values must be assigned when the
                # period is closed.
                closed,
                start_date != null,
                end_date != null,
                end_circ != null,
                end_surplus != null,
            ),
        ), name='closed_requires_values'),
        {})


Index(
    'ix_period_single_unbounded_start_date',
    Period.owner_id,
    Period.peer_id,
    Period.loop_id,
    Period.currency,
    postgresql_where=(Period.start_date == null),
    unique=True)


Index(
    'ix_period_single_unbounded_end_date',
    Period.owner_id,
    Period.peer_id,
    Period.loop_id,
    Period.currency,
    postgresql_where=(Period.end_date == null),
    unique=True)


Index(
    # This index is needed for foreign keys.
    'ix_period_peer_fk_lookup',
    Period.id,
    Period.peer_id,
    Period.loop_id,
    Period.currency,
    unique=True)


class TransferRecord(Base):
    """An owner's transfer record.

    Each owner has a different filtered view of the list of movements
    for a transfer, so this app only keeps owner-specific transfer records.

    Note: transfers have other fields that aren't reflected here because they
    aren't important for this app.
    """
    __tablename__ = 'transfer_record'
    id = Column(BigInteger, nullable=False, primary_key=True)
    owner_id = Column(String, ForeignKey('owner.id'), nullable=False)
    transfer_id = Column(String, nullable=False)

    workflow_type = Column(String, nullable=False)    # Never changes
    start = Column(DateTime, nullable=False)          # Never changes
    currency = Column(String, nullable=False)         # May change
    amount = Column(Numeric, nullable=False)          # May change
    timestamp = Column(DateTime, nullable=False)      # May change
    next_activity = Column(String, nullable=False)    # May change
    completed = Column(Boolean, nullable=False)       # May change
    canceled = Column(Boolean, nullable=False)        # May change

    sender_id = Column(String, nullable=True)         # May change
    sender_uid = Column(Unicode, nullable=True)       # May change
    sender_info = Column(JSONB, nullable=True)        # May change

    recipient_id = Column(String, nullable=True)      # May change
    recipient_uid = Column(Unicode, nullable=True)    # May change
    recipient_info = Column(JSONB, nullable=True)     # May change

    # Some transfers (particularly receive_ach_file transfers) are
    # essentially bundles of other transfers. bundled_transfers is the list
    # of transfers that this transfer bundles.
    # bundled_transfers: null or
    # [{transfer_id, currency, loop_id, issuer_id, amount}]
    bundled_transfers = Column(JSONB, nullable=True)    # May change

    # bundle_transfer_id specifies which bundle this transfer belongs
    # to, if any.
    bundle_transfer_id = Column(String, nullable=True)  # May change

    owner = relationship(Owner)


Index(
    'ix_transfer_record_unique',
    TransferRecord.owner_id,
    TransferRecord.transfer_id,
    unique=True)


class OPNDownload(Base):
    """A record of OPN data downloaded for an owner.

    This may be used to verify the correctness of the movement table.
    """
    __tablename__ = 'opn_download'
    id = Column(BigInteger, nullable=False, primary_key=True)
    owner_id = Column(
        String, ForeignKey('owner.id'), index=True, nullable=False)
    ts = Column(DateTime, nullable=False, server_default=now_func)
    content = Column(JSONB, nullable=False)


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

    opn_download = relationship(OPNDownload)
    transfer_record = relationship(TransferRecord)


class Movement(Base):
    """A movement in a transfer record.

    Note: two rows are created for every movement, one for the actual peer,
    and one for the 'c' peer ('c' means 'circulation' or 'common'). This
    doubling reflects the fact that the user may need to run a separate
    reconciliation for the circulation account and the peer account.

    The UI should do what it can to show only one of the two reconciliations;
    for example, if the peer has no vault, the circulation reconciliation
    should not be shown; as another example, if the peer is a wallet rather
    than a DFI account, the peer reconciliation should not be shown.

    Note: most fields of Movement are immutable. Only period_id,
    reco_id, and circ_reco_id are mutable.
    """
    __tablename__ = 'movement'
    id = Column(BigInteger, nullable=False, primary_key=True)
    owner_id = Column(
        String, ForeignKey('owner.id'), nullable=False, index=True)
    transfer_record_id = Column(
        BigInteger, ForeignKey('transfer_record.id'), nullable=False)
    number = Column(Integer, nullable=False)

    # An OPN movement can move multiple amounts, but this database needs to
    # represent each moved amount as a single movement, so this database
    # stores multiple movement rows for each OPN movement and disambiguates
    # them first using loop_id, currency, and issuer_id, and finally by
    # incrementing amount_index.
    amount_index = Column(Integer, nullable=False)

    # peer_id is either an OPN profile ID or 'c' (for 'common' or
    # 'circulation'). The 'c' row is the doubled row.
    peer_id = Column(String, nullable=False)
    # orig_peer_id is an OPN profile ID, never 'c'.
    orig_peer_id = Column(
        String, CheckConstraint(
            "orig_peer_id != 'c'", name='orig_peer_id_not_c'),
        nullable=False)
    loop_id = Column(String, nullable=False)
    currency = Column(String, nullable=False)
    issuer_id = Column(String, nullable=False)

    from_id = Column(String, nullable=True)  # Null for issuance
    to_id = Column(String, nullable=False)
    amount = Column(Numeric, nullable=False)
    action = Column(String, nullable=False)
    ts = Column(DateTime, nullable=False)

    # The delta is positive for movements into the wallet or vault
    # or negative for movements out of the wallet or vault.
    # All movements with a nonzero wallet delta or vault delta are
    # reconcilable.
    wallet_delta = Column(Numeric, nullable=False)
    vault_delta = Column(Numeric, nullable=False)

    ################
    # Mutable fields
    ################

    period_id = Column(BigInteger, nullable=False, index=True)
    reco_id = Column(
        BigInteger, ForeignKey('reco.id'), nullable=True, index=True)

    # surplus_delta is usually the negative of wallet_delta except when
    # the movement is part of a wallet_only or vault_only reco.
    # For wallet_only, surplus_delta is zero, meaning the movement
    # had no effect on the account.
    # For vault_only, surplus_delta is equal to vault_delta,
    # meaning either money was circulated without adding to the account
    # (leading to a deficit, or decrease in surplus), or
    # month was removed from circulation without removing it from the account
    # (leading to an increase in surplus, or a reduction of the deficit).
    surplus_delta = Column(Numeric, nullable=False)

    __table_args__ = (
        ForeignKeyConstraint(
            # This FK ensures the peer_id, loop_id, and currency
            # match the period.
            ['period_id', 'peer_id', 'loop_id', 'currency'],
            ['period.id', 'period.peer_id', 'period.loop_id',
             'period.currency'],
            name='match_period',
        ),
        ForeignKeyConstraint(
            # This FK ensures the period_id matches the reco.
            ['reco_id', 'period_id'],
            ['reco.id', 'reco.period_id'],
            name='match_reco',
            deferrable=True,
            initially='deferred',
        ),
        CheckConstraint(or_(
            surplus_delta == -wallet_delta,
            # surplus_delta can be forced to zero or vault_delta
            # only when the movement belongs to a reco.
            and_(surplus_delta == 0, reco_id != null),
            and_(surplus_delta == vault_delta, reco_id != null),
        ), name='surplus_delta_value'),
        {})

    transfer_record = relationship(TransferRecord)


Index(
    'ix_movement_unique',
    Movement.transfer_record_id,
    Movement.number,
    Movement.amount_index,
    Movement.peer_id,
    Movement.orig_peer_id,
    Movement.loop_id,
    Movement.currency,
    Movement.issuer_id,
    unique=True)


class MovementLog(Base):
    """Log of changes to a movement.

    Logging is done by a trigger because we want exhaustive logs for
    movement changes.
    """
    __tablename__ = 'movement_log'
    id = Column(BigInteger, nullable=False, primary_key=True)
    ts = Column(DateTime, nullable=False, server_default=now_func)
    movement_id = Column(
        BigInteger, ForeignKey('movement.id'),
        nullable=False, index=True)
    # personal_id is the OPN personal profile ID.
    personal_id = Column(String, nullable=False)
    event_type = Column(String, nullable=False)

    # Mutable fields of movement rows
    period_id = Column(BigInteger, nullable=False, index=True)
    reco_id = Column(BigInteger, nullable=True, index=True)
    surplus_delta = Column(Numeric, nullable=False)

    movement = relationship(Movement)


# See: https://stackoverflow.com/questions/1295795 (trigger format)
# Also: https://stackoverflow.com/questions/7888846/trigger-in-sqlachemy
movement_log_ddl = DDL("""
create or replace function movement_log_process() returns trigger
as $triggerbody$
begin
    if (TG_OP = 'DELETE') then
        insert into movement_log (
            movement_id,
            personal_id,
            event_type,
            period_id,
            reco_id,
            surplus_delta)
        select
            old.id,
            current_setting('opnreco.personal_id'),
            current_setting('opnreco.movement.event_type'),
            old.period_id,
            old.reco_id,
            old.surplus_delta;
        return old;
    elsif (TG_OP = 'UPDATE' or TG_OP = 'INSERT') then
        insert into movement_log (
            movement_id,
            personal_id,
            event_type,
            period_id,
            reco_id,
            surplus_delta)
        select
            new.id,
            current_setting('opnreco.personal_id'),
            current_setting('opnreco.movement.event_type'),
            new.period_id,
            new.reco_id,
            new.surplus_delta;
        return new;
    end if;
    return null;
end;
$triggerbody$ language plpgsql;

create trigger movement_log_trigger
after insert or update or delete on movement
    for each row execute procedure movement_log_process();
""")
event.listen(Movement.__table__, 'after_create', movement_log_ddl)


class Statement(Base):
    """A statement of movements to/from an account connected with a Period."""
    __tablename__ = 'statement'
    id = Column(BigInteger, nullable=False, primary_key=True)
    owner_id = Column(
        String, ForeignKey('owner.id'), nullable=False, index=True)
    # peer_id is either an OPN holder ID or
    # the letter 'c' for circulating.
    peer_id = Column(String, nullable=False)
    period_id = Column(
        BigInteger, ForeignKey('period.id'),
        nullable=False, index=True)
    loop_id = Column(String, nullable=False)
    currency = Column(String, nullable=False)
    source = Column(Unicode, nullable=True)  # 'manual' or some external ID

    # upload_ts, filename, content_type, and content are set on upload.
    upload_ts = Column(DateTime, nullable=True)
    filename = Column(Unicode, nullable=True)
    content_type = Column(String, nullable=True)
    content = deferred(Column(LargeBinary, nullable=True))

    __table_args__ = (
        ForeignKeyConstraint(
            # This FK ensures the peer_id, loop_id, and currency
            # match the period.
            ['period_id', 'peer_id', 'loop_id', 'currency'],
            ['period.id', 'period.peer_id', 'period.loop_id',
             'period.currency'],
            name='match_period',
        ),
        {})


class AccountEntry(Base):
    """An entry in an account statement."""
    __tablename__ = 'account_entry'
    id = Column(BigInteger, nullable=False, primary_key=True)
    owner_id = Column(
        String, ForeignKey('owner.id'), nullable=False, index=True)
    peer_id = Column(String, nullable=False)
    period_id = Column(BigInteger, nullable=False, index=True)
    statement_id = Column(
        BigInteger, ForeignKey('statement.id'),
        nullable=False, index=True)
    sheet = Column(String, nullable=True)
    row = Column(Integer, nullable=True)

    entry_date = Column(Date, nullable=False)
    loop_id = Column(String, nullable=False)
    currency = Column(String, nullable=False)

    # The delta is positive for account increases and negative for decreases.
    # Note: we use the terms increase and decrease instead of debit/credit
    # because debit/credit is ambiguous: an increase of a checking account is
    # both a *credit* to the account holder's asset account and a *debit* to
    # the bank's liability account. To make things even more interesting,
    # the account holder is often the bank itself. Meanwhile, the terms
    # increase and decrease have well-understood meanings.
    delta = Column(Numeric, nullable=False)

    # description contains descriptive info provided by the bank.
    description = Column(Unicode, nullable=False)

    reco_id = Column(
        BigInteger, ForeignKey('reco.id'), nullable=True, index=True)

    period = relationship(Period)

    __table_args__ = (
        ForeignKeyConstraint(
            # This FK ensures the peer_id, loop_id, and currency
            # match the period.
            ['period_id', 'peer_id', 'loop_id', 'currency'],
            ['period.id', 'period.peer_id', 'period.loop_id',
             'period.currency'],
            name='match_period',
        ),
        ForeignKeyConstraint(
            # This FK ensures the period_id matches the reco.
            ['reco_id', 'period_id'],
            ['reco.id', 'reco.period_id'],
            name='match_reco',
            deferrable=True,
            initially='deferred',
        ),
        {})


class AccountEntryLog(Base):
    """Log of changes to an account entry.

    Logging is done by a trigger because we want exhaustive logs for
    account entry changes.
    """
    __tablename__ = 'account_entry_log'
    id = Column(BigInteger, nullable=False, primary_key=True)
    ts = Column(DateTime, nullable=False, server_default=now_func)
    # Note that there should not be a FK from this table to
    # account_entry because account_entry rows can be deleted
    # while account_entry_log rows stay for historical purposes.
    account_entry_id = Column(
        BigInteger, nullable=False, index=True)
    # personal_id is the OPN personal profile ID.
    personal_id = Column(String, nullable=False)
    event_type = Column(String, nullable=False)

    # Mutable fields of AccountEntry

    period_id = Column(BigInteger, nullable=False, index=True)
    statement_id = Column(BigInteger, nullable=True, index=True)
    sheet = Column(String, nullable=True)
    row = Column(Integer, nullable=True)
    entry_date = Column(Date, nullable=False)
    delta = Column(Numeric, nullable=False)
    description = Column(String, nullable=False)
    reco_id = Column(BigInteger, nullable=True, index=True)


account_entry_log_ddl = DDL("""
create or replace function account_entry_log_process() returns trigger
as $triggerbody$
begin
    if (TG_OP = 'DELETE') then
        insert into account_entry_log (
            account_entry_id,
            personal_id,
            event_type,
            period_id,
            statement_id,
            sheet,
            row,
            entry_date,
            delta,
            description,
            reco_id
        )
        select
            old.id,
            current_setting('opnreco.personal_id'),
            current_setting('opnreco.account_entry.event_type'),
            old.period_id,
            old.statement_id,
            old.sheet,
            old.row,
            old.entry_date,
            old.delta,
            old.description,
            old.reco_id;
        return old;
    elsif (TG_OP = 'UPDATE' or TG_OP = 'INSERT') then
        insert into account_entry_log (
            account_entry_id,
            personal_id,
            event_type,
            period_id,
            statement_id,
            sheet,
            row,
            entry_date,
            delta,
            description,
            reco_id
        )
        select
            new.id,
            current_setting('opnreco.personal_id'),
            current_setting('opnreco.account_entry.event_type'),
            new.period_id,
            new.statement_id,
            new.sheet,
            new.row,
            new.entry_date,
            new.delta,
            new.description,
            new.reco_id;
        return new;
    end if;
    return null;
end;
$triggerbody$ language plpgsql;

create trigger account_entry_log_trigger
after insert or update or delete on account_entry
    for each row execute procedure account_entry_log_process();
""")
event.listen(AccountEntry.__table__, 'after_create', account_entry_log_ddl)


class Reco(Base):
    """A reco/reconciliation matches movement(s) and/or account entries."""
    __tablename__ = 'reco'
    id = Column(BigInteger, nullable=False, primary_key=True)
    owner_id = Column(
        String, ForeignKey('owner.id'), nullable=False, index=True)
    period_id = Column(
        BigInteger, ForeignKey('period.id'),
        nullable=False, index=True)
    reco_type = Column(String, nullable=False)
    comment = Column(Unicode, nullable=True)

    # internal is true if the reconciliation is standard, balanced, and
    # has no account entries. Internal recos are not shown in the
    # Reconciliation and Transactions reports, but they are shown
    # in transfers.
    internal = Column(Boolean, nullable=False)

    __table_args__ = (
        CheckConstraint(reco_type.in_([
            # Note: standard recos must be balanced;
            # *_only recos do not need to be.
            # wallet_only recos can only contain wallet movements (not
            # account entries or vault movements).
            # account_only recos can only contain account movements.
            # vault_only recos can only contain vault movements.
            'standard',
            'wallet_only',       # Wallet In/Out
            'account_only',      # Account Credit/Debit
            'vault_only',        # Vault Offset
        ]), name='reco_type'),
        {})


Index(
    # This index is needed for foreign keys.
    'ix_reco_fk_lookup',
    Reco.id,
    Reco.period_id,
    unique=True)


class VerificationResult(Base):
    """A short lived record of a transfer integrity verification operation.

    The operation spans multiple rows.
    """
    __tablename__ = 'verification_result'
    id = Column(BigInteger, nullable=False, primary_key=True)
    created = Column(DateTime, nullable=False, server_default=now_func)
    owner_id = Column(String, nullable=False)
    verification_id = Column(String, nullable=False, index=True)
    initial = Column(Boolean, nullable=False)

    # first_sync_ts, last_sync_ts, last_sync_transfer_id, sync_done,
    # sync_total, and internal_result are set only for the initial batch of a
    # verify operation.
    first_sync_ts = Column(DateTime, nullable=True)
    last_sync_ts = Column(DateTime, nullable=True)
    last_sync_transfer_id = Column(String, nullable=True)
    sync_total = Column(BigInteger, nullable=True)
    sync_done = Column(BigInteger, nullable=True)
    internal_result = Column(JSONB, nullable=True)

    # verified: {transfer_id: null or change_log as [{event_type, ...}]}
    verified = Column(JSONB, nullable=False)
    expires = Column(DateTime, nullable=False, index=True)


# all_metadata_defined must be at the end of this module. It signals that
# the full database schema has been defined successfully.
all_metadata_defined = True
