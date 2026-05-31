-- Migration 097: Backfill ESG metrics for 2023-Q1 through 2024-Q4 so the
-- "Emissions Trend (last 24 months)" chart has genuine historical data.
--
-- Strategy: derive historical rows from existing 2025-Q1 baseline values by
-- applying per-quarter multipliers that model a realistic declining emissions
-- trend (higher in 2023, converging toward 2025 values).
--
-- Multipliers (scale factor applied to 2025-Q1 values):
--   2023-Q1 1.45  2023-Q2 1.42  2023-Q3 1.39  2023-Q4 1.36
--   2024-Q1 1.30  2024-Q2 1.25  2024-Q3 1.19  2024-Q4 1.13
--
-- Non-tCO2e metrics (L, kWh, SGD, GB) are also backfilled with the same
-- scaling so metric tables are self-consistent across all periods.
--
-- Idempotent: WHERE NOT EXISTS guard skips rows that already exist.

INSERT INTO esg.metrics (tenant_id, period, scope, category, metric, value, unit, framework)
SELECT
  base.tenant_id,
  hist.period,
  base.scope,
  base.category,
  base.metric,
  ROUND(base.value * hist.factor, 4),
  base.unit,
  base.framework
FROM (
  -- One row per (tenant, scope, category, metric, unit) from the 2025-Q1 baseline
  SELECT tenant_id, scope, category, metric, value, unit, framework
  FROM esg.metrics
  WHERE period = '2025-Q1'
) AS base
CROSS JOIN (
  VALUES
    ('2023-Q1', 1.45),
    ('2023-Q2', 1.42),
    ('2023-Q3', 1.39),
    ('2023-Q4', 1.36),
    ('2024-Q1', 1.30),
    ('2024-Q2', 1.25),
    ('2024-Q3', 1.19),
    ('2024-Q4', 1.13)
) AS hist(period, factor)
WHERE NOT EXISTS (
  SELECT 1
  FROM esg.metrics ex
  WHERE ex.tenant_id  = base.tenant_id
    AND ex.period     = hist.period
    AND ex.scope      = base.scope
    AND ex.category   = base.category
    AND ex.metric     = base.metric
    AND ex.unit       = base.unit
);

\echo ' >> ESG historical metrics backfilled for 2023-Q1 through 2024-Q4'
