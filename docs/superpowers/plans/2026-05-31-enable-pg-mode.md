# Enable Postgres Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the dev environment to the local Postgres DB so the site runs in real pg mode, not mock fixtures.

**Architecture:** Create `.env.local` with `DATA_MODE=pg`, fix and apply migrations 021–025, then seed a known dev password for all active users via a small TypeScript script. A `scripts/dev-setup.sh` orchestrates the migration + seeding so any developer can reproduce it.

**Tech Stack:** PostgreSQL 16, Node.js / tsx, bcryptjs, SvelteKit dev server (Vite)

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `.env.local` | Set `DATA_MODE=pg` + `DATABASE_URL` for dev |
| Fix    | `db/migrations/024_rate_limit_hits_table.sql` | Add missing index name |
| Create | `scripts/seed-dev-passwords.ts` | bcrypt-hash `Demo1234!` and update all active users |
| Create | `scripts/dev-setup.sh` | Apply migrations 021–025 then run the seeder |

---

### Task 1: Create `.env.local`

**Files:**
- Create: `.env.local`

- [ ] **Step 1: Create the env file**

```
DATA_MODE=pg
DATABASE_URL=postgres://localhost:5432/ntt_grc_hub
```

Save as `.env.local` in the project root. (Already in `.gitignore` — never commit this.)

- [ ] **Step 2: Verify it is gitignored**

Run:
```bash
git check-ignore -v .env.local
```
Expected: `.gitignore:N:.env.local    .env.local` (some matching line)

If not found, add `.env.local` to `.gitignore` before continuing.

---

### Task 2: Fix migration 024 index syntax

**Files:**
- Modify: `db/migrations/024_rate_limit_hits_table.sql`

The existing file has `CREATE INDEX IF NOT EXISTS ON ...` which is missing an index name and will error in Postgres.

- [ ] **Step 1: Open the file and confirm the broken line**

Open `db/migrations/024_rate_limit_hits_table.sql`. Current contents:

```sql
CREATE INDEX IF NOT EXISTS ON platform.rate_limit_hits (bucket_id, user_id, hit_at DESC);
```

- [ ] **Step 2: Fix the index name**

Replace the broken line so the file reads:

```sql
-- Migration 024: DB-backed rate limiter for authenticated API routes.
-- Replaces in-process Map that reset on server restart.
CREATE TABLE IF NOT EXISTS platform.rate_limit_hits (
    id          BIGSERIAL PRIMARY KEY,
    bucket_id   TEXT NOT NULL,
    user_id     UUID NOT NULL,
    hit_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_hits_bucket_user_ts
    ON platform.rate_limit_hits (bucket_id, user_id, hit_at DESC);

CREATE OR REPLACE FUNCTION platform.purge_old_rate_limit_hits() RETURNS void
    LANGUAGE sql AS $$
    DELETE FROM platform.rate_limit_hits WHERE hit_at < now() - interval '1 hour';
$$;
```

- [ ] **Step 3: Commit the fix**

```bash
git add db/migrations/024_rate_limit_hits_table.sql
git commit -m "fix(migrations): add missing index name in migration 024"
```

---

### Task 3: Create password seeder script

**Files:**
- Create: `scripts/seed-dev-passwords.ts`

- [ ] **Step 1: Confirm `bcryptjs` is available**

Run:
```bash
node -e "require('bcryptjs'); console.log('ok')"
```
Expected: `ok`. (It is in `dependencies` in `package.json`.)

- [ ] **Step 2: Create the seeder**

Create `scripts/seed-dev-passwords.ts`:

```typescript
import bcrypt from 'bcryptjs';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://localhost:5432/ntt_grc_hub';
const DEV_PASSWORD = 'Demo1234!';

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    const hash = await bcrypt.hash(DEV_PASSWORD, 12);
    const { rowCount } = await pool.query(
      `UPDATE platform.users
          SET password_hash = $1
        WHERE status = 'active'
          AND password_hash IS NULL`,
      [hash]
    );
    console.log(`✓ Set dev password on ${rowCount} active users`);
    console.log(`  Login: <any-active-email> / ${DEV_PASSWORD}`);
    console.log(`  e.g.  maybank.singapore.admin@example.sg / ${DEV_PASSWORD}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seeder failed:', err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Run a dry test (count only) to verify DB is reachable**

```bash
DATABASE_URL=postgres://localhost:5432/ntt_grc_hub npx tsx -e "
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(\"SELECT count(*) FROM platform.users WHERE status='active' AND password_hash IS NULL\");
console.log('users needing password:', rows[0].count);
await pool.end();
"
```
Expected: `users needing password: 130` (or similar non-zero number)

---

### Task 4: Create `dev-setup.sh`

**Files:**
- Create: `scripts/dev-setup.sh`

- [ ] **Step 1: Create the script**

Create `scripts/dev-setup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://localhost:5432/ntt_grc_hub}"
MIGRATIONS_DIR="$(dirname "$0")/../db/migrations"

echo "==> Applying pending migrations to $DB_URL"

for f in "$MIGRATIONS_DIR"/021_*.sql \
          "$MIGRATIONS_DIR"/022_*.sql \
          "$MIGRATIONS_DIR"/023_*.sql \
          "$MIGRATIONS_DIR"/024_*.sql \
          "$MIGRATIONS_DIR"/025_*.sql; do
  echo "    Applying: $(basename "$f")"
  psql "$DB_URL" -f "$f" -q
done

echo "==> Seeding dev passwords"
DATABASE_URL="$DB_URL" npx tsx "$(dirname "$0")/seed-dev-passwords.ts"

echo ""
echo "==> Done. Start the dev server:"
echo "    npm run dev"
echo ""
echo "    Login: maybank.singapore.admin@example.sg / Demo1234!"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/dev-setup.sh
```

- [ ] **Step 3: Commit the new scripts**

```bash
git add scripts/dev-setup.sh scripts/seed-dev-passwords.ts
git commit -m "feat(dev): add dev-setup.sh + seed-dev-passwords for pg mode"
```

---

### Task 5: Run dev-setup.sh

- [ ] **Step 1: Run the setup**

```bash
./scripts/dev-setup.sh
```

Expected output (approximately):
```
==> Applying pending migrations to postgres://localhost:5432/ntt_grc_hub
    Applying: 021_agent_enabled_column.sql
    Applying: 022_login_attempts_table.sql
    Applying: 023_ai_model_risk_unique.sql
    Applying: 024_rate_limit_hits_table.sql
    Applying: 025_regwatch_mappings_unique.sql
==> Seeding dev passwords
✓ Set dev password on 130 active users
  Login: <any-active-email> / Demo1234!
  e.g.  maybank.singapore.admin@example.sg / Demo1234!

==> Done. Start the dev server:
    npm run dev
```

If psql exits with an error, the script stops. Read the error and fix before continuing.

- [ ] **Step 2: Verify the enabled column was added**

```bash
psql postgres://localhost:5432/ntt_grc_hub -c "\d agent.agents" | grep enabled
```
Expected: `enabled | boolean | not null | true`

- [ ] **Step 3: Verify login_attempts table exists**

```bash
psql postgres://localhost:5432/ntt_grc_hub -c "SELECT count(*) FROM platform.login_attempts;"
```
Expected: ` 0` (table exists, zero rows)

- [ ] **Step 4: Verify rate_limit_hits table exists**

```bash
psql postgres://localhost:5432/ntt_grc_hub -c "SELECT count(*) FROM platform.rate_limit_hits;"
```
Expected: ` 0` (table exists, zero rows)

- [ ] **Step 5: Verify passwords were seeded**

```bash
psql postgres://localhost:5432/ntt_grc_hub -c "SELECT count(*) FROM platform.users WHERE status='active' AND password_hash IS NOT NULL;"
```
Expected: non-zero count matching number of active users

---

### Task 6: Test pg mode end-to-end

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: Server starts on `http://localhost:5182` (the port configured in `package.json`).

- [ ] **Step 2: Confirm pg mode is active (server log)**

In the terminal, you should NOT see mock data warnings. Open `http://localhost:5182` in a browser — it should redirect to `/login`.

- [ ] **Step 3: Log in with a real DB user**

Navigate to `http://localhost:5182/login`.  
Enter:
- Email: `maybank.singapore.admin@example.sg`
- Password: `Demo1234!`

Expected: Redirect to dashboard (no error).

- [ ] **Step 4: Verify real data is showing**

On the dashboard, check the tenant switcher or any KPI card. The data should reflect real DB values (e.g., exactly 8 tenants listed, not round numbers from mock fixtures).

If you see "0 risks" or "0 agents" everywhere, check the server terminal for `[data] pg query failed` messages — the DB connection is likely wrong.

- [ ] **Step 5: Stop the dev server**

`Ctrl+C` in the terminal running `npm run dev`.

---

### Task 7: Commit `.env.local` note to README

- [ ] **Step 1: Check README for dev setup section**

Open `README.md`. If there is already a local dev / getting-started section, update it. If not, append a `## Local Development` section.

The section should contain:

```markdown
## Local Development

### Quick start (with Postgres)

1. Ensure a local Postgres database `ntt_grc_hub` exists with the schema loaded:
   ```bash
   psql postgres://localhost:5432/ntt_grc_hub -c "\dn"
   ```
   If missing, run `npm run db:init && npm run db:seed` first.

2. Run the dev setup script (one-time):
   ```bash
   ./scripts/dev-setup.sh
   ```
   This applies pending migrations and seeds a dev password (`Demo1234!`) for all active users.

3. Create `.env.local` in the project root (already gitignored):
   ```
   DATA_MODE=pg
   DATABASE_URL=postgres://localhost:5432/ntt_grc_hub
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

5. Log in at `http://localhost:5182` with any active user, e.g.:
   - Email: `maybank.singapore.admin@example.sg`
   - Password: `Demo1234!`

### Mock mode (no Postgres)

Omit `.env.local` (or set `DATA_MODE=mock`). The app runs on in-memory fixtures — no DB needed.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add local development setup instructions for pg mode"
```

---

### Task 8: Push to GitHub

- [ ] **Step 1: Verify clean state**

```bash
git status
```
Expected: `nothing to commit, working tree clean`

- [ ] **Step 2: Push**

```bash
git push origin main
```

Expected: Branch pushes cleanly. Confirm on GitHub that the three new commits appear.
