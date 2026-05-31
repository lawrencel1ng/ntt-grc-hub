-- Migration 023: Add unique constraint on ai_gov.model_risk(model_id, risk_type)
-- so the assess endpoint can upsert per-risk-type rows cleanly.
ALTER TABLE ai_gov.model_risk
  ADD CONSTRAINT IF NOT EXISTS model_risk_model_type_uq UNIQUE (model_id, risk_type);
