-- Migration 090: Set ai_provider to 'tsuzumi' for MINDEF and GovTech tenants.
-- These tenants have the NTT Tsuzumi sovereign LLMs (added in migration 083/084),
-- so their board narrative and AI assessments should route via the Tsuzumi
-- endpoint when TSUZUMI_API_KEY is configured; they fall back to the template
-- narrative when the key is absent (same graceful-degradation pattern as
-- Anthropic/OpenAI).

UPDATE platform.tenants
SET ai_provider = 'tsuzumi'
WHERE id IN ('t_mindef', 't_govtech');

\echo ' >> MINDEF and GovTech ai_provider set to tsuzumi'
