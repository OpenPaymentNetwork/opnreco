
-- Convert from the 1.0 to the 1.1 schema.
-- Replace movement.reco_wallet_delta with movement.surplus_delta.
-- ("surplus_delta" expresses the purpose better and is more flexible.)

begin;

-- Temporarily disable the movement change log.
drop trigger movement_log_trigger on movement;

alter table movement drop constraint ck_movement_reco_wallet_delta;

alter table movement
    rename reco_wallet_delta to surplus_delta;
update movement
    set surplus_delta = -surplus_delta;

alter table movement add constraint ck_movement_surplus_delta_value
    check(
        surplus_delta = -wallet_delta OR
        surplus_delta = 0::numeric AND reco_id IS NOT NULL OR
        surplus_delta = vault_delta AND reco_id IS NOT NULL);

alter table movement_log
    rename reco_wallet_delta to surplus_delta;
update movement_log
    set surplus_delta = -surplus_delta;

-- Replace and re-enable the movement change log trigger.

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


-- Add a new reco_type.

alter table reco drop constraint ck_reco_reco_type;
alter table reco add constraint ck_reco_reco_type
    CHECK (reco_type::text = ANY (ARRAY[
        'standard'::character varying,
        'wallet_only'::character varying,
        'account_only'::character varying,
        'vault_only'::character varying
    ]::text[]));

commit;
