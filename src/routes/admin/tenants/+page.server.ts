// =====================================================================
//  /admin/tenants — Platform-admin view of all tenants. Pulls users +
//  connectors per tenant in parallel so the expand-row renders instantly.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail, error } from '@sveltejs/kit';
import {
  getTenantSummaries,
  getConnectorCountsByTenant,
  getUsers
} from '$lib/server/data';
import { writeAuditLog } from '$lib/server/auth';
import { isPgMode, getPool } from '$lib/server/pg';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if ((locals.tenantId ?? ALL_TENANTS_ID) !== ALL_TENANTS_ID) {
    throw error(403, 'Tenant management requires platform-admin access');
  }
  const [tenants, usersAll, connectorCounts] = await Promise.all([
    getTenantSummaries(),
    getUsers(),
    getConnectorCountsByTenant()
  ]);

  const enriched = tenants.map((t) => {
    const counts = connectorCounts[t.id] ?? { total: 0, connected: 0 };
    const userCount = usersAll.filter((u) => u.tenantId === t.id).length;
    return {
      tenant: t,
      connectorCount: counts.total,
      connectedCount: counts.connected,
      userCount
    };
  });

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
    if (name.length > 128) return fail(400, { tenantError: 'Name must be 128 characters or fewer.' });
    if (industry.length > 128) return fail(400, { tenantError: 'Industry must be 128 characters or fewer.' });
    if (region.length > 16) return fail(400, { tenantError: 'Region code must be 16 characters or fewer.' });
    if (headquarteredIn.length > 128) return fail(400, { tenantError: 'Headquartered-in must be 128 characters or fewer.' });
    const VALID_SLA_TIERS = ['standard', 'premium', 'enterprise'];
    if (!VALID_SLA_TIERS.includes(slaTier)) return fail(400, { tenantError: 'Invalid SLA tier.' });
    if (primaryFramework && primaryFramework.length > 64) return fail(400, { tenantError: 'Primary framework must be 64 characters or fewer.' });

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
