-- Migration 076: Unescape literal \n sequences in all seeded long-text columns.
-- Migration 069 (and related seeds) inserted content using SQL string literals
-- where '\n' stores two characters (backslash+n) rather than a real newline.
-- This affects every column used for multi-line display in the UI.
-- Idempotent: replace() on strings without the pattern is a no-op.

UPDATE bcm.plans
SET description      = replace(description,      '\n', E'\n'),
    recovery_strategy = replace(recovery_strategy, '\n', E'\n')
WHERE description LIKE '%\n%' OR recovery_strategy LIKE '%\n%';

UPDATE bcm.scenarios
SET description = replace(description, '\n', E'\n')
WHERE description LIKE '%\n%';

UPDATE bcm.tests
SET lessons_md = replace(lessons_md, '\n', E'\n')
WHERE lessons_md LIKE '%\n%';

UPDATE audit.findings
SET description = replace(description, '\n', E'\n')
WHERE description LIKE '%\n%';

UPDATE audit.workpapers
SET content_md = replace(content_md, '\n', E'\n')
WHERE content_md LIKE '%\n%';

UPDATE compliance.requirements
SET description = replace(description, '\n', E'\n')
WHERE description LIKE '%\n%';

UPDATE control.library
SET description = replace(description, '\n', E'\n')
WHERE description LIKE '%\n%';

UPDATE control.tests
SET procedure_md = replace(procedure_md, '\n', E'\n')
WHERE procedure_md LIKE '%\n%';

UPDATE ai_gov.model_risk
SET mitigation = replace(mitigation, '\n', E'\n')
WHERE mitigation LIKE '%\n%';
