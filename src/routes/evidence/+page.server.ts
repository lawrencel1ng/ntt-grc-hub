// =====================================================================
//  /evidence — Evidence Vault. Tenant-scoped.
// =====================================================================

import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getEvidence, getEvidenceStats, getEvidenceControlCounts } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

const VALID_KINDS = ['screenshot', 'log', 'config', 'attestation', 'document', 'scan-result', 'api-response'] as const;

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? undefined : tenantId;
  const [items, stats, controlCounts] = await Promise.all([
    getEvidence(effective, 500),
    getEvidenceStats(effective),
    getEvidenceControlCounts(effective)
  ]);
  return { items, stats, controlCounts, isAll: tenantId === ALL_TENANTS_ID };
};

export const actions: Actions = {
  collectEvidence: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { evidenceError: 'Not authenticated' });
    if (!isPgMode()) return fail(400, { evidenceError: 'Requires Postgres mode' });

    const data = await request.formData();
    const title = String(data.get('title') ?? '').trim();
    const kind = String(data.get('kind') ?? 'document').trim();
    const domain = String(data.get('domain') ?? '').trim() || null;
    const sourceUrl = String(data.get('sourceUrl') ?? '').trim() || null;
    const controlId = String(data.get('controlId') ?? '').trim() || null;

    if (!title) return fail(400, { evidenceError: 'Title is required.' });
    if (title.length > 512) return fail(400, { evidenceError: 'Title must be 512 characters or fewer.' });
    if (!VALID_KINDS.includes(kind as typeof VALID_KINDS[number])) return fail(400, { evidenceError: 'Invalid evidence kind.' });
    if (sourceUrl && sourceUrl.length > 2048) return fail(400, { evidenceError: 'Source URL must be 2048 characters or fewer.' });

    // Validate controlId is a valid UUID belonging to this tenant
    const pool = getPool();
    if (controlId) {
      const check = await pool.query(
        `SELECT id FROM control.library WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [controlId, locals.user.tenantId]
      );
      if (!check.rows.length) return fail(400, { evidenceError: 'Control not found or access denied.' });
    }

    const metadata: Record<string, string> = {};
    if (domain) metadata.domain = domain;

    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO evidence.items
         (tenant_id, control_id, kind, title, source_url, captured_at, metadata)
       VALUES ($1, $2, $3::evidence.kind, $4, $5, now(), $6::jsonb)
       RETURNING id`,
      [locals.user.tenantId, controlId, kind, title, sourceUrl, JSON.stringify(metadata)]
    );

    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId: locals.user.tenantId,
      action: 'evidence.collected',
      target: `evidence:${rows[0].id}`,
      result: 'success',
      metadata: { kind, title, controlId }
    });

    return { evidenceCollected: true, evidenceId: rows[0].id };
  }
};
