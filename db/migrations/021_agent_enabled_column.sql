-- Migration 021: Add enabled column to agent.agents
-- Several API endpoints filter on enabled=true or guard against disabled agents,
-- but the column was missing from the original schema.

ALTER TABLE agent.agents
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;

-- Default all existing agents to enabled so behaviour is unchanged for
-- existing deployments. Operators can disable individual agents via the UI.
UPDATE agent.agents SET enabled = true WHERE enabled IS NULL;
