-- Migration 087: Backfill risk_history for all human_risk.users.
-- Each user gets a 12-element array of monthly risk scores leading up to
-- their current risk_score. Scores are deterministically derived from
-- current risk_score so reruns stay stable.

UPDATE human_risk.users
SET risk_history = (
  -- Generate 12 monthly scores ending at current risk_score.
  -- Start at a "base" score offset by up to ±20 pts, trend toward current.
  SELECT jsonb_agg(
    GREATEST(0, LEAST(100,
      -- base + linear ramp + deterministic noise per month
      ROUND(
        start_score + (risk_score - start_score) * (m.idx::numeric / 11)
        + (abs(hashtext(id || m.idx::text)) % 11 - 5)  -- ±5 noise
      )::int
    ))
    ORDER BY m.idx
  )
  FROM generate_series(0, 11) AS m(idx),
  LATERAL (SELECT GREATEST(0, LEAST(100, risk_score + (abs(hashtext(id)) % 41) - 20)) AS start_score) base
)
WHERE jsonb_array_length(risk_history) = 0;

\echo ' >> human_risk.users risk_history backfilled'
