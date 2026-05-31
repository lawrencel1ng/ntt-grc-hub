-- Migration 085: Push ~20% of contracts' end dates into the next 90 days
-- so the "Renewals < 90d" KPI on /vendors shows non-zero.
-- Uses hashtext for deterministic selection.

UPDATE vendor.contracts
SET ends_at = (now() + make_interval(days => abs(hashtext(id::text)) % 89 + 1))::date
WHERE abs(hashtext(id::text)) % 5 = 0;

\echo ' >> vendor contract end dates refreshed'
