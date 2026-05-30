-- Migration 005: Human-risk campaign tables
-- Adds phishing_campaigns and training_campaigns to the human_risk schema.

DO $$ BEGIN
  CREATE TYPE human_risk.campaign_status AS ENUM ('scheduled', 'in-progress', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE human_risk.training_status AS ENUM ('active', 'completed', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE human_risk.training_content_type AS ENUM ('video', 'interactive', 'assessment', 'policy-ack');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS human_risk.phishing_campaigns (
    id                  TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    name                TEXT NOT NULL DEFAULT '',
    template            TEXT NOT NULL DEFAULT '',
    difficulty          SMALLINT NOT NULL DEFAULT 1,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    recipients          INT NOT NULL DEFAULT 0,
    delivered           INT NOT NULL DEFAULT 0,
    opened              INT NOT NULL DEFAULT 0,
    clicked             INT NOT NULL DEFAULT 0,
    data_entered        INT NOT NULL DEFAULT 0,
    reported            INT NOT NULL DEFAULT 0,
    phish_prone_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
    status              human_risk.campaign_status NOT NULL DEFAULT 'scheduled',
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ON human_risk.phishing_campaigns (tenant_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS human_risk.training_campaigns (
    id                  TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    name                TEXT NOT NULL DEFAULT '',
    content_type        human_risk.training_content_type NOT NULL DEFAULT 'video',
    framework_ref       TEXT,
    enrolled            INT NOT NULL DEFAULT 0,
    completed           INT NOT NULL DEFAULT 0,
    completion_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
    pass_rate           NUMERIC(5,2) NOT NULL DEFAULT 0,
    due_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    status              human_risk.training_status NOT NULL DEFAULT 'active',
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ON human_risk.training_campaigns (tenant_id, due_at DESC);
