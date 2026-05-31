-- Migration 050: Add per-tenant jitter to incident timestamps so incidents
-- of the same type don't all open at the exact same moment across tenants.
-- Also jitters contained_at and resolved_at by the same relative offset.
-- Idempotent: WHERE matches exact seed microsecond '.766378+08'.

UPDATE incident.incidents
SET
  opened_at    = opened_at    + make_interval(secs => abs(hashtext(id::text)) % 43200),
  contained_at = contained_at + make_interval(secs => abs(hashtext(id::text)) % 43200),
  resolved_at  = resolved_at  + make_interval(secs => abs(hashtext(id::text)) % 43200)
WHERE opened_at::text LIKE '%00:42:44.766378%';
