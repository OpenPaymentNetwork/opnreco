

-- Add the verification_result table.

begin;

CREATE TABLE public.verification_result (
    id bigint NOT NULL,
    created timestamp without time zone DEFAULT timezone('UTC'::text, now()) NOT NULL,
    owner_id character varying NOT NULL,
    verification_id character varying NOT NULL,
    initial boolean NOT NULL,
    first_sync_ts timestamp without time zone,
    last_sync_ts timestamp without time zone,
    last_sync_transfer_id character varying,
    sync_total bigint,
    sync_done bigint,
    internal_result jsonb,
    verified jsonb NOT NULL,
    expires timestamp without time zone NOT NULL
);

CREATE SEQUENCE public.verification_result_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.verification_result_id_seq OWNED BY public.verification_result.id;

ALTER TABLE ONLY public.verification_result ALTER COLUMN id SET DEFAULT nextval('public.verification_result_id_seq'::regclass);

ALTER TABLE ONLY public.verification_result
    ADD CONSTRAINT pk_verification_result PRIMARY KEY (id);

CREATE INDEX ix_verification_result_expires ON public.verification_result USING btree (expires);

CREATE INDEX ix_verification_result_verification_id ON public.verification_result USING btree (verification_id);

commit;
