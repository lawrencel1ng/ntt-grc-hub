import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rateLimit';

/**
 * PATCH /api/connectors/:id — update connector status or record a sync.
 * Body: { action: 'sync' | 'reconnect' }
 *
 * Returns the updated connector row fields (last_sync_at, status).
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!(await checkRateLimit('connector.action', locals.user.id, 30, 5 * 60_000))) throw error(429, 'Too many connector actions — try again in a few minutes.');

  const body = await request.json().catch(() => ({})) as { action?: string };
  const action = body.action;
  if (action !== 'sync' && action !== 'reconnect') throw error(400, 'action must be sync or reconnect');

  const now = new Date().toISOString();

  const pool = getPool();

  // Verify the connector belongs to this user's tenant (non-admin users are tenant-scoped).
  const check = await pool.query(
    `SELECT id, status FROM integration.connectors WHERE id = $1 AND tenant_id = $2`,
    [params.id, locals.user.tenantId]
  );
  if (!check.rows.length) throw error(404, 'Connector not found');

  if (action === 'sync') {
    await pool.query(
      `UPDATE integration.connectors SET last_sync_at = now() WHERE id = $1`,
      [params.id]
    );
    // Record a sync job entry
    await pool.query(
      `INSERT INTO integration.sync_jobs (tenant_id, connector_id, started_at, ended_at, status, records_ingested)
       VALUES ($1, $2, now(), now(), 'success', 0)`,
      [locals.user.tenantId, params.id]
    );
    writeAuditLog({ userId: locals.user.id, actorEmail: locals.user.email, tenantId: locals.user.tenantId, action: 'connector.synced', target: `connector:${params.id}`, result: 'success' });
  } else {
    await pool.query(
      `UPDATE integration.connectors SET status = 'connected', last_sync_at = now() WHERE id = $1`,
      [params.id]
    );
    writeAuditLog({ userId: locals.user.id, actorEmail: locals.user.email, tenantId: locals.user.tenantId, action: 'connector.reconnected', target: `connector:${params.id}`, result: 'success' });
  }

  return json({ ok: true, lastSyncAt: now, status: 'connected' });
};
