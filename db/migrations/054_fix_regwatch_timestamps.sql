-- Migration 054: Fix RegWatch published_at timestamp clustering.
-- Many changes share the exact seed timestamp '2026-05-26 00:42:44.779215+08'.
-- Spreads them across last 60 days with per-row jitter.
-- Also spreads bcm.tests conducted_at (clustered on the same seed timestamp).
-- Idempotent: WHERE matches exact seed microsecond strings.

-- Part 1: regwatch.changes — spread published_at across last 60 days
UPDATE regwatch.changes
SET published_at = '2025-12-27 00:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 13392000)
WHERE published_at::text LIKE '%00:42:44.779215%';

-- Part 2: bcm.tests — spread conducted_at; same seed
UPDATE bcm.tests
SET conducted_at = now() - interval '180 days'
    + make_interval(secs => abs(hashtext(id::text)) % 15552000)
WHERE conducted_at::text LIKE '%00:42:44.777865%';
