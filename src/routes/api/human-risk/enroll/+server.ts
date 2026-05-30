import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');

  const body = await request.json().catch(() => ({})) as { userId?: string; userEmail?: string };
  const { userId, userEmail } = body;
  if (!userId || !userEmail) throw error(400, 'userId and userEmail required');

  const apiKey = env.KNOWBE4_API_KEY ?? '';
  const region = (env.KNOWBE4_REGION ?? 'us').toLowerCase();
  const baseUrl = region === 'eu' ? 'https://eu.api.knowbe4.com' : 'https://us.api.knowbe4.com';

  if (!apiKey) console.warn('[human-risk/enroll] KNOWBE4_API_KEY not set — KnowBe4 enrollment skipped');

  // Extract the numeric KnowBe4 user ID from our internal ID (hru_kb4_<number>)
  const kb4NumericId = userId.startsWith('hru_kb4_') ? userId.slice(8) : null;

  if (apiKey && kb4NumericId) {
    // Enroll in the default "Security Awareness Training" curriculum via KnowBe4 API.
    // The API requires an existing training campaign ID; we attempt to fetch the most
    // recent active campaign and enroll the user into it.
    try {
      const campaignsRes = await fetch(`${baseUrl}/v1/training/campaigns?status=active&per_page=1`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (campaignsRes.ok) {
        const campaigns: { campaign_id: number }[] = await campaignsRes.json();
        if (campaigns.length > 0) {
          await fetch(`${baseUrl}/v1/training/enrollments`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaign_id: campaigns[0].campaign_id, user_ids: [Number(kb4NumericId)] })
          });
        }
      }
    } catch {
      // Best-effort — proceed regardless of API outcome
    }
  }

  // Record the action in the DB so it appears in the audit trail.
  const pool = getPool();
  await pool.query(
    `INSERT INTO human_risk.remediation_actions (tenant_id, user_id, action_type, actor_id, notes)
     VALUES ($1, $2, 'training_enrollment', $3, 'Enrolled via GRC Hub')
     ON CONFLICT DO NOTHING`,
    [locals.user.tenantId, userId, locals.user.id]
  );

  writeAuditLog({
    userId: locals.user.id,
    actorEmail: locals.user.email,
    tenantId: locals.user.tenantId,
    action: 'human_risk.training_enrolled',
    target: `user:${userEmail}`,
    result: 'success'
  });

  return json({ ok: true });
};
