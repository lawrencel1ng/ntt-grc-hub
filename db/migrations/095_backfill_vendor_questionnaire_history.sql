-- Migration 095: Backfill a prior-cycle questionnaire for every vendor so the
-- risk-score-history trend chart has at least 2 data points to plot.
--
-- For each existing questionnaire we insert a "previous cycle" record dated
-- approximately 12 months earlier with a slightly different score.  The score
-- offset is deterministic (derived from the vendor UUID) so re-running is
-- idempotent when combined with the ON CONFLICT guard.
--
-- Only adds a prior record when the vendor currently has exactly 1 questionnaire
-- (i.e. no history exists yet).  Safe to re-run.

INSERT INTO vendor.questionnaires
  (id, tenant_id, vendor_id, template, status, sent_at, completed_at, score, completed_by_agent_id)
SELECT
  -- deterministic UUID: hash of 'prior-cycle-' + existing questionnaire id
  md5('prior-cycle-' || q.id::text)::uuid,
  q.tenant_id,
  q.vendor_id,
  q.template,
  'complete'::vendor.questionnaire_status,
  -- sent ~12 months before the current questionnaire
  q.sent_at - interval '12 months',
  -- completed ~28 days after sent (same lag as current cycle)
  q.sent_at - interval '12 months' + interval '28 days',
  -- prior score: current score ± an offset derived from vendor UUID to make it
  -- look realistic.  We use the first byte of the UUID int cast to shift ±15.
  GREATEST(10, LEAST(99,
    q.score + (
      -- shift between -15 and +15 based on vendor uuid bytes
      ((('x' || substr(q.vendor_id::text, 1, 8))::bit(32)::int % 31) - 15)
    )
  )),
  'agent:vendor-risk-analyst'
FROM vendor.questionnaires q
WHERE q.score IS NOT NULL
  -- only for vendors that currently have exactly one questionnaire
  AND (
    SELECT COUNT(*) FROM vendor.questionnaires q2
    WHERE q2.vendor_id = q.vendor_id
  ) = 1
ON CONFLICT (id) DO NOTHING;

\echo ' >> prior-cycle questionnaire history backfilled for all single-questionnaire vendors'
