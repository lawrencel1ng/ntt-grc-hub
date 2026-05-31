-- Migration 039: Close a realistic fraction of treated low/medium risks.
-- Without this, the KPI "open critical risks" shows all seeded risks as open
-- since the seeder left every risk in 'treated' status.
-- Close every risk where hashtext(id) % 3 = 0 (stable, UUID-based selection).

UPDATE risk.risks SET status = 'closed'
WHERE status = 'treated'
  AND residual_severity IN ('low', 'medium')
  AND abs(hashtext(id::text)) % 3 = 0;
