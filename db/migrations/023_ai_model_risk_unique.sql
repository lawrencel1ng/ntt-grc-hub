-- Migration 023: Add unique constraint on ai_gov.model_risk(model_id, risk_type)
-- so the assess endpoint can upsert per-risk-type rows cleanly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'model_risk_model_type_uq'
  ) THEN
    ALTER TABLE ai_gov.model_risk
      ADD CONSTRAINT model_risk_model_type_uq UNIQUE (model_id, risk_type);
  END IF;
END
$$;
