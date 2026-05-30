-- Migration 012: add root_cause to sox.deficiencies
ALTER TABLE sox.deficiencies
  ADD COLUMN IF NOT EXISTS root_cause TEXT;

-- Back-fill a derived root cause from existing description where absent
UPDATE sox.deficiencies
SET root_cause = 'Root cause under investigation. See description: ' || LEFT(description, 120)
WHERE root_cause IS NULL OR root_cause = '';
