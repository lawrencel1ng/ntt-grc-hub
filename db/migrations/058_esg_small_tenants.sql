-- Migration 058: Add ESG metrics, disclosures, and targets for 5 small tenants.
-- Grab, Maybank, MINDEF have 60 metrics each; small tenants have none.
-- Adds 12 metric types × 5 periods = 60 rows per tenant, plus
-- 4 disclosures and 2 targets each.
-- Idempotent: INSERT WHERE NOT EXISTS.

-- =====================================================================
-- Part 1: ESG metrics (12 types × 5 periods per tenant)
-- =====================================================================
INSERT INTO esg.metrics (tenant_id, period, scope, category, metric, value, unit, framework)
SELECT t.tenant_id, p.period, v.scope, v.category, v.metric,
       round(
         (v.base + abs(hashtext(t.tenant_id || v.framework || v.category || p.period)) % v.range)
         * (1 + (abs(hashtext(t.tenant_id || p.period || v.metric)) % 10 - 5) * 0.02),
         4)::numeric(18,4),
       v.unit,
       v.framework
FROM (VALUES
  -- CSRD metrics
  ('scope1','procurement','SaaS spend',  'CSRD', 50000, 40000, 'SGD'),
  ('scope2','travel',     'tCO2e emitted','CSRD', 20,   40,    'tCO2e'),
  ('scope3','energy',     'kWh consumed','CSRD', 80000, 60000, 'kWh'),
  -- GHG metrics
  ('scope1','cloud-compute','litres-of-fuel','GHG', 50, 100, 'L'),
  ('scope2','procurement','SaaS spend',   'GHG', 30000, 30000, 'SGD'),
  ('scope3','data-centre','GB egress',    'GHG', 2000, 3000,  'GB'),
  -- ISSB metrics
  ('scope1','travel',      'tCO2e emitted','ISSB', 15, 30,   'tCO2e'),
  ('scope2','energy',      'kWh consumed','ISSB', 60000, 50000,'kWh'),
  ('scope3','cloud-compute','litres-of-fuel','ISSB',40, 80,  'L'),
  -- TCFD metrics
  ('scope1','data-centre','GB egress',    'TCFD', 1500, 2000, 'GB'),
  ('scope2','cloud-compute','litres-of-fuel','TCFD',30, 60,  'L'),
  ('scope3','travel',      'tCO2e emitted','TCFD',10, 20,    'tCO2e')
) AS v(scope, category, metric, framework, base, range, unit)
CROSS JOIN (VALUES
  ('t_astar'),('t_govtech'),('t_mediacorp'),('t_singhealth'),('t_singtel')
) AS t(tenant_id)
CROSS JOIN (VALUES
  ('2025-Q1'),('2025-Q2'),('2025-Q3'),('2025-Q4'),('2026-Q1')
) AS p(period)
WHERE NOT EXISTS (
  SELECT 1 FROM esg.metrics m
  WHERE m.tenant_id = t.tenant_id
    AND m.framework  = v.framework
    AND m.category   = v.category
    AND m.period     = p.period
);

-- =====================================================================
-- Part 2: ESG disclosures (4 per tenant — one per framework)
-- =====================================================================
INSERT INTO esg.disclosures (tenant_id, framework, period, status, published_at, content)
SELECT v.tenant_id, v.framework, '2025', v.status,
  CASE WHEN v.status = 'published'
       THEN now() - make_interval(days => abs(hashtext(v.tenant_id || v.framework)) % 90)
       ELSE NULL
  END,
  '{}'::jsonb
FROM (VALUES
  ('t_astar',    'CSRD','published'), ('t_astar',    'ISSB','published'),
  ('t_astar',    'GHG', 'in-review'), ('t_astar',    'TCFD','draft'),
  ('t_govtech',  'CSRD','published'), ('t_govtech',  'ISSB','published'),
  ('t_govtech',  'GHG', 'published'), ('t_govtech',  'TCFD','in-review'),
  ('t_mediacorp','CSRD','published'), ('t_mediacorp','ISSB','in-review'),
  ('t_mediacorp','GHG', 'draft'),     ('t_mediacorp','TCFD','draft'),
  ('t_singhealth','CSRD','published'),('t_singhealth','ISSB','published'),
  ('t_singhealth','GHG', 'in-review'),('t_singhealth','TCFD','draft'),
  ('t_singtel',  'CSRD','published'), ('t_singtel',  'ISSB','published'),
  ('t_singtel',  'GHG', 'published'), ('t_singtel',  'TCFD','in-review')
) AS v(tenant_id, framework, status)
WHERE NOT EXISTS (
  SELECT 1 FROM esg.disclosures d
  WHERE d.tenant_id = v.tenant_id AND d.framework = v.framework AND d.period = '2025'
);

-- =====================================================================
-- Part 3: ESG targets (2 per tenant)
-- =====================================================================
INSERT INTO esg.targets
  (tenant_id, framework, metric, baseline_value, baseline_period,
   target_value, target_period)
SELECT v.tenant_id, v.framework, v.metric, v.base_val, '2024', v.tgt_val, '2030'
FROM (VALUES
  ('t_astar',    'GHG',  'tCO2e emitted',     48.00, 28.00),
  ('t_astar',    'CSRD', 'kWh consumed',   140000.00, 98000.00),
  ('t_govtech',  'GHG',  'tCO2e emitted',     95.00, 52.00),
  ('t_govtech',  'CSRD', 'kWh consumed',   320000.00, 224000.00),
  ('t_mediacorp','GHG',  'tCO2e emitted',     62.00, 37.00),
  ('t_mediacorp','CSRD', 'kWh consumed',   175000.00, 122500.00),
  ('t_singhealth','GHG', 'tCO2e emitted',    110.00, 66.00),
  ('t_singhealth','CSRD','kWh consumed',   480000.00, 336000.00),
  ('t_singtel',  'GHG',  'tCO2e emitted',    180.00, 108.00),
  ('t_singtel',  'CSRD', 'kWh consumed',   720000.00, 504000.00)
) AS v(tenant_id, framework, metric, base_val, tgt_val)
WHERE NOT EXISTS (
  SELECT 1 FROM esg.targets t
  WHERE t.tenant_id = v.tenant_id AND t.framework = v.framework AND t.metric = v.metric
);
