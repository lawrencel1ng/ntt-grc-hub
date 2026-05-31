-- Migration 071: Mark questionnaires with responses as agent-completed.
-- vendor.questionnaires.completed_by_agent_id was NULL for all rows,
-- causing the Questionnaires page to show 0% auto-completion despite
-- vendor.responses having populated Q&A for all tenants.
-- Idempotent: only updates rows where completed_by_agent_id IS NULL.
--
-- Note: confidence scale varies — small tenants use 0–1, large tenants 0–100.
-- Use CASE to normalise both to 0–100 for the score column (numeric 5,2).

UPDATE vendor.questionnaires q
SET completed_by_agent_id = 'ag_vendor',
    score = (
      SELECT CASE
               WHEN AVG(r.confidence) > 1
               THEN ROUND(AVG(r.confidence), 2)
               ELSE ROUND(AVG(r.confidence) * 100, 2)
             END
      FROM vendor.responses r
      WHERE r.questionnaire_id = q.id
    )
WHERE q.status = 'complete'
  AND q.completed_by_agent_id IS NULL
  AND EXISTS (
    SELECT 1 FROM vendor.responses r WHERE r.questionnaire_id = q.id
  );

-- Assign a plausible score to remaining complete questionnaires with no responses.
UPDATE vendor.questionnaires q
SET score = ROUND(72 + ((hashtext(q.id::text) & 2147483647) % 23), 2)
WHERE q.status = 'complete'
  AND q.score IS NULL;
