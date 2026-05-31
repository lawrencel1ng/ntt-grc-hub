-- Migration 037: Strip seeded #N suffixes from evidence item titles.
-- Idempotent: regex does not match already-clean titles.

UPDATE evidence.items
SET title = trim(regexp_replace(title, '\s*#\d+$', ''))
WHERE title ~ '#\d+$';
