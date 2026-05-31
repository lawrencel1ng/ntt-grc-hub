-- Migration 034: Strip seeded ID suffixes from issue and risk titles.
-- Seeded rows had " (t_tenantid #N)" or " #N" appended to titles.
-- Idempotent: regex does not match already-clean titles.

UPDATE issue.issues
SET title = trim(regexp_replace(title, '\s*\(t_\S+ #\d+\)$', ''))
WHERE title ~ '\(t_\S+ #\d+\)$';

UPDATE risk.risks
SET title = trim(regexp_replace(title, '\s*#\d+$', ''))
WHERE title ~ '#\d+$';
