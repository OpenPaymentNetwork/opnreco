
-- Convert to the 2.1 schema.
-- transfer_record.bundled_transfers was often accidentally the string 'null' instead of null.
-- (SQLAlchemy's JSONB treats None as the string 'null' by default.)

begin;

update transfer_record set bundled_transfers = null where bundled_transfers = 'null';

alter table transfer_record
    add CONSTRAINT ck_transfer_record_bundled_transfers_is_array_or_null CHECK (
        ((bundled_transfers IS NULL) OR (jsonb_array_length(bundled_transfers) >= 0)));

commit;
