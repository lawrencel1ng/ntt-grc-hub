import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';

export const GET: RequestHandler = async () => {
  const mode = isPgMode() ? 'pg' : 'mock';
  let dbOk = false;
  let dbLatencyMs = 0;

  if (isPgMode()) {
    const t0 = Date.now();
    try {
      await getPool().query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }
    dbLatencyMs = Date.now() - t0;
  } else {
    dbOk = true; // mock mode has no DB
  }

  const status = dbOk ? 200 : 503;
  return json(
    { ok: dbOk, mode, dbLatencyMs, ts: new Date().toISOString() },
    { status }
  );
};
