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
    language        TEXT NOT NULL DEFAULT 'en-SG',
    timezone        TEXT NOT NULL DEFAULT 'Asia/Singapore',
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
    token_prefix    VARCHAR(64),           -- first 32 hex chars of SHA-256(token)
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    revoked_at      TIMESTAMPTZ
);
CREATE INDEX ON platform.sessions (user_id);
CREATE INDEX ON platform.sessions (expires_at);
CREATE UNIQUE INDEX sessions_token_prefix_idx ON platform.sessions (token_prefix)
  WHERE token_prefix IS NOT NULL;

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

-- =====================================================================
-- 5. compliance.*
--
-- Frameworks and requirements are platform-global (no tenant_id).
-- Assessments / gaps / attestations are tenant-scoped.
-- =====================================================================
CREATE TABLE compliance.frameworks (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    version             TEXT,
    regulator           TEXT NOT NULL,
    region              TEXT NOT NULL,
    jurisdiction        TEXT,
    total_requirements  INT NOT NULL DEFAULT 0,
    tags                JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON compliance.frameworks (region);
CREATE INDEX ON compliance.frameworks USING GIN (tags);

CREATE TABLE compliance.requirements (
    id                      TEXT PRIMARY KEY,
    framework_id            TEXT NOT NULL REFERENCES compliance.frameworks(id) ON DELETE CASCADE,
    code                    TEXT NOT NULL,
    title                   TEXT NOT NULL,
    description             TEXT,
    parent_requirement_id   TEXT REFERENCES compliance.requirements(id) ON DELETE SET NULL,
    weight                  NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON compliance.requirements (framework_id);
CREATE INDEX ON compliance.requirements (parent_requirement_id);
CREATE UNIQUE INDEX ON compliance.requirements (framework_id, code);

-- Now that compliance.frameworks / .requirements exist, add the FKs we
-- forward-declared on control.mappings.
ALTER TABLE control.mappings
    ADD CONSTRAINT control_mappings_framework_fk
        FOREIGN KEY (framework_id) REFERENCES compliance.frameworks(id) ON DELETE CASCADE,
    ADD CONSTRAINT control_mappings_requirement_fk
        FOREIGN KEY (requirement_id) REFERENCES compliance.requirements(id) ON DELETE CASCADE;

CREATE TABLE compliance.assessments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    framework_id        TEXT NOT NULL REFERENCES compliance.frameworks(id) ON DELETE CASCADE,
    status              compliance.assessment_status NOT NULL DEFAULT 'not-started',
    score               NUMERIC(5,2),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    next_due_at         TIMESTAMPTZ,
    assessor_user_id    UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON compliance.assessments (tenant_id);
CREATE INDEX ON compliance.assessments (framework_id);
CREATE INDEX ON compliance.assessments (status);

CREATE TABLE compliance.gaps (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    assessment_id       UUID NOT NULL REFERENCES compliance.assessments(id) ON DELETE CASCADE,
    requirement_id      TEXT NOT NULL REFERENCES compliance.requirements(id) ON DELETE CASCADE,
    severity            risk.severity NOT NULL,
    remediation_plan    TEXT,
    target_date         DATE,
    owner_user_id       UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON compliance.gaps (tenant_id);
CREATE INDEX ON compliance.gaps (assessment_id);
CREATE INDEX ON compliance.gaps (severity);

CREATE TABLE compliance.attestations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    framework_id        TEXT NOT NULL REFERENCES compliance.frameworks(id) ON DELETE CASCADE,
    signed_by_user_id   UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    signed_at           TIMESTAMPTZ NOT NULL,
    valid_until         TIMESTAMPTZ,
    attestation_text    TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON compliance.attestations (tenant_id);
CREATE INDEX ON compliance.attestations (framework_id);

-- =====================================================================
-- 6. evidence.*
--
-- evidence.seals is the hash-chain ledger; one row per evidence.items
-- row. prev_hash points to the previous seal's row_hash; row_hash =
-- sha256(prev_hash || canonical_json(evidence.items snapshot)).
-- =====================================================================
CREATE TABLE evidence.collectors (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    kind            evidence.collector_kind NOT NULL,
    schedule_cron   TEXT,
    last_run_at     TIMESTAMPTZ,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    config          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON evidence.collectors (tenant_id);
CREATE INDEX ON evidence.collectors (kind);

CREATE TABLE evidence.items (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    collector_id    TEXT REFERENCES evidence.collectors(id) ON DELETE SET NULL,
    control_id      TEXT REFERENCES control.library(id) ON DELETE SET NULL,
    kind            evidence.kind NOT NULL,
    title           TEXT NOT NULL,
    source_url      TEXT,
    blob_url        TEXT,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    agent_run_id    BIGINT,                  -- soft FK → agent.runs.id
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON evidence.items (tenant_id, captured_at DESC);
CREATE INDEX ON evidence.items (collector_id);
CREATE INDEX ON evidence.items (control_id);
CREATE INDEX ON evidence.items (kind);
CREATE INDEX ON evidence.items USING GIN (metadata);

CREATE TABLE evidence.seals (
    item_id         BIGINT PRIMARY KEY REFERENCES evidence.items(id) ON DELETE CASCADE,
    prev_hash       TEXT,
    row_hash        TEXT NOT NULL,
    sealed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON evidence.seals (sealed_at);

CREATE TABLE evidence.attachments (
    id              BIGSERIAL PRIMARY KEY,
    item_id         BIGINT NOT NULL REFERENCES evidence.items(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    sha256          TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON evidence.attachments (item_id);

-- =====================================================================
-- 7. audit.*
-- =====================================================================
CREATE TABLE audit.engagements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    type            audit.engagement_type NOT NULL,
    lead_auditor    TEXT NOT NULL,
    opened_at       TIMESTAMPTZ NOT NULL,
    closed_at       TIMESTAMPTZ,
    scope           TEXT,
    framework_id    TEXT REFERENCES compliance.frameworks(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit.engagements (tenant_id);
CREATE INDEX ON audit.engagements (type);

CREATE TABLE audit.findings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    engagement_id   UUID NOT NULL REFERENCES audit.engagements(id) ON DELETE CASCADE,
    severity        risk.severity NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    control_id      TEXT REFERENCES control.library(id) ON DELETE SET NULL,
    due_at          TIMESTAMPTZ,
    status          audit.finding_status NOT NULL DEFAULT 'open',
    owner_user_id   UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit.findings (tenant_id);
CREATE INDEX ON audit.findings (engagement_id);
CREATE INDEX ON audit.findings (status);
CREATE INDEX ON audit.findings (severity);

CREATE TABLE audit.workpapers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    engagement_id   UUID NOT NULL REFERENCES audit.engagements(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    content_md      TEXT NOT NULL,
    created_by      UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit.workpapers (tenant_id);
CREATE INDEX ON audit.workpapers (engagement_id);

-- =====================================================================
-- 8. policy.*
-- =====================================================================
CREATE TABLE policy.documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    code                TEXT NOT NULL,
    title               TEXT NOT NULL,
    owner_user_id       UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    jurisdiction        TEXT,
    current_version_id  UUID,                       -- soft FK → policy.versions.id (cyclic)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON policy.documents (tenant_id);
CREATE UNIQUE INDEX ON policy.documents (tenant_id, code);

CREATE TABLE policy.versions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    document_id             UUID NOT NULL REFERENCES policy.documents(id) ON DELETE CASCADE,
    version_no              TEXT NOT NULL,
    content_md              TEXT NOT NULL,
    status                  policy.version_status NOT NULL DEFAULT 'draft',
    effective_at            TIMESTAMPTZ,
    drafted_by_agent_id     TEXT,                   -- soft FK → agent.agents.id
    drafted_by_user_id      UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    approved_by_user_id     UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON policy.versions (tenant_id);
CREATE INDEX ON policy.versions (document_id);
CREATE INDEX ON policy.versions (status);
CREATE UNIQUE INDEX ON policy.versions (document_id, version_no);

-- Now close the cyclic reference from documents.current_version_id.
ALTER TABLE policy.documents
    ADD CONSTRAINT policy_documents_current_version_fk
        FOREIGN KEY (current_version_id)
        REFERENCES policy.versions(id) ON DELETE SET NULL;

CREATE TABLE policy.acknowledgements (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    version_id      UUID NOT NULL REFERENCES policy.versions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (version_id, user_id)
);
CREATE INDEX ON policy.acknowledgements (tenant_id);
CREATE INDEX ON policy.acknowledgements (version_id);

CREATE TABLE policy.exceptions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    document_id         UUID NOT NULL REFERENCES policy.documents(id) ON DELETE CASCADE,
    requester_user_id   UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    justification       TEXT NOT NULL,
    granted             BOOLEAN NOT NULL DEFAULT FALSE,
    granted_by_user_id  UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON policy.exceptions (tenant_id);
CREATE INDEX ON policy.exceptions (document_id);

-- =====================================================================
-- 9. vendor.*
-- =====================================================================
CREATE TABLE vendor.vendors (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    category                TEXT,
    tier                    vendor.tier NOT NULL,
    criticality             vendor.criticality NOT NULL,
    hq_country              TEXT,
    primary_contact_email   TEXT,
    status                  vendor.status NOT NULL DEFAULT 'active',
    tags                    JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON vendor.vendors (tenant_id);
CREATE INDEX ON vendor.vendors (tier);
CREATE INDEX ON vendor.vendors (criticality);
CREATE INDEX ON vendor.vendors (status);
CREATE INDEX ON vendor.vendors USING GIN (tags);

CREATE TABLE vendor.contracts (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    vendor_id               UUID NOT NULL REFERENCES vendor.vendors(id) ON DELETE CASCADE,
    contract_no             TEXT NOT NULL,
    value_sgd               NUMERIC(14,2) NOT NULL DEFAULT 0,
    starts_at               DATE NOT NULL,
    ends_at                 DATE,
    renewal_window_days     INT NOT NULL DEFAULT 90,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON vendor.contracts (tenant_id);
CREATE INDEX ON vendor.contracts (vendor_id);

CREATE TABLE vendor.questionnaires (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    vendor_id                   UUID NOT NULL REFERENCES vendor.vendors(id) ON DELETE CASCADE,
    template                    TEXT NOT NULL CHECK (template IN ('SIG','CAIQ','Custom')),
    status                      vendor.questionnaire_status NOT NULL DEFAULT 'sent',
    sent_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at                TIMESTAMPTZ,
    completed_by_agent_id       TEXT,                   -- soft FK → agent.agents.id
    score                       NUMERIC(5,2),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON vendor.questionnaires (tenant_id);
CREATE INDEX ON vendor.questionnaires (vendor_id);
CREATE INDEX ON vendor.questionnaires (status);

CREATE TABLE vendor.responses (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    questionnaire_id            UUID NOT NULL REFERENCES vendor.questionnaires(id) ON DELETE CASCADE,
    question_code               TEXT NOT NULL,
    response                    TEXT NOT NULL,
    confidence                  NUMERIC(5,2),
    source_evidence_item_id     BIGINT REFERENCES evidence.items(id) ON DELETE SET NULL,
    answered_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON vendor.responses (tenant_id);
CREATE INDEX ON vendor.responses (questionnaire_id);

CREATE TABLE vendor.fourth_parties (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    vendor_id       UUID NOT NULL REFERENCES vendor.vendors(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('cloud','saas','processor')),
    region          TEXT,
    criticality     vendor.criticality NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON vendor.fourth_parties (tenant_id);
CREATE INDEX ON vendor.fourth_parties (vendor_id);

CREATE TABLE vendor.concentrations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    dimension       TEXT NOT NULL CHECK (dimension IN ('cloud','region','processor')),
    key             TEXT NOT NULL,
    vendor_count    INT NOT NULL,
    exposure_sgd    NUMERIC(14,2) NOT NULL,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON vendor.concentrations (tenant_id);
CREATE INDEX ON vendor.concentrations (dimension);

\echo ' >> compliance/evidence/audit/policy/vendor schemas created'

-- =====================================================================
-- 10. privacy.*
-- =====================================================================
CREATE TABLE privacy.processing_activities (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    controller          TEXT NOT NULL,
    processor           TEXT,
    purpose             TEXT NOT NULL,
    lawful_basis        TEXT NOT NULL,
    data_categories     TEXT[] NOT NULL DEFAULT '{}',
    retention_period    TEXT,
    cross_border        BOOLEAN NOT NULL DEFAULT FALSE,
    jurisdictions       TEXT[] NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON privacy.processing_activities (tenant_id);
CREATE UNIQUE INDEX ON privacy.processing_activities (tenant_id, code);

CREATE TABLE privacy.dpias (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    activity_id                 UUID NOT NULL REFERENCES privacy.processing_activities(id) ON DELETE CASCADE,
    status                      TEXT NOT NULL CHECK (status IN ('draft','in-review','approved','retired')),
    residual_risk_severity      risk.severity NOT NULL,
    conducted_by                UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    conducted_at                TIMESTAMPTZ,
    assessment                  JSONB,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON privacy.dpias (tenant_id);
CREATE INDEX ON privacy.dpias (activity_id);
CREATE INDEX ON privacy.dpias (status);

CREATE TABLE privacy.subject_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    kind            privacy.request_kind NOT NULL,
    requester_email TEXT NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at          TIMESTAMPTZ NOT NULL,
    status          privacy.request_status NOT NULL DEFAULT 'received',
    resolved_at     TIMESTAMPTZ,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON privacy.subject_requests (tenant_id);
CREATE INDEX ON privacy.subject_requests (status);
CREATE INDEX ON privacy.subject_requests (due_at);

CREATE TABLE privacy.breaches (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    code                    TEXT NOT NULL,
    severity                risk.severity NOT NULL,
    occurred_at             TIMESTAMPTZ NOT NULL,
    detected_at             TIMESTAMPTZ NOT NULL,
    reported_at             TIMESTAMPTZ,
    affected_subjects       INT NOT NULL DEFAULT 0,
    regulator_notified      BOOLEAN NOT NULL DEFAULT FALSE,
    root_cause              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON privacy.breaches (tenant_id);
CREATE UNIQUE INDEX ON privacy.breaches (tenant_id, code);

-- =====================================================================
-- 11. esg.*
-- =====================================================================
CREATE TABLE esg.metrics (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    period          TEXT NOT NULL,                 -- e.g., '2026-Q1', 'FY2025'
    scope           TEXT NOT NULL CHECK (scope IN ('scope1','scope2','scope3')),
    category        TEXT NOT NULL,
    metric          TEXT NOT NULL,
    value           NUMERIC(18,4) NOT NULL,
    unit            TEXT NOT NULL,
    framework       TEXT NOT NULL CHECK (framework IN ('CSRD','ISSB','GHG','TCFD')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON esg.metrics (tenant_id);
CREATE INDEX ON esg.metrics (tenant_id, period);
CREATE INDEX ON esg.metrics (framework);

CREATE TABLE esg.disclosures (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    framework       TEXT NOT NULL,
    period          TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('draft','in-review','published','retired')),
    published_at    TIMESTAMPTZ,
    content         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON esg.disclosures (tenant_id);
CREATE INDEX ON esg.disclosures (framework);

CREATE TABLE esg.targets (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    framework           TEXT NOT NULL,
    metric              TEXT NOT NULL,
    baseline_value      NUMERIC(18,4) NOT NULL,
    baseline_period     TEXT NOT NULL,
    target_value        NUMERIC(18,4) NOT NULL,
    target_period       TEXT NOT NULL,
    owner_user_id       UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON esg.targets (tenant_id);

-- =====================================================================
-- 12. ai_gov.*
-- =====================================================================
CREATE TABLE ai_gov.models (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    kind                    TEXT NOT NULL CHECK (kind IN ('classifier','llm','regression','vision','recommender')),
    owner_user_id           UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    risk_tier               ai_gov.risk_tier NOT NULL,
    jurisdiction            TEXT,
    eu_ai_act_class         TEXT,
    iso_42001_status        ai_gov.iso_42001_status NOT NULL DEFAULT 'in-progress',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON ai_gov.models (tenant_id);
CREATE INDEX ON ai_gov.models (risk_tier);

CREATE TABLE ai_gov.model_risk (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    model_id        UUID NOT NULL REFERENCES ai_gov.models(id) ON DELETE CASCADE,
    risk_type       TEXT NOT NULL CHECK (risk_type IN ('bias','hallucination','drift','explainability','privacy')),
    severity        risk.severity NOT NULL,
    mitigation      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON ai_gov.model_risk (tenant_id);
CREATE INDEX ON ai_gov.model_risk (model_id);

CREATE TABLE ai_gov.prompts_audit (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    model_id            UUID REFERENCES ai_gov.models(id) ON DELETE SET NULL,
    agent_run_id        BIGINT,                       -- soft FK → agent.runs.id
    user_id             UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    prompt_redacted     TEXT NOT NULL,
    response_redacted   TEXT NOT NULL,
    tokens_in           INT NOT NULL DEFAULT 0,
    tokens_out          INT NOT NULL DEFAULT 0,
    cost_cents          INT NOT NULL DEFAULT 0,
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON ai_gov.prompts_audit (tenant_id, captured_at DESC);
CREATE INDEX ON ai_gov.prompts_audit (model_id);

-- =====================================================================
-- 13. incident.*
-- =====================================================================
CREATE TABLE incident.incidents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    code                TEXT NOT NULL,
    severity            incident.severity NOT NULL,
    title               TEXT NOT NULL,
    status              incident.status NOT NULL DEFAULT 'open',
    opened_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    contained_at        TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    owner_user_id       UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    tags                JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON incident.incidents (tenant_id);
CREATE INDEX ON incident.incidents (status);
CREATE INDEX ON incident.incidents (severity);
CREATE INDEX ON incident.incidents USING GIN (tags);
CREATE UNIQUE INDEX ON incident.incidents (tenant_id, code);

CREATE TABLE incident.timeline_events (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    incident_id     UUID NOT NULL REFERENCES incident.incidents(id) ON DELETE CASCADE,
    ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor           TEXT NOT NULL,
    event           TEXT NOT NULL,
    source          TEXT NOT NULL CHECK (source IN ('agent','human','system'))
);
CREATE INDEX ON incident.timeline_events (tenant_id);
CREATE INDEX ON incident.timeline_events (incident_id, ts);

CREATE TABLE incident.postmortems (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    incident_id                 UUID NOT NULL REFERENCES incident.incidents(id) ON DELETE CASCADE,
    root_cause_md               TEXT NOT NULL,
    corrective_actions_md       TEXT NOT NULL,
    drafted_by_agent_id         TEXT,                       -- soft FK → agent.agents.id
    signed_off_by_user_id       UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    signed_off_at               TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON incident.postmortems (tenant_id);
CREATE INDEX ON incident.postmortems (incident_id);

-- =====================================================================
-- 14. issue.*
-- =====================================================================
CREATE TABLE issue.issues (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    source          issue.source NOT NULL,
    source_id       TEXT,
    title           TEXT NOT NULL,
    description     TEXT,
    severity        risk.severity NOT NULL,
    status          issue.status NOT NULL DEFAULT 'open',
    owner_user_id   UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    due_at          TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON issue.issues (tenant_id);
CREATE INDEX ON issue.issues (status);
CREATE INDEX ON issue.issues (severity);
CREATE INDEX ON issue.issues (source);

CREATE TABLE issue.actions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    issue_id        UUID NOT NULL REFERENCES issue.issues(id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    owner_user_id   UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    due_at          TIMESTAMPTZ,
    status          TEXT NOT NULL CHECK (status IN ('not-started','in-progress','done')) DEFAULT 'not-started',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON issue.actions (tenant_id);
CREATE INDEX ON issue.actions (issue_id);

-- =====================================================================
-- 15. bcm.*
-- =====================================================================
CREATE TABLE bcm.plans (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    business_service    TEXT NOT NULL,
    owner_user_id       UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    rto_minutes         INT NOT NULL,
    rpo_minutes         INT NOT NULL,
    last_tested_at      TIMESTAMPTZ,
    next_test_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON bcm.plans (tenant_id);

CREATE TABLE bcm.bias (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    plan_id                     UUID NOT NULL REFERENCES bcm.plans(id) ON DELETE CASCADE,
    dependency_kind             TEXT NOT NULL CHECK (dependency_kind IN ('people','tech','site','vendor')),
    name                        TEXT NOT NULL,
    criticality                 vendor.criticality NOT NULL,
    downtime_tolerance_hours    INT NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON bcm.bias (tenant_id);
CREATE INDEX ON bcm.bias (plan_id);

CREATE TABLE bcm.tests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    plan_id         UUID NOT NULL REFERENCES bcm.plans(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL CHECK (kind IN ('tabletop','walkthrough','simulation','full-failover')),
    conducted_at    TIMESTAMPTZ NOT NULL,
    result          bcm.test_result NOT NULL,
    lessons_md      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON bcm.tests (tenant_id);
CREATE INDEX ON bcm.tests (plan_id);

-- bcm.scenarios is intentionally platform-global (reusable scenario
-- library). Tenants point at scenarios via test runs.
CREATE TABLE bcm.scenarios (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    severity        risk.severity NOT NULL,
    assumptions     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 16. regwatch.*
--
-- Sources (regulators) and changes are platform-global; impact
-- assessments and mappings can carry a tenant_id.
-- =====================================================================
CREATE TABLE regwatch.sources (
    id                  TEXT PRIMARY KEY,
    regulator_code      TEXT NOT NULL,                 -- MAS, APRA, EU, OJK, RBI, …
    name                TEXT NOT NULL,
    source_url          TEXT NOT NULL,
    jurisdiction        TEXT NOT NULL,
    last_scanned_at     TIMESTAMPTZ,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON regwatch.sources (regulator_code);
CREATE INDEX ON regwatch.sources (jurisdiction);

CREATE TABLE regwatch.changes (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id               TEXT NOT NULL REFERENCES regwatch.sources(id) ON DELETE CASCADE,
    title                   TEXT NOT NULL,
    summary                 TEXT,
    published_at            TIMESTAMPTZ NOT NULL,
    effective_at            TIMESTAMPTZ,
    severity                risk.severity NOT NULL,
    detected_by_agent_id    TEXT,                       -- soft FK → agent.agents.id
    raw                     JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON regwatch.changes (source_id);
CREATE INDEX ON regwatch.changes (severity);
CREATE INDEX ON regwatch.changes (published_at DESC);

CREATE TABLE regwatch.impact_assessments (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    change_id               UUID NOT NULL REFERENCES regwatch.changes(id) ON DELETE CASCADE,
    framework_id            TEXT REFERENCES compliance.frameworks(id) ON DELETE SET NULL,
    impact                  regwatch.impact NOT NULL,
    gaps_opened             INT NOT NULL DEFAULT 0,
    assessed_by_agent_id    TEXT,                       -- soft FK → agent.agents.id
    assessed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes                   TEXT
);
CREATE INDEX ON regwatch.impact_assessments (tenant_id);
CREATE INDEX ON regwatch.impact_assessments (change_id);
CREATE INDEX ON regwatch.impact_assessments (impact);

CREATE TABLE regwatch.mappings (
    id                  BIGSERIAL PRIMARY KEY,
    change_id           UUID NOT NULL REFERENCES regwatch.changes(id) ON DELETE CASCADE,
    framework_id        TEXT NOT NULL REFERENCES compliance.frameworks(id) ON DELETE CASCADE,
    requirement_id      TEXT REFERENCES compliance.requirements(id) ON DELETE SET NULL,
    action              TEXT NOT NULL CHECK (action IN ('mapped','superseded','new')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON regwatch.mappings (change_id);
CREATE INDEX ON regwatch.mappings (framework_id);

\echo ' >> privacy/esg/ai-gov/incident/issue/bcm/regwatch schemas created'

-- =====================================================================
-- 17. agent.*
--
-- agent.agents is intentionally platform-global (the fleet is shared
-- across tenants; per-tenant usage is recorded in agent.cost_ledger
-- and agent.runs which both carry tenant_id).
-- =====================================================================
CREATE TABLE agent.agents (
    id                          TEXT PRIMARY KEY,
    name                        TEXT NOT NULL,
    slug                        TEXT NOT NULL UNIQUE,
    description                 TEXT,
    type                        agent.type NOT NULL,
    status                      TEXT NOT NULL CHECK (status IN ('idle','running','paused','error')) DEFAULT 'idle',
    owner_team                  TEXT,
    cost_per_run_cents          INT NOT NULL DEFAULT 0,
    cost_monthly_estimate_cents INT NOT NULL DEFAULT 0,
    fte_equivalent              NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON agent.agents (type);
CREATE INDEX ON agent.agents (status);

CREATE TABLE agent.runs (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT REFERENCES platform.tenants(id) ON DELETE CASCADE,
    agent_id        TEXT NOT NULL REFERENCES agent.agents(id) ON DELETE CASCADE,
    trigger         agent.run_trigger NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    status          agent.run_status NOT NULL DEFAULT 'queued',
    input_summary   TEXT,
    output_summary  TEXT,
    tools_called    TEXT[] NOT NULL DEFAULT '{}',
    cost_cents      INT NOT NULL DEFAULT 0,
    latency_ms      INT,
    context         JSONB
);
CREATE INDEX ON agent.runs (tenant_id, started_at DESC);
CREATE INDEX ON agent.runs (agent_id, started_at DESC);
CREATE INDEX ON agent.runs (status);

CREATE TABLE agent.decisions (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           TEXT REFERENCES platform.tenants(id) ON DELETE CASCADE,
    agent_id            TEXT NOT NULL REFERENCES agent.agents(id) ON DELETE CASCADE,
    run_id              BIGINT NOT NULL REFERENCES agent.runs(id) ON DELETE CASCADE,
    decision_type       TEXT NOT NULL,
    input               JSONB,
    output              JSONB,
    confidence          NUMERIC(5,4),                   -- 0.0000 → 1.0000
    outcome             agent.decision_outcome NOT NULL,
    approver_user_id    UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    decided_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON agent.decisions (tenant_id);
CREATE INDEX ON agent.decisions (agent_id);
CREATE INDEX ON agent.decisions (run_id);
CREATE INDEX ON agent.decisions (outcome);

CREATE TABLE agent.approvals (
    id                  BIGSERIAL PRIMARY KEY,
    decision_id         BIGINT NOT NULL REFERENCES agent.decisions(id) ON DELETE CASCADE,
    approver_user_id    UUID NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
    approved            BOOLEAN NOT NULL,
    rationale           TEXT,
    decided_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON agent.approvals (decision_id);

CREATE TABLE agent.tools (
    id              BIGSERIAL PRIMARY KEY,
    agent_id        TEXT NOT NULL REFERENCES agent.agents(id) ON DELETE CASCADE,
    tool_name       TEXT NOT NULL,
    tool_kind       TEXT NOT NULL CHECK (tool_kind IN ('api','db','llm','search','script')),
    description     TEXT,
    UNIQUE (agent_id, tool_name)
);
CREATE INDEX ON agent.tools (agent_id);

CREATE TABLE agent.telemetry (
    id              BIGSERIAL PRIMARY KEY,
    agent_id        TEXT NOT NULL REFERENCES agent.agents(id) ON DELETE CASCADE,
    ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
    metric          TEXT NOT NULL CHECK (metric IN ('runs','errors','latency_p50','latency_p95','cost_cents')),
    value           NUMERIC(14,4) NOT NULL
);
CREATE INDEX ON agent.telemetry (agent_id, ts DESC);
CREATE INDEX ON agent.telemetry (metric);

CREATE TABLE agent.cost_ledger (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    agent_id            TEXT NOT NULL REFERENCES agent.agents(id) ON DELETE CASCADE,
    ts                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    runs                INT NOT NULL DEFAULT 0,
    cost_cents          INT NOT NULL DEFAULT 0,
    fte_saved_hours     NUMERIC(8,2) NOT NULL DEFAULT 0
);
CREATE INDEX ON agent.cost_ledger (tenant_id, ts DESC);
CREATE INDEX ON agent.cost_ledger (agent_id, ts DESC);

-- =====================================================================
-- 18. workflow.*
-- =====================================================================
CREATE TABLE workflow.definitions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    description         TEXT,
    steps               JSONB NOT NULL,                  -- [{kind, ref, label, requires_approval}, …]
    last_modified_by    UUID REFERENCES platform.users(id) ON DELETE SET NULL,
    version             INT NOT NULL DEFAULT 1,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON workflow.definitions (tenant_id);

CREATE TABLE workflow.executions (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    workflow_id         UUID NOT NULL REFERENCES workflow.definitions(id) ON DELETE CASCADE,
    trigger             TEXT NOT NULL,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at            TIMESTAMPTZ,
    status              workflow.execution_status NOT NULL DEFAULT 'running'
);
CREATE INDEX ON workflow.executions (tenant_id, started_at DESC);
CREATE INDEX ON workflow.executions (workflow_id);
CREATE INDEX ON workflow.executions (status);

CREATE TABLE workflow.steps (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    execution_id    BIGINT NOT NULL REFERENCES workflow.executions(id) ON DELETE CASCADE,
    step_no         INT NOT NULL,
    kind            workflow.step_kind NOT NULL,
    ref_id          TEXT,                                 -- e.g., agent.id, api endpoint, decision id
    status          TEXT NOT NULL DEFAULT 'pending',
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    output          JSONB,
    UNIQUE (execution_id, step_no)
);
CREATE INDEX ON workflow.steps (tenant_id);
CREATE INDEX ON workflow.steps (execution_id);

CREATE TABLE workflow.approvals (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    execution_id        BIGINT NOT NULL REFERENCES workflow.executions(id) ON DELETE CASCADE,
    step_no             INT NOT NULL,
    approver_user_id    UUID NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
    approved            BOOLEAN NOT NULL,
    decided_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON workflow.approvals (tenant_id);
CREATE INDEX ON workflow.approvals (execution_id);

-- =====================================================================
-- 19. integration.*
-- =====================================================================
CREATE TABLE integration.connectors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL,                       -- aws, azure, gcp, okta, jira, m365, servicenow, slack, github, …
    name            TEXT NOT NULL,
    status          integration.status NOT NULL DEFAULT 'connected',
    last_sync_at    TIMESTAMPTZ,
    config          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON integration.connectors (tenant_id);
CREATE INDEX ON integration.connectors (kind);
CREATE INDEX ON integration.connectors (status);

CREATE TABLE integration.sync_jobs (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    connector_id        UUID NOT NULL REFERENCES integration.connectors(id) ON DELETE CASCADE,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at            TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
    records_ingested    INT NOT NULL DEFAULT 0,
    errors              INT NOT NULL DEFAULT 0
);
CREATE INDEX ON integration.sync_jobs (tenant_id, started_at DESC);
CREATE INDEX ON integration.sync_jobs (connector_id);

-- Credential metadata only — secrets live in the secret store, not in
-- the DB. We persist key id, scope and rotation timestamp for audit.
CREATE TABLE integration.credentials_meta (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    connector_id    UUID NOT NULL REFERENCES integration.connectors(id) ON DELETE CASCADE,
    key_id          TEXT NOT NULL,
    scope           TEXT,
    rotated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON integration.credentials_meta (tenant_id);
CREATE INDEX ON integration.credentials_meta (connector_id);

-- =====================================================================
-- 20. Views (dashboards)
-- =====================================================================
CREATE OR REPLACE VIEW compliance.framework_score AS
SELECT
    a.tenant_id,
    a.framework_id,
    f.name,
    f.version,
    f.region,
    a.status,
    a.score,
    a.next_due_at
FROM compliance.assessments a
JOIN compliance.frameworks f ON f.id = a.framework_id;

CREATE OR REPLACE VIEW risk.heatmap_cells AS
SELECT
    tenant_id,
    residual_severity AS sev,
    residual_likelihood AS lik,
    COUNT(*) AS n
FROM risk.risks
GROUP BY tenant_id, residual_severity, residual_likelihood;

CREATE OR REPLACE VIEW agent.fleet_summary AS
SELECT
    a.id,
    a.name,
    a.type,
    a.status,
    COALESCE(SUM(cl.runs), 0)            AS runs_30d,
    COALESCE(SUM(cl.cost_cents), 0)      AS cost_cents_30d,
    COALESCE(SUM(cl.fte_saved_hours), 0) AS fte_hours_30d
FROM agent.agents a
LEFT JOIN agent.cost_ledger cl
    ON cl.agent_id = a.id AND cl.ts >= now() - interval '30 days'
GROUP BY a.id, a.name, a.type, a.status;

CREATE OR REPLACE VIEW vendor.tier_breakdown AS
SELECT
    tenant_id,
    tier,
    criticality,
    COUNT(*) AS n
FROM vendor.vendors
GROUP BY tenant_id, tier, criticality;

\echo ' >> agent/workflow/integration schemas + dashboard views created'
\echo ' >> NTT GRC Hub database initialisation complete.'
