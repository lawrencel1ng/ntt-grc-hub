# NTT GRC Hub — Database

PostgreSQL 16+ schema and seed for the demo. Two SQL files, no migration framework — the demo is rebuilt from scratch each time.

## Files

| File | Purpose |
|---|---|
| `init.sql` | Drops + creates the `ntt_grc_hub` database, 18 schemas, ~75 tables, ~30 enums, 4 dashboard views. |
| `seed.sql` | Investor-grade demo data for 8 tenants (3 hero + 5 shallow). |

## Quick start

```bash
# 1. Initialise (drops then re-creates the database)
npm run db:init

# 2. Seed the demo data
npm run db:seed

# Full reset in one step
dropdb --if-exists ntt_grc_hub && npm run db:init && npm run db:seed
```

Both scripts use the `psql` on `PATH` and connect as the current OS user. Override via `PGUSER` / `PGHOST` / `PGPORT` env vars if needed.

## Tenants seeded

| ID | Name | Industry | Depth | Primary framework |
|---|---|---|---|---|
| `t_maybank`    | Maybank Singapore     | Banking         | Hero    | MAS TRM |
| `t_mindef`     | MINDEF Defence Cloud  | Defence (CLASSIFIED) | Hero | IM8 |
| `t_grab`       | Grab Fintech APAC     | Fintech         | Hero    | MAS / multi-jurisdiction |
| `t_singhealth` | SingHealth            | Healthcare      | Shallow | ISO 27001 |
| `t_govtech`    | GovTech Singapore     | Public Sector   | Shallow | IM8 |
| `t_astar`      | A\*STAR               | Research        | Shallow | ISO 27001 |
| `t_mediacorp`  | Mediacorp             | Media           | Shallow | PDPA-SG |
| `t_singtel`    | Singtel               | Telco           | Shallow | ISO 27001 |

## Hero "wow path" rows (per design spec §10)

These are inserted last with fresh timestamps so they land at the top of "most recent" queries:

- **MAS Notice 655 update** — `regwatch.changes`, published 11 minutes ago, detected by Regulatory Horizon (`ag_regwatch`).
- **7 control gaps opened** — `regwatch.impact_assessments` row for `t_maybank` linked to that change.
- **Elevated Maybank risk** — `R-MAYB-HERO` with `last_assessed_at = now() - 4 hours`, residual jumped.
- **$4.2M ALE FAIR run** — `risk.fair_runs` against the hero scenario, run 3 hours ago.
- **3 failed AWS encryption test runs** — `control.test_runs` against Maybank encryption-family controls, ran in last hour.
- **47 fresh evidence items** — Evidence Collector dropped them in the last hour for Maybank.

## Expected row counts (approximate, after seed)

| Table | Rows |
|---|---|
| `platform.tenants` | 8 |
| `platform.users` | 130 |
| `compliance.frameworks` | 43 |
| `compliance.requirements` | 500 |
| `agent.agents` | 10 |
| `agent.runs` | ~14,000 |
| `agent.cost_ledger` | 7,200 (8 tenants × 10 agents × 90 days) |
| `risk.risks` | ~1,100 |
| `risk.fair_runs` | 51 |
| `control.library` | ~3,900 |
| `control.mappings` | ~20,000 |
| `control.test_runs` | ~10,000 |
| `evidence.items` | ~25,000 (hash-chained via `evidence.seals`) |
| `audit.engagements` | 31 |
| `vendor.vendors` | 169 |
| `regwatch.changes` | 65 |

Re-running the seed against a freshly-init'd DB is idempotent in spirit (same `init` + `seed` produces equivalent demo data; absolute counts vary by ±5% due to random timestamp jitter).
