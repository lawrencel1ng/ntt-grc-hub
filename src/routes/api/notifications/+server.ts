import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';

export interface Notification {
  id: string;
  title: string;
  body: string;
  href: string;
  severity: 'critical' | 'warning' | 'info';
  createdAt: string;
}

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');

  if (!isPgMode()) {
    return json({ notifications: [] });
  }

  const pool = getPool();
  const tenantId = locals.user.tenantId;

  const [regRows, ctRows, qRows] = await Promise.all([
    pool.query<{ id: string; title: string; severity: string; published_at: string }>(
      `SELECT id::text, title, severity::text, published_at::text
       FROM regwatch.changes
       WHERE severity IN ('critical','high')
         AND published_at >= now() - interval '30 days'
       ORDER BY published_at DESC LIMIT 3`
    ).catch(() => ({ rows: [] as never[] })),

    pool.query<{ control_id: string; code: string; ran_at: string; n: number }>(
      `SELECT tr.control_id, cl.code, MAX(tr.ran_at)::text AS ran_at, COUNT(*)::int AS n
       FROM control.test_runs tr
       JOIN control.library cl ON cl.id = tr.control_id
       WHERE tr.tenant_id = $1
         AND tr.result IN ('fail','partial')
         AND tr.ran_at >= now() - interval '7 days'
       GROUP BY tr.control_id, cl.code
       ORDER BY ran_at DESC LIMIT 3`,
      [tenantId]
    ).catch(() => ({ rows: [] as never[] })),

    pool.query<{ vendor_id: string; vendor_name: string; template: string; completed_at: string }>(
      `SELECT q.vendor_id::text, v.name AS vendor_name, q.template, q.completed_at::text
       FROM vendor.questionnaires q
       JOIN vendor.vendors v ON v.id = q.vendor_id
       WHERE q.tenant_id = $1
         AND q.status = 'complete'
         AND q.completed_at >= now() - interval '14 days'
       ORDER BY q.completed_at DESC LIMIT 3`,
      [tenantId]
    ).catch(() => ({ rows: [] as never[] }))
  ]);

  const notifications: Notification[] = [];

  for (const r of regRows.rows) {
    notifications.push({
      id: `reg-${r.id}`,
      title: `${r.severity === 'critical' ? 'Critical' : 'High'}: ${r.title}`,
      body: `Regulatory change requires review`,
      href: `/regwatch/${r.id}`,
      severity: r.severity === 'critical' ? 'critical' : 'warning',
      createdAt: r.published_at
    });
  }
  for (const r of ctRows.rows) {
    notifications.push({
      id: `ct-${r.control_id}`,
      title: `Control test failed: ${r.code}`,
      body: `${r.n} failure${r.n > 1 ? 's' : ''} in the last 7 days`,
      href: `/controls/${r.control_id}`,
      severity: 'warning',
      createdAt: r.ran_at
    });
  }
  for (const r of qRows.rows) {
    notifications.push({
      id: `q-${r.vendor_id}`,
      title: `${r.template} questionnaire completed`,
      body: `${r.vendor_name} — ready for review`,
      href: `/vendors/${r.vendor_id}`,
      severity: 'info',
      createdAt: r.completed_at
    });
  }

  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return json({ notifications: notifications.slice(0, 8) });
};
