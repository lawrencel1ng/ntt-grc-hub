-- Migration 084: Add model risk records for the two NTT Tsuzumi sovereign LLMs.
-- The models were added in 083 but had zero risks, making their detail pages empty.

INSERT INTO ai_gov.model_risk (tenant_id, model_id, risk_type, severity, mitigation)
SELECT m.tenant_id, m.id, v.risk_type, v.severity::risk.severity, v.mitigation
FROM ai_gov.models m
CROSS JOIN LATERAL (VALUES
  -- NTT Tsuzumi-Sovereign Defence LLM (high risk — military domain)
  ('t_mindef', 'hallucination', 'critical',
   'All outputs subject to human-in-the-loop review before operational use; red-team adversarial testing quarterly.'),
  ('t_mindef', 'bias',         'high',
   'Bias audits against declassified doctrine corpus; fairness constraints enforced during fine-tuning.'),
  ('t_mindef', 'privacy',      'high',
   'Air-gapped inference environment; no PII in training set; output redaction pipeline for sensitive identifiers.'),
  ('t_mindef', 'explainability','medium',
   'Chain-of-thought logging enabled; decision rationale surfaced to operators via XAI dashboard.'),
  -- NTT Tsuzumi-SG Government Assistant (limited risk — citizen services)
  ('t_govtech', 'hallucination','medium',
   'Retrieval-augmented generation over authoritative GovTech policy corpus; confidence threshold guardrails.'),
  ('t_govtech', 'bias',         'low',
   'Quarterly demographic parity audits across SG language groups (English, Mandarin, Malay, Tamil).'),
  ('t_govtech', 'privacy',      'medium',
   'NDI data residency enforced; MyInfo fields scrubbed before model context; PDPA-compliant logging.')
) AS v(tid, risk_type, severity, mitigation)
WHERE m.tenant_id = v.tid
  AND m.name ILIKE '%tsuzumi%'
ON CONFLICT (model_id, risk_type) DO NOTHING;

\echo ' >> Tsuzumi model risks inserted'
