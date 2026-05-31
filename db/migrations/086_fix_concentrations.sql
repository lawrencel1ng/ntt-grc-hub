-- Migration 086: Recompute vendor.concentrations from actual fourth_party data.
-- Previous seed had MINDEF/Singtel/small tenants inheriting Grab's raw vendor_count
-- values (22, 18, 9…) making concentration percentages exceed 100%.
-- We now derive vendor_count from fourth_parties.vendor_id counts per tenant.

-- Step 1: clear old synthetic data
DELETE FROM vendor.concentrations;

-- Step 2: aggregate from fourth_parties + contracts for exposure.
-- "cloud" dimension: bucket by cloud provider name parsed from fp name.
-- "processor" dimension: bucket by processor name.
-- "region" dimension: bucket by region code.
-- We use a cleaned fp name (strip " (4P of …)" suffix) as the key.

WITH fp_flat AS (
  SELECT
    fp.tenant_id,
    fp.type                              AS dimension_raw,
    -- key: for cloud/processor use the root name; for saas treat as processor;
    -- for region dim use region code
    CASE
      WHEN fp.type IN ('cloud', 'saas', 'processor')
        THEN regexp_replace(fp.name, ' \(4P of .*\)$', '')
      ELSE fp.region
    END                                  AS key_name,
    fp.region                            AS region_code,
    fp.vendor_id
  FROM vendor.fourth_parties fp
),
-- Compute per-tenant vendor_count per (dimension, key)
agg_cloud AS (
  SELECT tenant_id,
         'cloud'::text   AS dimension,
         CASE key_name
           WHEN 'Twilio' THEN 'AWS'       -- Twilio runs on AWS infra in APAC
           ELSE key_name
         END            AS key,
         COUNT(DISTINCT vendor_id)::int  AS vendor_count
  FROM fp_flat
  WHERE dimension_raw = 'cloud'
  GROUP BY tenant_id, key
),
agg_processor AS (
  SELECT tenant_id,
         'processor'::text AS dimension,
         key_name          AS key,
         COUNT(DISTINCT vendor_id)::int AS vendor_count
  FROM fp_flat
  WHERE dimension_raw IN ('processor', 'saas')
  GROUP BY tenant_id, key_name
),
agg_region AS (
  SELECT tenant_id,
         'region'::text    AS dimension,
         CASE region_code
           WHEN 'US' THEN 'us-east-1'
           WHEN 'EU' THEN 'eu-west-1'
           WHEN 'SG' THEN 'ap-southeast-1'
           WHEN 'MY' THEN 'ap-southeast-3'
           ELSE region_code
         END               AS key,
         COUNT(DISTINCT vendor_id)::int AS vendor_count
  FROM fp_flat
  GROUP BY tenant_id, region_code
),
unioned AS (
  SELECT * FROM agg_cloud
  UNION ALL
  SELECT * FROM agg_processor
  UNION ALL
  SELECT * FROM agg_region
),
-- Estimate exposure by joining with contracts
with_exposure AS (
  SELECT
    u.tenant_id,
    u.dimension,
    u.key,
    u.vendor_count,
    COALESCE(
      (
        SELECT SUM(c.value_sgd)
        FROM vendor.contracts c
        JOIN vendor.fourth_parties fp2
          ON fp2.vendor_id = c.vendor_id AND fp2.tenant_id = u.tenant_id
        WHERE c.tenant_id = u.tenant_id
          AND regexp_replace(fp2.name, ' \(4P of .*\)$', '') = u.key
        LIMIT 1
      ),
      u.vendor_count::numeric * 150000   -- fallback: ~SGD 150k per vendor
    )::numeric(14,2) AS exposure_sgd
  FROM unioned u
  WHERE u.vendor_count > 0
)
INSERT INTO vendor.concentrations (tenant_id, dimension, key, vendor_count, exposure_sgd)
SELECT tenant_id, dimension, key, vendor_count, exposure_sgd
FROM with_exposure
WHERE vendor_count > 0
ON CONFLICT DO NOTHING;

\echo ' >> vendor concentrations recomputed from fourth_party data'
