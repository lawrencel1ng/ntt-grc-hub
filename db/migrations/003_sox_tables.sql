-- Migration 003: SOX IT General Controls tables
-- Run once against any existing database:
--   psql $DATABASE_URL -f db/migrations/003_sox_tables.sql

CREATE SCHEMA IF NOT EXISTS sox;

DO $$ BEGIN
  CREATE TYPE sox.control_type AS ENUM ('manual','automated','itdm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sox.itgc_status AS ENUM ('effective','deficiency','material_weakness');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sox.deficiency_sev AS ENUM ('significant','material');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sox.itgcs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    control_ref     TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    objective       TEXT,
    control_type    sox.control_type NOT NULL DEFAULT 'manual',
    frequency       TEXT,
    status          sox.itgc_status NOT NULL DEFAULT 'effective',
    tested_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sox_itgcs_tenant_id_idx ON sox.itgcs (tenant_id);
CREATE INDEX IF NOT EXISTS sox_itgcs_status_idx    ON sox.itgcs (status);
CREATE UNIQUE INDEX IF NOT EXISTS sox_itgcs_tenant_control_ref_idx
    ON sox.itgcs (tenant_id, control_ref);

CREATE TABLE IF NOT EXISTS sox.kcas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    itgc_id         UUID NOT NULL REFERENCES sox.itgcs(id) ON DELETE CASCADE,
    attribute       TEXT NOT NULL,
    value           TEXT NOT NULL,
    assessed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sox_kcas_tenant_id_idx ON sox.kcas (tenant_id);
CREATE INDEX IF NOT EXISTS sox_kcas_itgc_id_idx   ON sox.kcas (itgc_id);

CREATE TABLE IF NOT EXISTS sox.walkthroughs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    itgc_id         UUID NOT NULL REFERENCES sox.itgcs(id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    completed_at    TIMESTAMPTZ,
    evidence_link   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sox_walkthroughs_tenant_id_idx ON sox.walkthroughs (tenant_id);
CREATE INDEX IF NOT EXISTS sox_walkthroughs_itgc_id_idx   ON sox.walkthroughs (itgc_id);

CREATE TABLE IF NOT EXISTS sox.deficiencies (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    itgc_id             UUID NOT NULL REFERENCES sox.itgcs(id) ON DELETE CASCADE,
    severity            sox.deficiency_sev NOT NULL,
    description         TEXT NOT NULL,
    remediation_plan    TEXT,
    remediated_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sox_deficiencies_tenant_id_idx ON sox.deficiencies (tenant_id);
CREATE INDEX IF NOT EXISTS sox_deficiencies_itgc_id_idx   ON sox.deficiencies (itgc_id);
CREATE INDEX IF NOT EXISTS sox_deficiencies_severity_idx  ON sox.deficiencies (severity);
