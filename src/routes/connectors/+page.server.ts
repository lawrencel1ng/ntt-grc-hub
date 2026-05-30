// =====================================================================
//  /connectors — Connector inventory page.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getConnectors } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

const VALID_KINDS = [
  'aws', 'azure', 'gcp', 'okta', 'jira', 'm365', 'github',
  'servicenow', 'slack', 'splunk', 'datadog', 'pagerduty', 'teams'
] as const;

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const connectors = await getConnectors(effective);
  return { connectors, isAll: tenantId === ALL_TENANTS_ID };
};

export const actions: Actions = {
  createConnector: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { connectorError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { connectorError: 'Requires Postgres mode' });

    const data = await request.formData();
    const kind = String(data.get('kind') ?? '').trim();
    const name = String(data.get('name') ?? '').trim();

    if (!kind || !name) return fail(400, { connectorError: 'Kind and name are required.' });
    if (!VALID_KINDS.includes(kind as typeof VALID_KINDS[number])) return fail(400, { connectorError: 'Invalid connector kind.' });
    if (name.length > 128) return fail(400, { connectorError: 'Name must be 128 characters or fewer.' });

    const pool = getPool();

    const existing = await pool.query(
      `SELECT id FROM integration.connectors WHERE tenant_id = $1 AND kind = $2 AND name = $3`,
      [locals.user.tenantId, kind, name]
    );
    if (existing.rows.length) return fail(409, { connectorError: 'A connector with that name already exists.' });

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO integration.connectors (tenant_id, kind, name, status)
       VALUES ($1, $2, $3, 'disconnected')
       RETURNING id::text`,
      [locals.user.tenantId, kind, name]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'connector.created',
      target: `connector:${rows[0].id}`,
      result: 'success',
      metadata: { kind, name }
    });

    return { connectorCreated: true, connectorId: rows[0].id };
  }
};
