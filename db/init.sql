-- =====================================================================
--  NTT GRC Hub — PostgreSQL schema (demo)
--  Target: PostgreSQL 16+
--
--  This script creates the database, schemas, enums, tables, indexes
--  and views for the Agentic GRC Operating System.
--
--  Design highlights:
--    - 18 domain schemas (platform, risk, control, compliance, evidence,
--      audit, policy, vendor, privacy, esg, ai_gov, incident, issue,
--      bcm, regwatch, agent, workflow, integration)
--    - Tenant isolation via tenant_id FK to platform.tenants on every
--      business table; a handful of platform-global tables
--      (agent.agents, regwatch.sources, compliance.frameworks) are
--      intentionally not tenant-scoped.
--    - Hash-chained audit log (platform.audit_log) and evidence seal
--      table (evidence.seals) — chain enforced by the application.
--    - JSONB for variable blobs (questionnaire responses, FAIR
--      distributions, agent decision payloads, evidence metadata).
--
--  Sections (written across plan Tasks 2.1 → 2.4):
--    1. DB + extensions + schemas + enums            [Task 2.1]
--    2. platform.*                                    [Task 2.1]
--    3. risk.*                                        [Task 2.1]
--    4. control.*                                     [Task 2.1]
--    5. compliance.*                                  [Task 2.2]
--    6. evidence.*                                    [Task 2.2]
--    7. audit.*                                       [Task 2.2]
--    8. policy.*                                      [Task 2.2]
--    9. vendor.*                                      [Task 2.2]
--   10. privacy / esg / ai_gov / incident / issue /
--       bcm / regwatch                                [Task 2.3]
--   11. agent / workflow / integration                [Task 2.4]
--   12. views                                         [Task 2.4]
-- =====================================================================

\set ON_ERROR_STOP on

DROP DATABASE IF EXISTS ntt_grc_hub;
CREATE DATABASE ntt_grc_hub
  WITH ENCODING 'UTF8'
       LC_COLLATE 'en_US.UTF-8'
       LC_CTYPE   'en_US.UTF-8';

\c ntt_grc_hub

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- pgvector is optional — used in a future phase for semantic control
-- mapping. Comment out if the `vector` extension is not installed on
-- the target Postgres image.
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------
-- Schemas (18 domains per spec §7.1)
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS platform;     -- tenants, users, sessions, audit log
CREATE SCHEMA IF NOT EXISTS risk;         -- registers, risks, FAIR scenarios, appetite
CREATE SCHEMA IF NOT EXISTS control;      -- control library, mappings, tests, runs
CREATE SCHEMA IF NOT EXISTS compliance;   -- frameworks, requirements, assessments, gaps
CREATE SCHEMA IF NOT EXISTS evidence;     -- collectors, items, hash-chain seals, attachments
CREATE SCHEMA IF NOT EXISTS audit;        -- engagements, findings, workpapers
CREATE SCHEMA IF NOT EXISTS policy;       -- documents, versions, acks, exceptions
CREATE SCHEMA IF NOT EXISTS vendor;       -- vendors, contracts, questionnaires, 4th-party
CREATE SCHEMA IF NOT EXISTS privacy;      -- RoPA, DPIAs, subject requests, breaches
CREATE SCHEMA IF NOT EXISTS esg;          -- ESG metrics, disclosures, targets
CREATE SCHEMA IF NOT EXISTS ai_gov;       -- AI model registry + governance
CREATE SCHEMA IF NOT EXISTS incident;     -- incidents + timeline + postmortems
CREATE SCHEMA IF NOT EXISTS issue;        -- cross-domain issues + actions
CREATE SCHEMA IF NOT EXISTS bcm;          -- BCM plans, BIAs, tests, scenarios
CREATE SCHEMA IF NOT EXISTS regwatch;     -- regulator sources, changes, impact
CREATE SCHEMA IF NOT EXISTS agent;        -- agent fleet, runs, decisions, cost
CREATE SCHEMA IF NOT EXISTS workflow;     -- workflow definitions + executions
CREATE SCHEMA IF NOT EXISTS integration;  -- connectors, sync jobs, credential metadata

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
CREATE TYPE platform.role               AS ENUM ('admin','risk-owner','control-owner','auditor','agent-operator','viewer');
CREATE TYPE platform.user_status        AS ENUM ('active','disabled','invited','locked');

CREATE TYPE risk.severity               AS ENUM ('critical','high','medium','low','info');
CREATE TYPE risk.likelihood             AS ENUM ('rare','unlikely','possible','likely','almost-certain');
CREATE TYPE risk.treatment_strategy     AS ENUM ('accept','mitigate','transfer','avoid');
CREATE TYPE risk.status                 AS ENUM ('identified','assessed','treated','monitoring','closed');

CREATE TYPE control.maturity            AS ENUM ('initial','developing','defined','managed','optimised');
CREATE TYPE control.test_result         AS ENUM ('pass','fail','partial','na');
CREATE TYPE control.type                AS ENUM ('technical','process','admin');
CREATE TYPE control.test_kind           AS ENUM ('manual','automated');

CREATE TYPE compliance.assessment_status AS ENUM ('not-started','in-progress','complete','expired');

CREATE TYPE evidence.kind               AS ENUM ('screenshot','log','config','attestation','document','scan-result','api-response');
CREATE TYPE evidence.collector_kind     AS ENUM ('aws','azure','gcp','okta','jira','m365','github','servicenow','slack','manual');

CREATE TYPE audit.engagement_type       AS ENUM ('internal','external','regulatory','customer');
CREATE TYPE audit.finding_status        AS ENUM ('open','closed','accepted-risk');

CREATE TYPE policy.version_status       AS ENUM ('draft','in-review','approved','retired');

CREATE TYPE vendor.tier                 AS ENUM ('1','2','3','4');
CREATE TYPE vendor.criticality          AS ENUM ('critical','high','medium','low');
CREATE TYPE vendor.status               AS ENUM ('active','onboarding','offboarded');
CREATE TYPE vendor.questionnaire_status AS ENUM ('sent','in-progress','complete');

CREATE TYPE privacy.request_kind        AS ENUM ('access','erasure','portability','objection','rectification');
CREATE TYPE privacy.request_status      AS ENUM ('received','in-progress','resolved','rejected');

CREATE TYPE ai_gov.risk_tier            AS ENUM ('minimal','limited','high','unacceptable');
CREATE TYPE ai_gov.iso_42001_status     AS ENUM ('compliant','in-progress','non-compliant');

CREATE TYPE incident.severity           AS ENUM ('sev1','sev2','sev3','sev4');
CREATE TYPE incident.status             AS ENUM ('open','contained','resolved','postmortem-done');

CREATE TYPE issue.status                AS ENUM ('open','in-progress','resolved','accepted-risk');
CREATE TYPE issue.source                AS ENUM ('audit','risk-treatment','incident','control-test','regulatory');

CREATE TYPE bcm.test_result             AS ENUM ('pass','partial','fail');

CREATE TYPE regwatch.impact             AS ENUM ('none','low','medium','high');

CREATE TYPE agent.type                  AS ENUM ('deterministic','ai-powered','intelligent');
CREATE TYPE agent.run_status            AS ENUM ('queued','running','success','failed','halted','awaiting-approval');
CREATE TYPE agent.decision_outcome      AS ENUM ('auto-approved','awaiting-hitl','hitl-approved','hitl-rejected');
CREATE TYPE agent.run_trigger           AS ENUM ('cron','manual','event');

CREATE TYPE workflow.execution_status   AS ENUM ('running','success','failed','halted');
CREATE TYPE workflow.step_kind          AS ENUM ('agent','api','manual','decision');

CREATE TYPE integration.status          AS ENUM ('connected','degraded','disconnected');

-- =====================================================================
-- 2. platform.*
-- =====================================================================
CREATE TABLE platform.tenants (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    industry            TEXT NOT NULL,
    region              TEXT NOT NULL DEFAULT 'SG',
    classified          BOOLEAN NOT NULL DEFAULT FALSE,
    sla_tier            TEXT NOT NULL DEFAULT 'standard',
    primary_framework   TEXT,
    headquartered_in    TEXT NOT NULL DEFAULT 'Singapore',
    mrr_sgd             NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE platform.users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    email           TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    role            platform.role NOT NULL DEFAULT 'viewer',
    status          platform.user_status NOT NULL DEFAULT 'active',
    password_hash   TEXT,
    mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON platform.users (tenant_id);
CREATE INDEX ON platform.users (status);

CREATE TABLE platform.sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    revoked_at      TIMESTAMPTZ
);
CREATE INDEX ON platform.sessions (user_id);
CREATE INDEX ON platform.sessions (expires_at);

CREATE TABLE platform.api_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    scope           TEXT NOT NULL,
    prefix          TEXT NOT NULL,
    token_hash      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ
);
CREATE INDEX ON platform.api_tokens (user_id);

-- Hash-chained audit log. The application writes prev_hash and row_hash
-- such that row_hash = sha256(prev_hash || canonical_json(row_fields)).
-- The DB does not enforce the chain; verification is an app-level read.
CREATE TABLE platform.audit_log (
    id              BIGSERIAL PRIMARY KEY,
    ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
    tenant_id       TEXT REFERENCES platform.tenants(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    actor_email     TEXT,
    action          TEXT NOT NULL,
    target          TEXT,
    ip_address      INET,
    user_agent      TEXT,
    result          TEXT NOT NULL CHECK (result IN ('success','failure','denied')),
    metadata        JSONB,
    prev_hash       TEXT,
    row_hash        TEXT
);
CREATE INDEX ON platform.audit_log (tenant_id, ts DESC);
CREATE INDEX ON platform.audit_log (actor_email);
CREATE INDEX ON platform.audit_log (action);

-- =====================================================================
-- 3. risk.*
-- =====================================================================
CREATE TABLE risk.registers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    owner_user_id   UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON risk.registers (tenant_id);

CREATE TABLE risk.risks (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    register_id             UUID REFERENCES risk.registers(id) ON DELETE SET NULL,
    code                    TEXT NOT NULL,
    title                   TEXT NOT NULL,
    description             TEXT,
    category                TEXT NOT NULL,
    owner_user_id           UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    inherent_severity       risk.severity NOT NULL,
    inherent_likelihood     risk.likelihood NOT NULL,
    residual_severity       risk.severity NOT NULL,
    residual_likelihood     risk.likelihood NOT NULL,
    status                  risk.status NOT NULL DEFAULT 'identified',
    treatment_strategy      risk.treatment_strategy NOT NULL DEFAULT 'mitigate',
    last_assessed_at        TIMESTAMPTZ,
    next_review_at          TIMESTAMPTZ,
    business_service        TEXT,
    tags                    JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON risk.risks (tenant_id);
CREATE INDEX ON risk.risks (tenant_id, residual_severity, residual_likelihood);
CREATE INDEX ON risk.risks (category);
CREATE INDEX ON risk.risks (status);
CREATE INDEX ON risk.risks USING GIN (tags);
CREATE UNIQUE INDEX ON risk.risks (tenant_id, code);

CREATE TABLE risk.treatments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    risk_id         UUID NOT NULL REFERENCES risk.risks(id) ON DELETE CASCADE,
    strategy        risk.treatment_strategy NOT NULL,
    description     TEXT NOT NULL,
    owner_user_id   UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    due_at          TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    cost_sgd        NUMERIC(14,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON risk.treatments (tenant_id);
CREATE INDEX ON risk.treatments (risk_id);

-- FAIR scenarios: frequency / magnitude distributions stored as JSONB so
-- they can carry arbitrary distribution shapes (beta-pert, lognormal, …).
CREATE TABLE risk.scenarios (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    risk_id             UUID REFERENCES risk.risks(id) ON DELETE SET NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    frequency_dist      JSONB NOT NULL,  -- {kind:'beta-pert', min, mode, max}
    magnitude_dist      JSONB NOT NULL,  -- {kind:'lognormal', mean, stdev}
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON risk.scenarios (tenant_id);
CREATE INDEX ON risk.scenarios (risk_id);

-- FAIR Monte Carlo run output. We don't store all 10k trials; we
-- compress to LEC percentiles plus headline ALE / ARO.
CREATE TABLE risk.fair_runs (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    scenario_id     UUID NOT NULL REFERENCES risk.scenarios(id) ON DELETE CASCADE,
    trials          INT NOT NULL DEFAULT 10000,
    lec_percentiles JSONB NOT NULL,      -- {p10, p25, p50, p75, p90, p95, p99}
    ale_sgd         NUMERIC(14,2) NOT NULL,
    aro             NUMERIC(10,4) NOT NULL,
    run_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON risk.fair_runs (tenant_id, run_at DESC);
CREATE INDEX ON risk.fair_runs (scenario_id);

CREATE TABLE risk.appetite_statements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    category        TEXT NOT NULL,
    statement       TEXT NOT NULL,
    threshold_sgd   NUMERIC(14,2),
    severity_cap    risk.severity,
    approved_by_user_id UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON risk.appetite_statements (tenant_id);

-- =====================================================================
-- 4. control.*
-- =====================================================================
CREATE TABLE control.library (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    type            control.type NOT NULL,
    family          JSONB,                  -- e.g., ['access-control','identity']
    owner_user_id   UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    frequency       TEXT,                   -- continuous / daily / monthly / quarterly / annual
    automated       BOOLEAN NOT NULL DEFAULT FALSE,
    maturity        control.maturity NOT NULL DEFAULT 'initial',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON control.library (tenant_id);
CREATE INDEX ON control.library (type);
CREATE INDEX ON control.library USING GIN (family);
CREATE UNIQUE INDEX ON control.library (tenant_id, code);

-- Note: control.mappings deliberately does not carry tenant_id directly
-- — it joins control.library (tenant-scoped) with compliance.frameworks
-- (platform-global). Tenant filtering happens via the library join.
CREATE TABLE control.mappings (
    id                  BIGSERIAL PRIMARY KEY,
    control_id          TEXT NOT NULL REFERENCES control.library(id) ON DELETE CASCADE,
    framework_id        TEXT NOT NULL,    -- FK declared after compliance.frameworks exists (Task 2.2)
    requirement_id      TEXT,             -- FK declared after compliance.requirements exists (Task 2.2)
    coverage_pct        INT NOT NULL DEFAULT 100 CHECK (coverage_pct BETWEEN 0 AND 100),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON control.mappings (control_id);
CREATE INDEX ON control.mappings (framework_id);
CREATE INDEX ON control.mappings (requirement_id);

CREATE TABLE control.tests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    control_id      TEXT NOT NULL REFERENCES control.library(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    kind            control.test_kind NOT NULL,
    schedule_cron   TEXT,
    procedure_md    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON control.tests (tenant_id);
CREATE INDEX ON control.tests (control_id);

-- Forward-declared FK columns (evidence_item_id, agent_run_id) — added
-- as plain columns now; FKs are NOT added because of cross-task forward
-- references that would over-constrain the file. Application enforces.
CREATE TABLE control.test_runs (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    control_id          TEXT NOT NULL REFERENCES control.library(id) ON DELETE CASCADE,
    test_id             UUID REFERENCES control.tests(id) ON DELETE SET NULL,
    ran_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    result              control.test_result NOT NULL,
    evidence_item_id    BIGINT,                  -- soft FK → evidence.items.id
    agent_run_id        BIGINT,                  -- soft FK → agent.runs.id
    notes               TEXT,
    duration_ms         INT
);
CREATE INDEX ON control.test_runs (tenant_id, ran_at DESC);
CREATE INDEX ON control.test_runs (control_id);
CREATE INDEX ON control.test_runs (result);

CREATE TABLE control.exceptions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    control_id          TEXT NOT NULL REFERENCES control.library(id) ON DELETE CASCADE,
    requester_user_id   UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    justification       TEXT NOT NULL,
    granted             BOOLEAN NOT NULL DEFAULT FALSE,
    granted_by_user_id  UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    granted_at          TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON control.exceptions (tenant_id);
CREATE INDEX ON control.exceptions (control_id);

\echo ' >> platform/risk/control schemas created'
