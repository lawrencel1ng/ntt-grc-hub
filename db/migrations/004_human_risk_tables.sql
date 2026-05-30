-- Migration 004: Human Risk (KnowBe4) tables
-- Run once against any existing database:
--   psql $DATABASE_URL -f db/migrations/004_human_risk_tables.sql

CREATE SCHEMA IF NOT EXISTS human_risk;

-- Records of KnowBe4 API sync runs.
CREATE TABLE IF NOT EXISTS human_risk.sync_jobs (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          TEXT NOT NULL DEFAULT 'ok'  -- 'ok' | 'error' | 'partial'
);
CREATE INDEX IF NOT EXISTS human_risk_sync_jobs_tenant_synced_idx
    ON human_risk.sync_jobs (tenant_id, synced_at DESC);

-- Per-tenant org-level KnowBe4 metrics (one row per tenant, upserted on sync).
CREATE TABLE IF NOT EXISTS human_risk.org_scores (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    org_risk_score              INT NOT NULL,
    org_risk_score_12m_ago      INT NOT NULL DEFAULT 0,
    phish_prone_pct             NUMERIC(5,2) NOT NULL,
    phish_prone_pct_12m_ago     NUMERIC(5,2) NOT NULL DEFAULT 0,
    industry_phish_prone_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
    training_completion_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
    headcount                   INT NOT NULL DEFAULT 0,
    users_at_high_risk          INT NOT NULL DEFAULT 0,
    users_at_critical_risk      INT NOT NULL DEFAULT 0,
    campaigns_run_12m           INT NOT NULL DEFAULT 0,
    reporting_rate_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
    risk_level                  TEXT NOT NULL DEFAULT 'moderate',
    risk_score_history          JSONB NOT NULL DEFAULT '[]',
    synced_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS human_risk_org_scores_tenant_synced_idx
    ON human_risk.org_scores (tenant_id, synced_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS human_risk_org_scores_tenant_uniq_idx
    ON human_risk.org_scores (tenant_id);

-- Per-user risk data (the triage cohort).
CREATE TABLE IF NOT EXISTS human_risk.users (
    id                      TEXT PRIMARY KEY,
    tenant_id               TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    email                   TEXT NOT NULL,
    department              TEXT NOT NULL DEFAULT '',
    job_title               TEXT NOT NULL DEFAULT '',
    risk_score              INT NOT NULL DEFAULT 0,
    risk_level              TEXT NOT NULL DEFAULT 'low',
    risk_score_30d_delta    INT NOT NULL DEFAULT 0,
    phishing_sent           INT NOT NULL DEFAULT 0,
    phishing_clicked        INT NOT NULL DEFAULT 0,
    phishing_reported       INT NOT NULL DEFAULT 0,
    phishing_data_entered   INT NOT NULL DEFAULT 0,
    last_phish_result       TEXT NOT NULL DEFAULT 'no-action',
    last_phish_at           TIMESTAMPTZ,
    training_assigned       INT NOT NULL DEFAULT 0,
    training_completed      INT NOT NULL DEFAULT 0,
    training_completion_pct INT NOT NULL DEFAULT 0,
    last_training_at        TIMESTAMPTZ,
    mfa_enabled             BOOLEAN NOT NULL DEFAULT true,
    privileged_access       BOOLEAN NOT NULL DEFAULT false,
    risk_history            JSONB NOT NULL DEFAULT '[]',
    synced_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS human_risk_users_tenant_score_idx
    ON human_risk.users (tenant_id, risk_score DESC);
CREATE INDEX IF NOT EXISTS human_risk_users_tenant_email_idx
    ON human_risk.users (tenant_id, email);

-- Aggregated per-department stats.
CREATE TABLE IF NOT EXISTS human_risk.departments (
    id                      BIGSERIAL PRIMARY KEY,
    tenant_id               TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    department              TEXT NOT NULL,
    headcount               INT NOT NULL DEFAULT 0,
    avg_risk_score          INT NOT NULL DEFAULT 0,
    risk_level              TEXT NOT NULL DEFAULT 'low',
    phish_prone_pct         NUMERIC(5,2) NOT NULL DEFAULT 0,
    training_completion_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    high_risk_users         INT NOT NULL DEFAULT 0,
    synced_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS human_risk_departments_tenant_score_idx
    ON human_risk.departments (tenant_id, avg_risk_score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS human_risk_departments_tenant_dept_uniq_idx
    ON human_risk.departments (tenant_id, department);

-- FAIR ALE quantification per tenant (one row per tenant, upserted on sync).
CREATE TABLE IF NOT EXISTS human_risk.quant (
    id                      BIGSERIAL PRIMARY KEY,
    tenant_id               TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    aro                     NUMERIC(10,4) NOT NULL DEFAULT 0,
    per_incident_mean_sgd   INT NOT NULL DEFAULT 0,
    per_incident_stdev_sgd  INT NOT NULL DEFAULT 0,
    ale_sgd                 INT NOT NULL DEFAULT 0,
    ale_sgd_12m_ago         INT NOT NULL DEFAULT 0,
    ale_reduced_sgd         INT NOT NULL DEFAULT 0,
    risk_id                 TEXT NOT NULL DEFAULT '',
    scenario_id             TEXT NOT NULL DEFAULT '',
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS human_risk_quant_tenant_computed_idx
    ON human_risk.quant (tenant_id, computed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS human_risk_quant_tenant_uniq_idx
    ON human_risk.quant (tenant_id);
