
-- Convert from the 1.3 to the 1.4 schema.
-- Add show_non_circ_with_circ to owner.

begin;

alter table owner
    add column show_non_circ_with_circ boolean not null default false;
alter table owner
    alter column show_non_circ_with_circ drop default;

commit;
