# Enable Postgres Mode for Local Development

**Date:** 2026-05-31  
**Status:** Approved

## Problem

The app ships with a dual-mode data layer: every `data.ts` function checks `isPgMode()` and either runs a Postgres query or returns in-memory mock fixtures. In development, `DATA_MODE` is unset and `NODE_ENV=development`, so the app always runs in mock mode. The local Postgres database is fully populated (8 tenants, 130 users, 1,109 risks, 3,945 controls, 25,737 evidence items) but is never used.

Three blockers prevent pg mode from working locally:
1. No `.env.local` setting `DATA_MODE=pg`
2. Migrations 021–025 not applied to the local DB
3. All `platform.users` rows have `password_hash = NULL` — real login is impossible

## Approach

Enable pg mode with a reproducible dev setup script. The mock fallback code stays intact so developers without a local DB can still run the app.

## Architecture

### Configuration

Create `.env.local` (already in `.gitignore`) containing:

```
DATA_MODE=pg
DATABASE_URL=postgres://localhost:5432/ntt_grc_hub
```

`isPgMode()` in `src/lib/server/pg.ts` reads `DATA_MODE` and returns `true` when its value is `"pg"`.

### Migrations

Files `db/migrations/021_agent_enabled_column.sql` through `025_regwatch_mappings_unique.sql` exist in the repo but have not been applied to the local database. A setup script will apply them in order.

Each migration file already uses safe DDL (`IF NOT EXISTS`, `IF EXISTS`, `OR IGNORE`, etc.) so re-running is idempotent.

Missing schema pieces (confirmed):
- `agent.agents.enabled` (migration 021)
- `platform.login_attempts` table (migration 022)
- Unique constraint on `ai_gov.model_risk` (migration 023)
- `platform.rate_limit_hits` table (migration 024)
- Unique constraint on `regwatch.mappings` (migration 025)

### Password Seeding

All 130 active users have `password_hash = NULL`. A seed script generates a single bcrypt hash for `Demo1234!` and updates all active users in one SQL statement. This is a dev-only operation; production deployments use real credentials.

### Dev Setup Script

`scripts/dev-setup.sh` orchestrates the above:

```
1. Apply migrations 021–025 via psql
2. Run scripts/seed-dev-passwords.ts via tsx (seeds Demo1234! for active users)
3. Print login credentials for reference
```

## Components

| Component | Path | Action |
|-----------|------|--------|
| Env config | `.env.local` | Create |
| Setup script | `scripts/dev-setup.sh` | Create |
| Password seeder | `scripts/seed-dev-passwords.ts` | Create |

## Error Handling

- `dev-setup.sh` exits on first error (`set -e`)
- Password seeder uses a single `UPDATE ... WHERE password_hash IS NULL AND status = 'active'` — safe to re-run
- DB connection failure in seeder prints a clear error with connection string

## Testing

After running `scripts/dev-setup.sh`:

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:5173`
3. Login with `maybank.singapore.admin@example.sg` / `Demo1234!`
4. Verify dashboard loads real counts from Postgres (not round mock numbers)
5. Verify tenant switcher lists all 8 real tenants

## Security Notes

- `.env.local` is gitignored — never committed
- `Demo1234!` password is for local dev only; all prod users must have their passwords changed
- The `dev-setup.sh` script should only be run against a local/dev database
