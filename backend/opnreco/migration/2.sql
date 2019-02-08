
-- Convert from the 1.1 or 1.2 to the 1.3 schema.
-- Add bundled_transfers and bundle_transfer_id to transfer_record.

begin;

alter table transfer_record
    add column bundled_transfers jsonb,
    add column bundle_transfer_id character varying;

commit;
