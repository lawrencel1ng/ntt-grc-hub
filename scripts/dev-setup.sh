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
