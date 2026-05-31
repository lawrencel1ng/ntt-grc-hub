-- Migration 073: Link control.mappings rows to real compliance.requirements.
-- All 20,100 mappings were seeded with requirement_id = NULL, causing the
-- control detail page to display "FRAMEWORK-???" placeholder codes.
-- Assigns each mapping a deterministic requirement from the correct framework
-- using hashtext modular selection. Idempotent: only touches NULL rows.

UPDATE control.mappings cm
SET requirement_id = req.req_id
FROM (
  -- For each mapping, pick a requirement from the same framework
  -- using hashtext(control_id || framework_id) mod N for determinism.
  SELECT
    cm2.id AS mapping_id,
    (
      SELECT r.id
      FROM compliance.requirements r
      WHERE r.framework_id = cm2.framework_id
      ORDER BY r.code
      LIMIT 1
      OFFSET (ABS(hashtext(cm2.control_id || cm2.framework_id)) %
        GREATEST(1, (SELECT COUNT(*) FROM compliance.requirements r2 WHERE r2.framework_id = cm2.framework_id)::int))
    ) AS req_id
  FROM control.mappings cm2
  WHERE cm2.requirement_id IS NULL
    AND EXISTS (
      SELECT 1 FROM compliance.requirements r WHERE r.framework_id = cm2.framework_id
    )
) req
WHERE cm.id = req.mapping_id
  AND req.req_id IS NOT NULL;
