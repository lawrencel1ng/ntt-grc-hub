// =====================================================================
//  /admin/tenants — Platform-admin view of all tenants. Pulls users +
//  connectors per tenant in parallel so the expand-row renders instantly.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
  getTenantSummaries,
  getConnectors,
  getUsers
} from '$lib/server/data';
import { writeAuditLog } from '$lib/server/auth';
import { isPgMode, getPool } from '$lib/server/pg';

export const load: PageServerLoad = async () => {
  const [tenants, usersAll] = await Promise.all([getTenantSummaries(), getUsers()]);

  const enriched = await Promise.all(tenants.map(async (t) => {
    const connectors = await getConnectors(t.id);
    const userCount = usersAll.filter((u) => u.tenantId === t.id).length;
    return {
      tenant: t,
      connectorCount: connectors.length,
      connectedCount: connectors.filter((c) => c.status === 'connected').length,
      userCount
    };
  }));

  return { rows: enriched };
};

export const actions: Actions = {
  createTenant: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { tenantError: 'Not authenticated' });
    if (locals.user.role !== 'admin') return fail(403, { tenantError: 'Admin role required.' });
    if (!isPgMode()) return fail(400, { tenantError: 'Tenant management requires Postgres mode.' });

    const data = await request.formData();
    const name = String(data.get('name') ?? '').trim();
    const industry = String(data.get('industry') ?? '').trim();
    const region = String(data.get('region') ?? 'SG').trim();
    const headquarteredIn = String(data.get('headquarteredIn') ?? 'Singapore').trim();
    const slaTier = String(data.get('slaTier') ?? 'standard').trim();
    const primaryFramework = String(data.get('primaryFramework') ?? '').trim() || null;
    const mrrRaw = parseFloat(String(data.get('mrrSgd') ?? '0'));
    const mrrSgd = isNaN(mrrRaw) ? 0 : mrrRaw;

    if (!name || !industry) return fail(400, { tenantError: 'Name and industry are required.' });

    // Derive a URL-safe tenant ID from the name
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 32);
    const tenantId = `t_${slug}`;

    const pool = getPool();

    // Check for duplicate
    const existing = await pool.query(`SELECT id FROM platform.tenants WHERE id = $1 OR name = $2`, [tenantId, name]);
    if (existing.rows.length) return fail(409, { tenantError: 'A tenant with that name already exists.' });

    await pool.query(
      `INSERT INTO platform.tenants (id, name, industry, region, headquartered_in, sla_tier, primary_framework, mrr_sgd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, name, industry, region, headquarteredIn, slaTier, primaryFramework, mrrSgd]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'tenant.created',
      target: `tenant:${tenantId}`,
      result: 'success'
    });

    return { tenantCreated: true, createdName: name };
  }
};
