-- Migration 096: Backfill cloud-type fourth-party entries for tenants that only
-- have saas/processor entries.  Adds one cloud sub-processor per vendor for
-- tenants where COUNT(type='cloud') = 0.  Follows the naming convention already
-- used by t_grab: "<CloudSvc> (4P of <vendor>)".
--
-- Cloud sub-processor assigned per vendor based on vendor category:
--   hardware/networking → AWS (cloud provider used for management plane)
--   saas/software       → Twilio (cloud comms/auth sub-processor)
--   security            → Azure (cloud SIEM/SOC integration)
--   data-platform       → Snowflake (cloud data warehouse sub-processor)
--   default             → AWS
--
-- Only inserts where no cloud-type entry already exists for that vendor.
-- ON CONFLICT guard makes it idempotent.

INSERT INTO vendor.fourth_parties (tenant_id, vendor_id, name, type, region, criticality)
SELECT
  fp.tenant_id,
  fp.vendor_id,
  CASE
    WHEN v.category IN ('hardware', 'networking') THEN 'AWS (4P of ' || v.name || ')'
    WHEN v.category IN ('saas', 'software')        THEN 'Twilio (4P of ' || v.name || ')'
    WHEN v.category IN ('security')                THEN 'Azure (4P of ' || v.name || ')'
    WHEN v.category IN ('data-platform', 'analytics') THEN 'Snowflake (4P of ' || v.name || ')'
    ELSE 'AWS (4P of ' || v.name || ')'
  END,
  'cloud',
  CASE WHEN v.hq_country IN ('SG', 'MY', 'ID', 'TH', 'PH') THEN 'ap-southeast-1' ELSE 'us-east-1' END,
  (CASE WHEN v.tier = '1'::vendor.tier AND v.criticality = 'critical'::vendor.criticality THEN 'high'
        WHEN v.tier = '1'::vendor.tier                                                    THEN 'medium'
        ELSE 'low'
   END)::vendor.criticality
FROM vendor.fourth_parties fp
JOIN vendor.vendors v ON v.id = fp.vendor_id
WHERE fp.type = 'saas'   -- one cloud entry per vendor (piggyback on saas rows)
  AND NOT EXISTS (
    SELECT 1 FROM vendor.fourth_parties ex
    WHERE ex.tenant_id = fp.tenant_id
      AND ex.vendor_id = fp.vendor_id
      AND ex.type = 'cloud'
  )
ON CONFLICT DO NOTHING;

\echo ' >> cloud-type fourth-party entries backfilled for tenants with none'
