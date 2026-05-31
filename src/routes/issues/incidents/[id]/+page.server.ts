// =====================================================================
//  /issues/incidents/[id] — Incident detail: timeline + postmortem.
//  Tenant isolation enforced; readable by __all__ MSSP users.
// =====================================================================

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getIncident, getIncidentTimeline, getPostmortem } from '$lib/server/data';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

const VALID_STATUSES = ['open', 'contained', 'resolved', 'postmortem-done'] as const;

export const load: PageServerLoad = async ({ params, locals }) => {
  const incident = await getIncident(params.id);
  if (!incident) throw error(404, 'Incident not found');
  if (locals.user && incident.tenantId !== locals.user.tenantId && locals.user.tenantId !== '__all__') {
    throw error(403, 'Access denied');
  }

  const [timeline, postmortem] = await Promise.all([
    getIncidentTimeline(incident.id),
    getPostmortem(incident.id)
  ]);

  return { incident, timeline, postmortem };
};

export const actions: Actions = {
  updateStatus: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { statusError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { statusError: 'Requires Postgres mode' });

    const data = await request.formData();
    const newStatus = String(data.get('status') ?? '').trim();

    if (!VALID_STATUSES.includes(newStatus as typeof VALID_STATUSES[number])) {
      return fail(400, { statusError: 'Invalid status.' });
    }

    const extraCols: string[] = [];
    if (newStatus === 'contained') extraCols.push('contained_at = now()');
    if (newStatus === 'resolved' || newStatus === 'postmortem-done') extraCols.push('resolved_at = now()');
    const extraSql = extraCols.length ? ', ' + extraCols.join(', ') : '';

    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE incident.incidents SET status = $1::incident.status${extraSql}
       WHERE id = $2::uuid AND tenant_id = $3`,
      [newStatus, params.id, locals.user.tenantId]
    );
    if (!rowCount) return fail(404, { statusError: 'Incident not found or access denied.' });

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'incident.status.updated',
      target: `incident:${params.id}`,
      result: 'success',
      metadata: { newStatus }
    });

    return { statusUpdated: true, newStatus };
  },

  addTimelineEvent: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { timelineError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { timelineError: 'Requires Postgres mode' });

    const data = await request.formData();
    const event = String(data.get('event') ?? '').trim();

    if (!event) return fail(400, { timelineError: 'Event description is required.' });
    if (event.length > 1024) return fail(400, { timelineError: 'Event must be 1024 characters or fewer.' });

    const pool = getPool();

    // Verify incident belongs to tenant
    const check = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM incident.incidents WHERE id = $1::uuid LIMIT 1`,
      [params.id]
    );
    if (!check.rows.length) return fail(404, { timelineError: 'Incident not found' });
    if (check.rows[0].tenant_id !== locals.user.tenantId) return fail(403, { timelineError: 'Access denied' });

    await pool.query(
      `INSERT INTO incident.timeline_events (tenant_id, incident_id, ts, actor, event, source)
       VALUES ($1, $2::uuid, now(), $3, $4, 'human')`,
      [locals.user.tenantId, params.id, locals.user.email, event]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'incident.timeline.event.added',
      target: `incident:${params.id}`,
      result: 'success'
    });

    return { timelineAdded: true };
  },

  createPostmortem: async ({ params, request, locals }) => {
    if (!locals.user) return fail(401, { pmError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { pmError: 'Requires Postgres mode' });

    const data = await request.formData();
    const rootCauseMd = String(data.get('rootCauseMd') ?? '').trim();
    const correctiveActionsMd = String(data.get('correctiveActionsMd') ?? '').trim();

    if (!rootCauseMd) return fail(400, { pmError: 'Root cause is required.' });
    if (rootCauseMd.length > 10_000) return fail(400, { pmError: 'Root cause must be 10 000 characters or fewer.' });
    if (!correctiveActionsMd) return fail(400, { pmError: 'Corrective actions are required.' });
    if (correctiveActionsMd.length > 10_000) return fail(400, { pmError: 'Corrective actions must be 10 000 characters or fewer.' });

    const pool = getPool();
    const check = await pool.query<{ tenant_id: string; status: string }>(
      `SELECT tenant_id, status::text AS status FROM incident.incidents WHERE id = $1::uuid LIMIT 1`,
      [params.id]
    );
    if (!check.rows.length) return fail(404, { pmError: 'Incident not found' });
    if (check.rows[0].tenant_id !== locals.user.tenantId) return fail(403, { pmError: 'Access denied' });
    if (!['resolved', 'postmortem-done'].includes(check.rows[0].status)) {
      return fail(400, { pmError: 'Postmortem can only be filed for resolved incidents.' });
    }

    // Upsert: if a postmortem already exists for this incident, update it instead of inserting.
    await pool.query(
      `INSERT INTO incident.postmortems (tenant_id, incident_id, root_cause_md, corrective_actions_md)
       VALUES ($1, $2::uuid, $3, $4)
       ON CONFLICT (incident_id) DO UPDATE
         SET root_cause_md = EXCLUDED.root_cause_md,
             corrective_actions_md = EXCLUDED.corrective_actions_md`,
      [locals.user.tenantId, params.id, rootCauseMd, correctiveActionsMd]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'incident.postmortem.filed',
      target: `incident:${params.id}`,
      result: 'success'
    });

    return { pmCreated: true };
  }
};
