import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');
  if (!(await checkRateLimit('human-risk.simulate', locals.user.id, 10, 5 * 60_000))) {
    throw error(429, 'Too many simulation requests — try again in a few minutes.');
  }

  const body = await request.json().catch(() => ({})) as { userId?: string; userEmail?: string };
  const { userId, userEmail } = body;
  if (!userId || !userEmail) throw error(400, 'userId and userEmail required');

  const apiKey = env.KNOWBE4_API_KEY ?? '';
  const region = (env.KNOWBE4_REGION ?? 'us').toLowerCase();
  const baseUrl = region === 'eu' ? 'https://eu.api.knowbe4.com' : 'https://us.api.knowbe4.com';

  if (!apiKey) console.warn('[human-risk/simulate] KNOWBE4_API_KEY not set — phishing simulation skipped');

  const kb4NumericId = userId.startsWith('hru_kb4_') ? userId.slice(8) : null;

  if (apiKey && kb4NumericId) {
    // Find the most recent active phishing campaign and add the user to it.
    try {
      const campaignsRes = await fetch(`${baseUrl}/v1/phishing/campaigns?status=active&per_page=1`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (campaignsRes.ok) {
        const campaigns: { campaign_id: number }[] = await campaignsRes.json();
        if (campaigns.length > 0) {
          await fetch(`${baseUrl}/v1/phishing/campaigns/${campaigns[0].campaign_id}/recipients`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_ids: [Number(kb4NumericId)] })
          });
        }
      }
    } catch {
      // Best-effort — proceed regardless of API outcome
    }
  }

  const pool = getPool();
  await pool.query(
    `INSERT INTO human_risk.remediation_actions (tenant_id, user_id, action_type, actor_id, notes)
     VALUES ($1, $2, 'phishing_simulation', $3, 'Simulation queued via GRC Hub')`,
    [locals.user.tenantId, userId, locals.user.id]
  );

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'human_risk.simulation_queued',
    target: `user:${userEmail}`,
    result: 'success'
  });

  return json({ ok: true });
};
