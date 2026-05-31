-- Migration 042: Fix identical text in ai_gov tables.
--   1. ai_gov.model_risk mitigation — all 36 rows had same text regardless of risk_type
--   2. ai_gov.prompts_audit response_redacted — 594 rows had single identical response
-- Idempotent: WHERE clauses match original placeholder values only.

-- =============================================================================
-- Part 1: ai_gov.model_risk — risk_type-specific mitigations
-- =============================================================================

UPDATE ai_gov.model_risk
SET mitigation = CASE risk_type
  WHEN 'drift'
    THEN (ARRAY[
      'Monitor PSI and KS statistics monthly; trigger automated retraining when drift exceeds 0.2 threshold. Schedule full recalibration quarterly using refreshed production data.',
      'Track feature distribution drift via Evidently dashboard. Alert Model Risk Officer when PSI > 0.15. Perform targeted feature recalibration within 30 days of alert.',
      'Deploy shadow model alongside production model to detect performance divergence. Retrain production model when shadow model AUC exceeds production by >3%. Quarterly model card refresh.',
      'Implement automated drift gate in CI/CD pipeline: block model promotion if holdout AUC degrades >5% from baseline. Monthly drift report to Model Risk Committee.'
    ])[abs(hashtext(id::text)) % 4 + 1]
  WHEN 'hallucination'
    THEN (ARRAY[
      'Implement retrieval-augmented generation grounded in verified regulatory source library. Enforce human review gate for all regulatory and compliance outputs. Require citations in response template.',
      'Deploy output validation layer: flag responses citing unverifiable sources. Route flagged outputs to human review queue. Monthly hallucination rate reported to AI Governance Committee.',
      'Restrict model temperature to 0.1 for compliance-use prompts. Add self-consistency check via majority-vote sampling on critical queries. Maintain human-in-the-loop for board-level outputs.',
      'Implement structured output schema with required citation fields. Automated verifier agent checks citations against indexed regulatory sources before delivery to end users.'
    ])[abs(hashtext(id::text)) % 4 + 1]
  WHEN 'bias'
    THEN (ARRAY[
      'Run quarterly SHAP-based fairness audit across protected attributes (age, gender, jurisdiction). Retrain with fairness constraint if disparate impact ratio falls below 0.8.',
      'Implement counterfactual fairness testing at each model release gate. Assign Fairness Officer as named reviewer. Publish bias scorecard in AI Governance module quarterly.',
      'Deploy intersectional bias monitoring for credit and eligibility models. Alert when demographic parity gap exceeds 5 percentage points. Board-level disclosure in annual AI governance report.'
    ])[abs(hashtext(id::text)) % 3 + 1]
  WHEN 'explainability'
    THEN (ARRAY[
      'Provide LIME/SHAP explanations for all adverse credit decisions. Store explanation artefacts in evidence vault for regulatory review. Validate explanations against model logic quarterly.',
      'Implement model card with feature importance rankings. Require explainability layer for all customer-facing AI decisions. Conduct annual explainability audit with independent model validator.',
      'Deploy SHAP force plots for high-impact decisions. Assign explanation accuracy threshold (fidelity > 0.85). Explanations reviewed by CISO and DPO for MAS FEAT compliance.'
    ])[abs(hashtext(id::text)) % 3 + 1]
  WHEN 'privacy'
    THEN (ARRAY[
      'Conduct DPIA for all models processing personal data. Implement differential privacy for models trained on customer PII. Restrict training data to minimum necessary under PDPA data minimisation principle.',
      'Deploy federated learning where model training on customer data is required. Enforce data anonymisation pipeline before any model training job runs. Annual privacy audit of AI data flows.',
      'Apply k-anonymity (k≥5) to all training data sets. Store model artefacts in encrypted model registry with access-controlled audit trail. PDPA DPIA review at each major model version release.'
    ])[abs(hashtext(id::text)) % 3 + 1]
  ELSE 'Quarterly review; SHAP analysis; HITL on edge cases.'
END
WHERE mitigation = 'Quarterly review; SHAP analysis; HITL on edge cases.';

-- =============================================================================
-- Part 2: ai_gov.prompts_audit — prompt-type-specific responses
-- =============================================================================

UPDATE ai_gov.prompts_audit
SET response_redacted = CASE
  WHEN prompt_redacted = '[REDACTED] customer asked about balance'
    THEN (ARRAY[
      '[REDACTED] current balance confirmed with account summary and available credit line',
      '[REDACTED] balance displayed with last transaction date and pending items noted',
      '[REDACTED] account balance shown; low balance warning triggered with suggested action',
      '[REDACTED] balance confirmed; multi-currency holdings summarised in SGD equivalent'
    ])[abs(hashtext(id::text)) % 4 + 1]
  WHEN prompt_redacted = '[REDACTED] customer asked about transfer fees'
    THEN (ARRAY[
      '[REDACTED] fee schedule provided for local FAST, GIRO, and overseas SWIFT transfers',
      '[REDACTED] applicable fee confirmed for requested transfer amount and destination country',
      '[REDACTED] fee waiver eligibility checked against account tier; waiver applied',
      '[REDACTED] transfer fee breakdown shown with FX rate and total debit amount'
    ])[abs(hashtext(id::text)) % 4 + 1]
  WHEN prompt_redacted = '[REDACTED] customer asked about dispute'
    THEN (ARRAY[
      '[REDACTED] dispute case opened; case reference provided with 10-business-day resolution timeline',
      '[REDACTED] transaction disputed; provisional credit applied pending investigation',
      '[REDACTED] dispute escalated to fraud team; customer advised of chargeback process',
      '[REDACTED] dispute acknowledged; supporting documentation requested from customer'
    ])[abs(hashtext(id::text)) % 4 + 1]
  WHEN prompt_redacted = '[REDACTED] customer asked about interest rate'
    THEN (ARRAY[
      '[REDACTED] current savings rate and applicable tier confirmed for account balance band',
      '[REDACTED] loan interest rate provided with EIR and repayment schedule breakdown',
      '[REDACTED] rate change effective date confirmed; customer notified of adjustment rationale',
      '[REDACTED] promotional rate eligibility checked; customer qualified for bonus interest tier'
    ])[abs(hashtext(id::text)) % 4 + 1]
  WHEN prompt_redacted = '[REDACTED] customer asked about statement'
    THEN (ARRAY[
      '[REDACTED] e-statement for requested period generated and link sent to registered email',
      '[REDACTED] statement download link provided; retention period confirmed as 7 years',
      '[REDACTED] combined statement across linked accounts generated for requested date range',
      '[REDACTED] statement format confirmed; PDF and CSV options offered to customer'
    ])[abs(hashtext(id::text)) % 4 + 1]
  ELSE response_redacted
END
WHERE response_redacted = '[REDACTED] response with explanation and CTA';
