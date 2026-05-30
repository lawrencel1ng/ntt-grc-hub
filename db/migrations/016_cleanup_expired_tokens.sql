-- Migration 016: scheduled cleanup of expired sessions and reset tokens.
-- Run this periodically (e.g. nightly via pg_cron or an external cron job)
-- to prevent unbounded growth of the sessions and password_reset_tokens tables.

-- Delete sessions that expired more than 7 days ago or were revoked more than 1 day ago.
DELETE FROM platform.sessions
WHERE (expires_at < now() - interval '7 days')
   OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '1 day');

-- Delete password reset tokens that have expired or been consumed.
DELETE FROM platform.password_reset_tokens
WHERE expires_at < now() - interval '1 day'
   OR used_at IS NOT NULL;

-- Delete API tokens that expired more than 30 days ago.
DELETE FROM platform.api_tokens
WHERE expires_at IS NOT NULL AND expires_at < now() - interval '30 days';

-- (Optional) If pg_cron is available, schedule nightly cleanup:
-- SELECT cron.schedule('cleanup-expired-sessions', '0 3 * * *', $$
--   DELETE FROM platform.sessions
--   WHERE (expires_at < now() - interval '7 days')
--      OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '1 day');
--   DELETE FROM platform.password_reset_tokens
--   WHERE expires_at < now() - interval '1 day' OR used_at IS NOT NULL;
--   DELETE FROM platform.api_tokens
--   WHERE expires_at IS NOT NULL AND expires_at < now() - interval '30 days';
-- $$);
