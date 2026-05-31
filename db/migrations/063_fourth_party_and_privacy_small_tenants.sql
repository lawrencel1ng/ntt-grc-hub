-- Migration 063: Add fourth_party, concentration, and DPIA data for small tenants.
-- Also fixes seeded timestamps on existing fourth_parties, concentrations, dpias.
-- Idempotent: timestamp fix uses exact microsecond match; inserts use WHERE NOT EXISTS.

-- =====================================================================
-- Part 1: Fix existing timestamp artifacts
-- =====================================================================
UPDATE vendor.fourth_parties
SET created_at = '2025-11-28 01:00:00+08'::timestamptz
    + make_interval(secs => abs(hashtext(id::text)) % 15552000)
WHERE created_at::text LIKE '%00:42:44.750485%';

UPDATE vendor.concentrations
SET computed_at = now() - make_interval(days => abs(hashtext(id::text)) % 7)
WHERE computed_at::text LIKE '%00:42:44.754054%';

UPDATE privacy.dpias
SET conducted_at = now() - make_interval(days => 14 + abs(hashtext(id::text)) % 60),
    created_at   = now() - make_interval(days => 21 + abs(hashtext(id::text)) % 60)
WHERE conducted_at::text LIKE '%00:42:44.755537%';

-- =====================================================================
-- Part 2: Fourth parties for small tenants (2 per AWS vendor, 1 per GCP)
-- Uses explicit vendor UUIDs from vendor.vendors.
-- =====================================================================
INSERT INTO vendor.fourth_parties (tenant_id, vendor_id, name, type, region, criticality)
VALUES
  -- A*STAR (AWS tier-2: f17cd7d6; GCP tier-3: 7c73c9da; MSFT tier-2: b846b7be)
  ('t_astar','f17cd7d6-55ac-4de4-b9e1-96e09fcdd3ce','Cloudflare (4P of AWS)','processor','SG','medium'),
  ('t_astar','f17cd7d6-55ac-4de4-b9e1-96e09fcdd3ce','Okta (4P of AWS)','saas','US','high'),
  ('t_astar','7c73c9da-1485-4c5c-b9da-9c0f5535e44a','Twilio (4P of GCP)','cloud','US','low'),
  ('t_astar','b846b7be-756c-46f9-91b3-4e043dd71231','GitHub (4P of Microsoft)','saas','US','high'),

  -- GovTech (AWS: 6cac7a7d; MSFT: 21ed3c58; GCP: 238b0354)
  ('t_govtech','6cac7a7d-2a37-4554-a37b-9e54121ff670','Cloudflare (4P of AWS)','processor','SG','high'),
  ('t_govtech','6cac7a7d-2a37-4554-a37b-9e54121ff670','Twilio (4P of AWS)','saas','US','medium'),
  ('t_govtech','21ed3c58-cf7e-4ffe-bbfe-fb761fabc8a6','GitHub (4P of Microsoft)','saas','US','high'),
  ('t_govtech','238b0354-eb39-4b66-b422-5d36ae592571','Stripe (4P of GCP)','saas','US','low'),

  -- Mediacorp (AWS: 30fadef8; MSFT: cf421d80; GCP: f5e20498)
  ('t_mediacorp','30fadef8-33c6-4322-893d-8aea7ca70367','Cloudflare (4P of AWS)','processor','EU','medium'),
  ('t_mediacorp','30fadef8-33c6-4322-893d-8aea7ca70367','Akamai (4P of AWS)','processor','US','high'),
  ('t_mediacorp','cf421d80-a358-4be1-8520-790167e8a83b','GitHub (4P of Microsoft)','saas','US','medium'),
  ('t_mediacorp','f5e20498-463b-4a93-9463-fe3c0a29d62a','Fastly (4P of GCP)','processor','US','low'),

  -- SingHealth (AWS: f2ab4451; MSFT: cd426ae1; GCP: 5f8cf0b9)
  ('t_singhealth','f2ab4451-6910-46a0-b907-f355f058878e','Cloudflare (4P of AWS)','processor','SG','high'),
  ('t_singhealth','f2ab4451-6910-46a0-b907-f355f058878e','Okta (4P of AWS)','saas','US','high'),
  ('t_singhealth','cd426ae1-8908-4e8e-a178-d719319aa42b','GitHub (4P of Microsoft)','saas','US','medium'),
  ('t_singhealth','5f8cf0b9-5bab-4817-8a62-06921ab12dd3','Stripe (4P of GCP)','saas','US','low'),

  -- Singtel (AWS: 29cb9c63; MSFT: bf5f76a9; GCP: 62e38132)
  ('t_singtel','29cb9c63-ddda-4fea-8a03-e5c01fe48ea6','Cloudflare (4P of AWS)','processor','SG','high'),
  ('t_singtel','29cb9c63-ddda-4fea-8a03-e5c01fe48ea6','Akamai (4P of AWS)','processor','US','high'),
  ('t_singtel','bf5f76a9-f6e1-4486-9d28-78f2c7fc51d5','GitHub (4P of Microsoft)','saas','US','medium'),
  ('t_singtel','62e38132-d6e1-4732-a979-1e6a2ffa6998','Twilio (4P of GCP)','saas','US','low')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- Part 3: Concentrations for small tenants
-- =====================================================================
INSERT INTO vendor.concentrations (tenant_id, dimension, key, vendor_count, exposure_sgd)
SELECT v.tenant_id, v.dimension, v.key, v.vc, v.exp
FROM (VALUES
  ('t_astar','cloud','AWS',         3,  980000.00::numeric(14,2)),
  ('t_astar','cloud','Microsoft',   2,  540000.00::numeric(14,2)),
  ('t_astar','cloud','Google Cloud',1,  210000.00::numeric(14,2)),
  ('t_astar','region','ap-southeast-1',4, 1100000.00::numeric(14,2)),
  ('t_astar','region','US',         2,  430000.00::numeric(14,2)),
  ('t_astar','processor','Cloudflare',2, 320000.00::numeric(14,2)),

  ('t_govtech','cloud','AWS',        4, 2400000.00::numeric(14,2)),
  ('t_govtech','cloud','Microsoft',  3, 1800000.00::numeric(14,2)),
  ('t_govtech','cloud','Google Cloud',2, 850000.00::numeric(14,2)),
  ('t_govtech','region','ap-southeast-1',6, 3100000.00::numeric(14,2)),
  ('t_govtech','region','US',        3, 1200000.00::numeric(14,2)),
  ('t_govtech','processor','Cloudflare',3, 720000.00::numeric(14,2)),

  ('t_mediacorp','cloud','AWS',      3,  820000.00::numeric(14,2)),
  ('t_mediacorp','cloud','Microsoft',2,  610000.00::numeric(14,2)),
  ('t_mediacorp','cloud','Google Cloud',2, 490000.00::numeric(14,2)),
  ('t_mediacorp','region','ap-southeast-1',4, 980000.00::numeric(14,2)),
  ('t_mediacorp','region','EU',      2,  380000.00::numeric(14,2)),
  ('t_mediacorp','processor','Cloudflare',2, 290000.00::numeric(14,2)),

  ('t_singhealth','cloud','AWS',     3, 1850000.00::numeric(14,2)),
  ('t_singhealth','cloud','Microsoft',3,1420000.00::numeric(14,2)),
  ('t_singhealth','cloud','Google Cloud',2, 680000.00::numeric(14,2)),
  ('t_singhealth','region','ap-southeast-1',5,2400000.00::numeric(14,2)),
  ('t_singhealth','region','US',     2,  760000.00::numeric(14,2)),
  ('t_singhealth','processor','Cloudflare',2, 520000.00::numeric(14,2)),

  ('t_singtel','cloud','AWS',        5, 3200000.00::numeric(14,2)),
  ('t_singtel','cloud','Microsoft',  4, 2600000.00::numeric(14,2)),
  ('t_singtel','cloud','Google Cloud',3, 1400000.00::numeric(14,2)),
  ('t_singtel','region','ap-southeast-1',7, 4800000.00::numeric(14,2)),
  ('t_singtel','region','US',        4, 1900000.00::numeric(14,2)),
  ('t_singtel','processor','Cloudflare',3, 960000.00::numeric(14,2))
) AS v(tenant_id, dimension, key, vc, exp)
WHERE NOT EXISTS (
  SELECT 1 FROM vendor.concentrations c
  WHERE c.tenant_id = v.tenant_id AND c.dimension = v.dimension AND c.key = v.key
);

-- =====================================================================
-- Part 4: DPIAs for small tenants (2 per tenant — high-risk activities)
-- Links to the processing activities created in migration 059.
-- =====================================================================
INSERT INTO privacy.dpias
  (tenant_id, activity_id, status, residual_risk_severity, conducted_at, assessment, created_at)
SELECT v.tenant_id, pa.id,
  v.status,
  v.severity::risk.severity,
  now() - make_interval(days => v.days_ago),
  jsonb_build_object('mitigations', v.mitigations, 'residual_score', v.score),
  now() - make_interval(days => v.days_ago + 7)
FROM (VALUES
  ('t_astar',   'ASTAR-ROPA-001', 'approved', 'medium', 30, 3, 38),
  ('t_astar',   'ASTAR-ROPA-004', 'approved', 'high',   60, 4, 52),
  ('t_govtech', 'GTSG-ROPA-001',  'approved', 'low',    45, 5, 22),
  ('t_govtech', 'GTSG-ROPA-002',  'approved', 'medium', 90, 4, 35),
  ('t_mediacorp','MEDI-ROPA-001', 'approved', 'low',    30, 3, 28),
  ('t_mediacorp','MEDI-ROPA-002', 'in-review','medium', 15, 2, 44),
  ('t_singhealth','SHIN-ROPA-001','approved', 'medium', 25, 5, 31),
  ('t_singhealth','SHIN-ROPA-003','approved', 'high',   60, 4, 55),
  ('t_singtel', 'STEL-ROPA-001',  'approved', 'low',    35, 4, 24),
  ('t_singtel', 'STEL-ROPA-003',  'in-review','medium', 10, 3, 42)
) AS v(tenant_id, ropa_code, status, severity, days_ago, mitigations, score)
JOIN privacy.processing_activities pa
  ON pa.tenant_id = v.tenant_id AND pa.code = v.ropa_code
WHERE NOT EXISTS (
  SELECT 1 FROM privacy.dpias d
  WHERE d.tenant_id = v.tenant_id AND d.activity_id = pa.id
);
