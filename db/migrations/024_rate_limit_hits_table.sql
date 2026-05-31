-- Migration 024: DB-backed rate limiter for authenticated API routes.
-- Replaces in-process Map that reset on server restart.
CREATE TABLE IF NOT EXISTS platform.rate_limit_hits (
    id          BIGSERIAL PRIMARY KEY,
    bucket_id   TEXT NOT NULL,
    user_id     UUID NOT NULL,
    hit_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_hits_bucket_user_ts
    ON platform.rate_limit_hits (bucket_id, user_id, hit_at DESC);

CREATE OR REPLACE FUNCTION platform.purge_old_rate_limit_hits() RETURNS void
    LANGUAGE sql AS $$
    DELETE FROM platform.rate_limit_hits WHERE hit_at < now() - interval '1 hour';
$$;
