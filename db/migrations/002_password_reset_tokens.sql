-- Migration 002: password reset tokens table
-- Run once against any existing database:
--   psql $DATABASE_URL -f db/migrations/002_password_reset_tokens.sql

CREATE TABLE IF NOT EXISTS platform.password_reset_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL,
    token_prefix    VARCHAR(64),
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS prt_token_prefix_idx
  ON platform.password_reset_tokens (token_prefix)
  WHERE token_prefix IS NOT NULL;

CREATE INDEX IF NOT EXISTS ON platform.password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS ON platform.password_reset_tokens (expires_at);
