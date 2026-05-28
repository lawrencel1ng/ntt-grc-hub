import pg from 'pg';
import { env } from '$env/dynamic/private';

const { Pool } = pg;

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
