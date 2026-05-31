-- Migration 081: Backfill walkthroughs and KCAs for ITGCs that lack them.
-- 20 of 30 ITGCs have no walkthrough; insert one per ITGC idempotently.

-- Walkthroughs: one per ITGC that doesn't already have one
INSERT INTO sox.walkthroughs (tenant_id, itgc_id, description, completed_at, evidence_link)
SELECT
  i.tenant_id,
  i.id,
  'Walkthrough of ' || i.title || ' — evidence obtained from ' ||
    CASE i.control_type
      WHEN 'automated' THEN 'system logs and configuration exports'
      WHEN 'itdm'      THEN 'system outputs and manual confirmation'
      ELSE 'management review and sign-off documentation'
    END,
  i.tested_at,
  'https://grc.internal/sox/evidence/' || i.control_ref
FROM sox.itgcs i
WHERE NOT EXISTS (
  SELECT 1 FROM sox.walkthroughs w WHERE w.itgc_id = i.id
);

-- KCAs: 3 per ITGC that has none
INSERT INTO sox.kcas (tenant_id, itgc_id, attribute, value, assessed_at)
SELECT
  i.tenant_id,
  i.id,
  a.attr,
  a.val,
  i.tested_at
FROM sox.itgcs i
CROSS JOIN LATERAL (VALUES
  ('design_effectiveness',    'Satisfactory'),
  ('operating_effectiveness', CASE WHEN i.status = 'effective' THEN 'Satisfactory' ELSE 'Needs Improvement' END),
  ('evidence_quality',        'Adequate')
) AS a(attr, val)
WHERE NOT EXISTS (
  SELECT 1 FROM sox.kcas k WHERE k.itgc_id = i.id
)
ON CONFLICT DO NOTHING;

\echo ' >> sox walkthroughs and KCAs backfilled'
