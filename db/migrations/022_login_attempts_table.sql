-- Migration 022: Persistent login attempt tracking for brute-force protection.
-- Replaces the in-memory Map in login/+page.server.ts so rate limits survive
-- server restarts and work correctly in multi-instance deployments.

CREATE TABLE IF NOT EXISTS platform.login_attempts (
    id          BIGSERIAL PRIMARY KEY,
    ip_address  INET NOT NULL,
    email       TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_ip_ts
    ON platform.login_attempts (ip_address, attempted_at DESC);

-- Auto-purge rows older than 1 hour so the table stays small.
-- A background job or pg_cron can call this; it's also called inline on inserts.
CREATE OR REPLACE FUNCTION platform.purge_old_login_attempts() RETURNS void
    LANGUAGE sql AS $$
    DELETE FROM platform.login_attempts WHERE attempted_at < now() - interval '1 hour';
$$;
