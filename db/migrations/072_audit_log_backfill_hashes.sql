-- Migration 072: Backfill null row_hash and prev_hash in platform.audit_log.
-- 50 rows seeded without hashes cause shortHash() crash on /admin/audit.
-- Idempotent: only touches rows where row_hash IS NULL.

UPDATE platform.audit_log
SET row_hash  = LPAD(ABS(hashtext(id::text || action || COALESCE(actor_email, '')))::bigint::bit(64)::text, 16, '0'),
    prev_hash = COALESCE(prev_hash, '0000000000000000')
WHERE row_hash IS NULL;
