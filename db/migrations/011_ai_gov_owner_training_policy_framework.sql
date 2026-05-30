-- =====================================================================
--  011 — AI Gov: owner + training data; Policy-framework mapping table
-- =====================================================================

-- 1. Training data summary column on ai_gov.models
ALTER TABLE ai_gov.models
  ADD COLUMN IF NOT EXISTS training_data_summary TEXT;

-- 2. Back-fill training data per kind
UPDATE ai_gov.models SET training_data_summary = CASE kind
  WHEN 'classifier'  THEN
    '4.2M labelled transactions (2022–2025) · 89/11 train/holdout · stratified by jurisdiction. Class balance: pos 6.4% / neg 93.6%.'
  WHEN 'llm' THEN
    'Fine-tuned on 18M proprietary support tickets + sanitised customer-chat transcripts (PII redacted). Base: sovereign LLM (NTT Tsuzumi, on-prem).'
  WHEN 'regression' THEN
    '12-year loan-performance panel, 380K accounts, 47 features. Time-aware CV with quarterly walk-forward validation.'
  WHEN 'vision' THEN
    '320K KYC document images (ID, passport, utility bill). Synthetic augmentations: rotation, lighting, occlusion. Annotated by certified third-party.'
  WHEN 'recommender' THEN
    '5.8M user-product interactions (90d window). Implicit feedback via SASRec architecture. Cold-start handled by content embeddings.'
  ELSE NULL
END
WHERE training_data_summary IS NULL;

-- 3. Assign owner_user_id → tenant risk-owner (where unset)
UPDATE ai_gov.models m
SET owner_user_id = (
  SELECT id FROM platform.users u
  WHERE u.tenant_id = m.tenant_id AND u.role = 'risk-owner'
  LIMIT 1
)
WHERE owner_user_id IS NULL;

-- =====================================================================
-- 4. Policy–framework mapping table
-- =====================================================================
CREATE TABLE IF NOT EXISTS policy.document_frameworks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id  UUID NOT NULL REFERENCES policy.documents(id) ON DELETE CASCADE,
  framework_id TEXT NOT NULL REFERENCES compliance.frameworks(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, framework_id)
);
CREATE INDEX IF NOT EXISTS policy_doc_fwk_doc_idx ON policy.document_frameworks (document_id);

-- 5. Seed keyword-derived mappings for existing policy documents
--    (mirrors the JS heuristic that was in +page.svelte)
INSERT INTO policy.document_frameworks (document_id, framework_id)
SELECT DISTINCT d.id, f.id
FROM policy.documents d
JOIN compliance.frameworks f ON (
    (lower(d.title) ~ '(security|access|cryptography)' AND f.id IN ('iso-27001','soc2'))
 OR (lower(d.title) LIKE '%outsourcing%'                AND f.id IN ('mas-notice-655','mas-trm'))
 OR (lower(d.title) LIKE '%privacy%'                    AND f.id IN ('gdpr','pdpa-sg'))
 OR (lower(d.title) ~ '\bai\b'                          AND f.id IN ('eu-ai-act','iso-42001'))
 OR (lower(d.title) ~ '(continuity|backup)'             AND f.id = 'iso-22301')
 OR (lower(d.title) LIKE '%esg%'                        AND f.id IN ('csrd','issb-s1-s2'))
)
ON CONFLICT DO NOTHING;

-- Fallback: any doc with no mapping gets iso-27001
INSERT INTO policy.document_frameworks (document_id, framework_id)
SELECT d.id, 'iso-27001'
FROM policy.documents d
WHERE NOT EXISTS (
  SELECT 1 FROM policy.document_frameworks df WHERE df.document_id = d.id
)
ON CONFLICT DO NOTHING;
