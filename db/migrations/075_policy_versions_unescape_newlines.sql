-- Migration 075: Unescape literal \n sequences in policy.versions.content_md.
-- Migration 069 inserted content using SQL string literals where '\n' is stored
-- as the two characters backslash+n, not actual newline characters. The naive
-- markdown renderer in the policy detail page splits on real newlines, so all
-- formatting was lost (headings/paragraphs displayed as one collapsed block).
-- Idempotent: replace() on a string without the pattern is a no-op.

UPDATE policy.versions
SET content_md = replace(content_md, '\n', E'\n')
WHERE content_md LIKE '%\n%';
