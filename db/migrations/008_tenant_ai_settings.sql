-- Migration 008: per-tenant AI provider and data residency settings.
-- Replaces hardcoded t_mindef checks in admin/settings page.

ALTER TABLE platform.tenants
  ADD COLUMN IF NOT EXISTS ai_provider TEXT NOT NULL DEFAULT 'anthropic',
  ADD COLUMN IF NOT EXISTS data_residency TEXT NOT NULL DEFAULT 'SG';
