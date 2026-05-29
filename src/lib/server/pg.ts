import pg from 'pg';
import { env } from '$env/dynamic/private';

const { Pool, types } = pg;

// ── Normalise Postgres → JS types to match the mock fixtures ──────────
// node-postgres returns NUMERIC/BIGINT as strings (to preserve arbitrary
// precision) and timestamps as Date objects. The UI components and the
// mock data, however, assume plain `number`s and ISO-8601 `string`s — so
// without these parsers pg mode throws during SSR with errors like
// "score.toFixed is not a function" or "iso.slice is not a function".
// Demo-grade precision: coercing NUMERIC to Number is acceptable here.
const asNumber = (v: string | null): number | null => (v === null ? null : Number(v));
const asIso = (v: string | null): string | null => (v === null ? null : new Date(v).toISOString());
types.setTypeParser(1700, asNumber); // numeric / decimal
types.setTypeParser(20, asNumber); // int8 / bigint
types.setTypeParser(1114, asIso); // timestamp (without time zone)
types.setTypeParser(1184, asIso); // timestamptz
types.setTypeParser(1082, (v) => v); // date → keep raw 'YYYY-MM-DD' string

let pool: pg.Pool | null = null;

/**
 * Lazy-init the Postgres pool. Only constructed when `DATA_MODE=pg` is
 * set and a `getPool()` call actually happens — the demo defaults to
 * mock mode so most installations never spin up a connection.
 */
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL ?? 'postgres://localhost:5432/ntt_grc_hub',
      max: 8,
      idleTimeoutMillis: 30_000
    });
    pool.on('error', (err) => {
      // Don't crash the server on a stale pool client; log and let the
      // next query reconnect.
      console.warn('[pg] idle client error:', err.message);
    });
  }
  return pool;
}

export function isPgMode(): boolean {
  return (env.DATA_MODE ?? 'mock') === 'pg';
}
