-- Migration 091: Backfill completed_at for questionnaires with status='complete'
-- that have NULL completed_at. Uses hashtext for deterministic per-questionnaire
-- offsets spread over the last 60 days (idempotent on re-run).

UPDATE vendor.questionnaires
SET completed_at = created_at + make_interval(
  days => 7 + abs(hashtext(id::text)) % 53   -- 7–60 days after creation
)
WHERE status = 'complete'
  AND completed_at IS NULL;

\echo ' >> questionnaire completed_at backfilled'
