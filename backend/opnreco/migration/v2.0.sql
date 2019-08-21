

-- Add Files.

begin;


-- Temporarily drop the triggers and trigger functions.

DROP TRIGGER account_entry_log_trigger ON public.account_entry;
DROP TRIGGER movement_log_trigger ON public.movement;
DROP FUNCTION account_entry_log_process;
DROP FUNCTION movement_log_process;




-- Add an index to transfer_record.
CREATE INDEX ix_transfer_record_owner_id ON public.transfer_record USING btree (owner_id);




-- Create the file table.

CREATE TABLE public.file (
    id bigint NOT NULL,
    owner_id character varying NOT NULL,
    file_type character varying NOT NULL,
    title character varying NOT NULL,
    currency character varying NOT NULL,
    has_vault boolean NOT NULL,
    peer_id character varying,
    auto_enable_loops boolean NOT NULL,
    archived boolean NOT NULL,
    CONSTRAINT ck_file_file_type_fields CHECK (
        ((((file_type)::text = 'open_circ'::text) AND (peer_id IS NULL) AND has_vault AND (NOT auto_enable_loops)) OR
        (((file_type)::text = 'closed_circ'::text) AND (peer_id IS NULL) AND has_vault) OR
        (((file_type)::text = 'account'::text) AND (peer_id IS NOT NULL) AND (NOT has_vault) AND (NOT auto_enable_loops))))
);

CREATE SEQUENCE public.file_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.file_id_seq OWNED BY public.file.id;

ALTER TABLE ONLY public.file
    ADD CONSTRAINT pk_file PRIMARY KEY (id),
    ALTER COLUMN id SET DEFAULT nextval('public.file_id_seq'::regclass);

CREATE UNIQUE INDEX ix_file_matchable ON public.file USING btree (id, currency);
CREATE INDEX ix_file_owner_id ON public.file USING btree (owner_id);

ALTER TABLE ONLY public.file
    ADD CONSTRAINT fk_file_owner_id_owner FOREIGN KEY (owner_id) REFERENCES public.owner(id);





-- Create the file_loop_config_table, which is for the new closed_circ
-- file type. No rows need to be added to file_loop_config because there
-- are no closed_circ files yet.

CREATE TABLE public.file_loop_config (
    id bigint NOT NULL,
    owner_id character varying NOT NULL,
    file_id bigint NOT NULL,
    loop_id character varying NOT NULL,
    issuer_id character varying NOT NULL,
    enabled boolean NOT NULL
);

CREATE SEQUENCE public.file_loop_config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.file_loop_config_id_seq OWNED BY public.file_loop_config.id;

ALTER TABLE ONLY public.file_loop_config ALTER COLUMN id SET DEFAULT nextval('public.file_loop_config_id_seq'::regclass);

ALTER TABLE ONLY public.file_loop_config
    ADD CONSTRAINT pk_file_loop_config PRIMARY KEY (id);

CREATE INDEX ix_file_loop_config_file_id ON public.file_loop_config USING btree (file_id);
CREATE INDEX ix_file_loop_config_owner_id ON public.file_loop_config USING btree (owner_id);

ALTER TABLE ONLY public.file_loop_config
    ADD CONSTRAINT fk_file_loop_config_file_id_file FOREIGN KEY (file_id) REFERENCES public.file(id);
ALTER TABLE ONLY public.file_loop_config
    ADD CONSTRAINT fk_file_loop_config_owner_id_owner FOREIGN KEY (owner_id) REFERENCES public.owner(id);




-- Auto-generate the open loop circulation files.

insert into file (
    owner_id,
    file_type,
    title,
    currency,
    has_vault,
    peer_id,
    auto_enable_loops,
    archived)
select distinct
        movement.owner_id,
        'open_circ',
        'Open Loop Circulation',
        movement.currency,
        true,
        null,
        false,
        false
    from movement
    where movement.vault_delta != 0
UNION select distinct
        statement.owner_id,
        'open_circ',
        'Open Loop Circulation',
        statement.currency,
        true,
        null,
        false,
        false
    from statement
    where statement.peer_id = 'c';




-- Add a temporary column to the owner table that indicates whether the
-- owner has open_circ files.

alter table owner add column has_open_circ boolean not null default false;
update owner set has_open_circ = true where exists (
    select 1 from file
    where file.owner_id = owner.id and file.file_type = 'open_circ');




-- Auto-generate the account files.

insert into file (
    owner_id,
    file_type,
    title,
    currency,
    has_vault,
    peer_id,
    auto_enable_loops,
    archived)
select distinct
        movement.owner_id,
        'account',
        'Account ' || peer.title,
        movement.currency,
        false,
        movement.peer_id,
        false,
        false
    from movement
        join peer on (
            peer.owner_id = movement.owner_id and
            peer.peer_id = movement.peer_id)
        join owner on (owner.id = movement.owner_id)
    where
        peer.is_own_dfi_account and
        (not owner.has_open_circ or owner.show_non_circ_with_circ)
UNION select distinct
        statement.owner_id,
        'account',
        'Account ' || peer.title,
        statement.currency,
        false,
        statement.peer_id,
        false,
        false
    from statement
        join peer on (
            peer.owner_id = statement.owner_id and
            peer.peer_id = statement.peer_id)
        where statement.peer_id != 'c';





-- Update the constraints on the movement table that need to be set up
-- before the file_movement table can be created.

DROP INDEX ix_movement_unique;
CREATE UNIQUE INDEX ix_movement_unique ON public.movement USING btree
    (transfer_record_id, number, amount_index, loop_id, currency, issuer_id);

CREATE UNIQUE INDEX ix_movement_matchable ON public.movement USING btree
    (id, currency, loop_id, issuer_id, transfer_record_id, ts);





-- Create the file_movement table.

CREATE TABLE public.file_movement (
    file_id bigint NOT NULL,
    movement_id bigint NOT NULL,
    owner_id character varying NOT NULL,
    currency character varying NOT NULL,
    loop_id character varying NOT NULL,
    issuer_id character varying NOT NULL,
    transfer_record_id bigint NOT NULL,
    ts timestamp without time zone NOT NULL,
    peer_id character varying NOT NULL,
    wallet_delta numeric NOT NULL,
    vault_delta numeric NOT NULL,
    period_id bigint NOT NULL,
    reco_id bigint,
    surplus_delta numeric NOT NULL,
    CONSTRAINT ck_file_movement_nonzero CHECK (((wallet_delta <> (0)::numeric) OR (vault_delta <> (0)::numeric))),
    CONSTRAINT ck_file_movement_peer_id_not_c CHECK (((peer_id)::text <> 'c'::text)),
    CONSTRAINT ck_file_movement_surplus_delta_value CHECK (((surplus_delta = (- wallet_delta)) OR ((surplus_delta = (0)::numeric) AND (reco_id IS NOT NULL)) OR ((surplus_delta = vault_delta) AND (reco_id IS NOT NULL))))
);

ALTER TABLE ONLY public.file_movement
    ADD CONSTRAINT pk_file_movement PRIMARY KEY (file_id, movement_id);

CREATE INDEX ix_file_movement_owner_id ON public.file_movement USING btree (owner_id);
CREATE INDEX ix_file_movement_reco_id ON public.file_movement USING btree (reco_id);
CREATE INDEX ix_file_movement_period_id ON public.file_movement USING btree (period_id);

ALTER TABLE ONLY public.file_movement
    ADD CONSTRAINT fk_file_movement_file_id_file FOREIGN KEY (file_id) REFERENCES public.file(id),
    ADD CONSTRAINT fk_file_movement_movement_id_movement FOREIGN KEY (movement_id) REFERENCES public.movement(id),
    ADD CONSTRAINT fk_file_movement_owner_id_owner FOREIGN KEY (owner_id) REFERENCES public.owner(id),
    ADD CONSTRAINT fk_file_movement_reco_id_reco FOREIGN KEY (reco_id) REFERENCES public.reco(id),
    ADD CONSTRAINT match_file FOREIGN KEY (file_id, currency) REFERENCES public.file(id, currency),
    ADD CONSTRAINT match_movement FOREIGN KEY (movement_id, currency, loop_id, issuer_id, transfer_record_id, ts)
        REFERENCES public.movement(id, currency, loop_id, issuer_id, transfer_record_id, ts),
    ADD CONSTRAINT match_reco FOREIGN KEY (reco_id, period_id)
        REFERENCES public.reco(id, period_id) DEFERRABLE INITIALLY DEFERRED;






-- For each existent open_circ file, copy movements to the file_movement table.

insert into file_movement (
    file_id,
    movement_id,
    owner_id,
    currency,
    loop_id,
    issuer_id,
    transfer_record_id,
    ts,
    peer_id,
    wallet_delta,
    vault_delta,
    period_id,
    reco_id,
    surplus_delta)
select
    file.id,
    movement.id,
    movement.owner_id,
    movement.currency,
    movement.loop_id,
    movement.issuer_id,
    movement.transfer_record_id,
    movement.ts,
    movement.orig_peer_id,
    movement.wallet_delta,
    movement.vault_delta,
    movement.period_id,
    movement.reco_id,
    movement.surplus_delta
from movement
    join file on (
        file.owner_id = movement.owner_id and
        file.file_type = 'open_circ' and
        file.currency = movement.currency)
where
    (movement.wallet_delta != 0 or movement.vault_delta != 0) and
    movement.peer_id = 'c';






-- For each existent account file, copy movements to the file_movement table.

insert into file_movement (
    file_id,
    movement_id,
    owner_id,
    currency,
    loop_id,
    issuer_id,
    transfer_record_id,
    ts,
    peer_id,
    wallet_delta,
    vault_delta,
    period_id,
    reco_id,
    surplus_delta)
select
    file.id,
    movement.id,
    movement.owner_id,
    movement.currency,
    movement.loop_id,
    movement.issuer_id,
    movement.transfer_record_id,
    movement.ts,
    movement.orig_peer_id,
    movement.wallet_delta,
    movement.vault_delta,
    movement.period_id,
    movement.reco_id,
    movement.surplus_delta
from movement
    join file on (
        file.owner_id = movement.owner_id and
        file.file_type = 'account' and
        file.currency = movement.currency and
        file.peer_id = movement.peer_id)
where
    (movement.wallet_delta != 0 or movement.vault_delta != 0) and
    movement.peer_id != 'c';






-- Drop columns no longer needed in the movement table.
-- They were copied to file_movement.

ALTER TABLE ONLY public.movement
    DROP CONSTRAINT fk_movement_reco_id_reco,
    DROP CONSTRAINT match_period,
    DROP CONSTRAINT match_reco;

DROP INDEX ix_movement_period_id;
DROP INDEX ix_movement_reco_id;

alter table only public.movement
    drop CONSTRAINT ck_movement_orig_peer_id_not_c,
    drop CONSTRAINT ck_movement_surplus_delta_value,
    drop column peer_id,
    drop column orig_peer_id,
    drop column wallet_delta,
    drop column vault_delta,
    drop column period_id,
    drop column reco_id,
    drop column surplus_delta;






-- Create the file_sync table.
-- file_sync entries will be created as users run sync.

CREATE TABLE public.file_sync (
    file_id bigint NOT NULL,
    transfer_record_id bigint NOT NULL
);

ALTER TABLE ONLY public.file_sync
    ADD CONSTRAINT pk_file_sync PRIMARY KEY (file_id, transfer_record_id);

ALTER TABLE ONLY public.file_sync
    ADD CONSTRAINT fk_file_sync_file_id_file FOREIGN KEY (file_id) REFERENCES public.file(id);

ALTER TABLE ONLY public.file_sync
    ADD CONSTRAINT fk_file_sync_transfer_record_id_transfer_record FOREIGN KEY (transfer_record_id) REFERENCES public.transfer_record(id);






-- Replace statement.peer_id with file_id and drop columns no longer used.

alter table statement add column file_id bigint;
update statement set file_id = (
    select file.id from file
    where file.owner_id = statement.owner_id
        and (
            (statement.peer_id = 'c' and file.file_type = 'open_circ') or
            (statement.peer_id != 'c' and file.peer_id = statement.peer_id))
    );
alter table statement
    alter column file_id set not null,
    drop column peer_id,
    drop column loop_id,
    drop column currency;

CREATE INDEX ix_statement_file_id ON public.statement USING btree (file_id);

ALTER TABLE ONLY public.statement
    ADD CONSTRAINT fk_statement_file_id_file FOREIGN KEY (file_id) REFERENCES public.file(id);





-- Replace account_entry.peer_id with file_id.

alter table account_entry add column file_id bigint;
update account_entry set file_id = (
    select file.id from file
    where file.owner_id = account_entry.owner_id
        and (
            (account_entry.peer_id = 'c' and file.file_type = 'open_circ') or
            (account_entry.peer_id != 'c' and file.peer_id = account_entry.peer_id))
    );
alter table account_entry
    alter column file_id set not null,
    drop column peer_id;

CREATE INDEX ix_account_entry_file_id ON public.account_entry USING btree (file_id);

ALTER TABLE ONLY public.account_entry
    ADD CONSTRAINT fk_account_entry_file_id_file FOREIGN KEY (file_id) REFERENCES public.file(id),
    ADD CONSTRAINT fk_account_entry_period_id_period FOREIGN KEY (period_id) REFERENCES public.period(id),
    ADD CONSTRAINT match_file FOREIGN KEY (file_id, currency) REFERENCES public.file(id, currency);





-- Alter account_entry_log.

alter table account_entry_log
    drop column period_id,
    add CONSTRAINT ck_account_entry_log_delta_nonzero CHECK ((delta <> (0)::numeric));




-- Create file_movement_log, which is a file-specific version of movement_log.
-- We could theoretically rename and alter movement_log instead, but
-- this way we only create file_movement_log entries that match a file.

CREATE TABLE public.file_movement_log (
    id bigint NOT NULL,
    ts timestamp without time zone DEFAULT timezone('UTC'::text, CURRENT_TIMESTAMP) NOT NULL,
    file_id bigint NOT NULL,
    movement_id bigint NOT NULL,
    personal_id character varying NOT NULL,
    event_type character varying NOT NULL,
    period_id bigint NOT NULL,
    reco_id bigint,
    surplus_delta numeric NOT NULL
);

CREATE SEQUENCE public.file_movement_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.file_movement_log_id_seq OWNED BY public.file_movement_log.id;

ALTER TABLE ONLY public.file_movement_log ALTER COLUMN id SET DEFAULT nextval('public.file_movement_log_id_seq'::regclass);

ALTER TABLE ONLY public.file_movement_log
    ADD CONSTRAINT pk_file_movement_log PRIMARY KEY (id);

CREATE INDEX ix_file_movement_log_period_id ON public.file_movement_log USING btree (period_id);
CREATE INDEX ix_file_movement_log_reco_id ON public.file_movement_log USING btree (reco_id);





-- Copy from movement_log to file_movement_log, then delete movement_log.

insert into file_movement_log (
        ts,
        file_id,
        movement_id,
        personal_id,
        event_type,
        period_id,
        reco_id,
        surplus_delta)
select
        movement_log.ts,
        file_movement.file_id,
        movement_log.movement_id,
        movement_log.personal_id,
        movement_log.event_type,
        movement_log.period_id,
        movement_log.reco_id,
        movement_log.surplus_delta
from movement_log
    join file_movement on (file_movement.movement_id = movement_log.movement_id);

drop table movement_log;





-- Remove the extra columns from the owner table.
alter table public.owner
    drop column show_non_circ_with_circ,
    drop column has_open_circ;




-- Delete the 'c' peers and add the constraint that keeps them from coming back.
delete from public.peer where peer_id = 'c';
alter table public.peer
    add CONSTRAINT ck_peer_peer_id_not_c CHECK (((peer_id)::text <> 'c'::text));




-- Delete the default periods that don't belong to a file.
delete from public.period where 
    start_date = null and
    end_date = null and
    not closed and
    not exists (
        select 1 from file
        where file.owner_id = period.owner_id
            and file.currency = period.currency
            and (
                (period.peer_id = 'c' and file.file_type = 'open_circ') or
                (period.peer_id != 'c' and file.peer_id = period.peer_id)));

drop index ix_period_single_unbounded_end_date;
drop index ix_period_single_unbounded_start_date;





-- Add the file_id column to period and drop the now-unused columns.
alter table period
    add column file_id bigint;
update period
    set file_id = (
        select file.id from file
        where file.owner_id = period.owner_id
            and file.currency = period.currency
            and (
                (period.peer_id = 'c' and file.file_type = 'open_circ') or
                (period.peer_id != 'c' and file.peer_id = period.peer_id)));
alter table period
    alter column file_id set not null,
    drop column peer_id,
    drop column loop_id,
    drop column currency,
    drop column has_vault;

CREATE INDEX ix_period_file_id ON public.period USING btree (file_id);
CREATE INDEX ix_period_owner_id ON public.period USING btree (owner_id);

CREATE UNIQUE INDEX ix_period_single_unbounded_end_date ON public.period
    USING btree (owner_id, file_id) WHERE (end_date IS NULL);

CREATE UNIQUE INDEX ix_period_single_unbounded_start_date ON public.period
    USING btree (owner_id, file_id) WHERE (start_date IS NULL);

ALTER TABLE ONLY public.period
    ADD CONSTRAINT fk_period_file_id_file FOREIGN KEY (file_id) REFERENCES public.file(id);




-- Re-create the trigger functions.

CREATE FUNCTION public.account_entry_log_process() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if (TG_OP = 'DELETE') then
        insert into account_entry_log (
            account_entry_id,
            personal_id,
            event_type,
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
$$;

CREATE FUNCTION public.file_movement_log_process() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if (TG_OP = 'DELETE') then
        insert into file_movement_log (
            file_id,
            movement_id,
            personal_id,
            event_type,
            period_id,
            reco_id,
            surplus_delta)
        select
            old.file_id,
            old.movement_id,
            current_setting('opnreco.personal_id'),
            current_setting('opnreco.movement.event_type'),
            old.period_id,
            old.reco_id,
            old.surplus_delta;
        return old;
    elsif (TG_OP = 'UPDATE' or TG_OP = 'INSERT') then
        insert into file_movement_log (
            file_id,
            movement_id,
            personal_id,
            event_type,
            period_id,
            reco_id,
            surplus_delta)
        select
            new.file_id,
            new.movement_id,
            current_setting('opnreco.personal_id'),
            current_setting('opnreco.movement.event_type'),
            new.period_id,
            new.reco_id,
            new.surplus_delta;
        return new;
    end if;
    return null;
end;
$$;

CREATE TRIGGER account_entry_log_trigger
    AFTER INSERT OR DELETE OR UPDATE ON public.account_entry
    FOR EACH ROW EXECUTE PROCEDURE public.account_entry_log_process();

CREATE TRIGGER file_movement_log_trigger
    AFTER INSERT OR DELETE OR UPDATE ON public.file_movement
    FOR EACH ROW EXECUTE PROCEDURE public.file_movement_log_process();



commit;
