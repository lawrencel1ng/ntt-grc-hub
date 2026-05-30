-- Migration 001: add token_prefix to platform.sessions for O(1) lookup
-- Run once against any existing database:
--   psql $DATABASE_URL -f db/migrations/001_session_token_prefix.sql
--
-- Before this migration validateSession iterated ≤50 rows doing bcrypt.compare
-- on each. token_prefix is the first 32 hex chars of SHA-256(token), stored
-- with a unique index so we can do an indexed point-lookup first, then verify
-- the full bcrypt hash against a single row.
--
-- Existing sessions without a prefix are excluded by the WHERE clause in
-- validateSession and will expire naturally (SESSION_TTL_DAYS = 7).

ALTER TABLE platform.sessions
  ADD COLUMN IF NOT EXISTS token_prefix VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_prefix_idx
  ON platform.sessions (token_prefix)
  WHERE token_prefix IS NOT NULL;
