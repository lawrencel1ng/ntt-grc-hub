-- Migration 083: AI Governance enhancements.
-- 1. Add NTT Tsuzumi sovereign LLM models for the hero MINDEF/GovTech story.
-- 2. Refresh ai_gov.prompts_audit timestamps so "Prompts (24h)" KPI is non-zero.

-- Add Tsuzumi sovereign LLM models for MINDEF (sovereign LLM story) and GovTech
INSERT INTO ai_gov.models (
  tenant_id, name, kind, risk_tier, jurisdiction,
  eu_ai_act_class, iso_42001_status, training_data_summary
)
VALUES
  ('t_mindef',  'NTT Tsuzumi-Sovereign Defence LLM',  'llm', 'high',    'Singapore',
   'high-risk', 'compliant',
   'Fine-tuned on declassified military doctrines and SOPs; air-gapped training on sovereign infrastructure.'),
  ('t_govtech', 'NTT Tsuzumi-SG Government Assistant', 'llm', 'limited', 'Singapore',
   'limited-risk', 'compliant',
   'Trained on Singapore government policy corpus; deployed on GovTech NDI infrastructure.')
ON CONFLICT DO NOTHING;

-- Refresh ai_gov.prompts_audit: push latest 500 entries into last 48 hours
WITH latest AS (
  SELECT id
  FROM ai_gov.prompts_audit
  ORDER BY captured_at DESC
  LIMIT 500
)
UPDATE ai_gov.prompts_audit pa
SET captured_at = now() - make_interval(secs => abs(hashtext(pa.id::text)) % 172800)
FROM latest l
WHERE pa.id = l.id;

\echo ' >> AI gov Tsuzumi models added, prompts refreshed'
