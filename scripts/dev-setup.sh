#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_URL="${DATABASE_URL:-postgres://localhost:5432/ntt_grc_hub}"
MIGRATIONS_DIR="$SCRIPT_DIR/../db/migrations"
SEEDER="$SCRIPT_DIR/seed-dev-passwords.ts"

# Validate dependencies and files upfront
command -v psql >/dev/null 2>&1 || { echo "ERROR: psql not found in PATH" >&2; exit 1; }
command -v npx  >/dev/null 2>&1 || { echo "ERROR: npx not found in PATH" >&2; exit 1; }
[[ -f "$SEEDER" ]] || { echo "ERROR: $SEEDER not found" >&2; exit 1; }

# Validate DB connectivity
psql "$DB_URL" -c "SELECT 1;" >/dev/null 2>&1 || { echo "ERROR: Cannot connect to $DB_URL" >&2; exit 1; }

echo "==> Applying pending migrations to $DB_URL"

shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/[0-9][0-9][0-9]_*.sql)
shopt -u nullglob

if [[ ${#migrations[@]} -eq 0 ]]; then
  echo "    (no migration files found)"
else
  for f in "${migrations[@]}"; do
    echo "    Applying: $(basename "$f")"
    psql "$DB_URL" -f "$f" -q
  done
fi

echo "==> Seeding dev passwords"
DATABASE_URL="$DB_URL" npx tsx "$SEEDER"

echo ""
echo "==> Done. Start the dev server:"
echo "    npm run dev"
echo ""
echo "    Login: maybank.singapore.admin@example.sg / Demo1234!"
