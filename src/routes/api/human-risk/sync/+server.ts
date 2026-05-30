import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isPgMode, getPool } from '$lib/server/pg';
import { writeAuditLog } from '$lib/server/auth';

interface KnowBe4User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  job_title: string;
  current_risk_score: number;
  risk_score_history?: number[];
  phishing_click_count?: number;
  phishing_report_count?: number;
  mobile_phishing_click_count?: number;
  training_assignments?: number;
  training_completions_count?: number;
  mfa_enrolled?: boolean;
  admin?: boolean;
}

interface KnowBe4RiskScoreHistory {
  risk_score: number;
  phish_prone_percentage: number;
  date: string;
}

const RISK_LEVEL = (score: number): string => {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
};

async function fetchAllUsers(apiKey: string, region: string): Promise<KnowBe4User[]> {
  const baseUrl = region === 'eu' ? 'https://eu.api.knowbe4.com' : 'https://us.api.knowbe4.com';
  const users: KnowBe4User[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(`${baseUrl}/v1/users?status=active&per_page=500&page=${page}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`KnowBe4 API error ${res.status}: ${text.slice(0, 200)}`);
    }
    const page_users: KnowBe4User[] = await res.json();
    if (!page_users.length) break;
    users.push(...page_users);
    if (page_users.length < 500) break;
    page++;
  }

  return users;
}

async function fetchRiskHistory(apiKey: string, region: string): Promise<KnowBe4RiskScoreHistory[]> {
  const baseUrl = region === 'eu' ? 'https://eu.api.knowbe4.com' : 'https://us.api.knowbe4.com';
  const res = await fetch(`${baseUrl}/v1/risk_score_history`, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) return [];
  return res.json();
}

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!isPgMode()) throw error(400, 'Requires Postgres mode');

  const apiKey = env.KNOWBE4_API_KEY ?? '';
  const region = (env.KNOWBE4_REGION ?? 'us').toLowerCase();

  if (!apiKey) {
    throw error(400, 'KNOWBE4_API_KEY is not configured. Set it in your environment to enable live sync.');
  }

  const tenantId = locals.user.tenantId;
  const pool = getPool();
  const startedAt = Date.now();

  try {
    const [kb4Users, riskHistory] = await Promise.all([
      fetchAllUsers(apiKey, region),
      fetchRiskHistory(apiKey, region)
    ]);

    // Upsert user rows
    for (const u of kb4Users) {
      const userId = `hru_kb4_${u.id}`;
      const riskScore = u.current_risk_score ?? 0;
      const riskLevel = RISK_LEVEL(riskScore);
      const trainingCompletion = u.training_assignments
        ? Math.round(((u.training_completions_count ?? 0) / u.training_assignments) * 100)
        : 0;
      await pool.query(
        `INSERT INTO human_risk.users
           (id, tenant_id, name, email, department, job_title,
            risk_score, risk_level, risk_score_30d_delta,
            phishing_sent, phishing_clicked, phishing_reported,
            training_assigned, training_completed, training_completion_pct,
            mfa_enabled, privileged_access,
            risk_history, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,now())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, email = EXCLUDED.email,
           department = EXCLUDED.department, job_title = EXCLUDED.job_title,
           risk_score = EXCLUDED.risk_score, risk_level = EXCLUDED.risk_level,
           phishing_sent = EXCLUDED.phishing_sent,
           phishing_clicked = EXCLUDED.phishing_clicked,
           phishing_reported = EXCLUDED.phishing_reported,
           training_assigned = EXCLUDED.training_assigned,
           training_completed = EXCLUDED.training_completed,
           training_completion_pct = EXCLUDED.training_completion_pct,
           mfa_enabled = EXCLUDED.mfa_enabled,
           privileged_access = EXCLUDED.privileged_access,
           risk_history = EXCLUDED.risk_history,
           risk_score_30d_delta = EXCLUDED.risk_score - human_risk.users.risk_score,
           synced_at = now()`,
        [
          userId, tenantId,
          `${u.first_name} ${u.last_name}`.trim(),
          u.email.toLowerCase(),
          u.department ?? '',
          u.job_title ?? '',
          riskScore, riskLevel,
          u.phishing_click_count ?? 0,
          (u.phishing_click_count ?? 0) + (u.mobile_phishing_click_count ?? 0),
          u.phishing_report_count ?? 0,
          u.training_assignments ?? 0,
          u.training_completions_count ?? 0,
          trainingCompletion,
          u.mfa_enrolled ?? true,
          u.admin ?? false,
          JSON.stringify(u.risk_score_history ?? [])
        ]
      );
    }

    // Recompute department rollup
    await pool.query(`
      INSERT INTO human_risk.departments (tenant_id, department, headcount, avg_risk_score, risk_level, phish_prone_pct, training_completion_pct, high_risk_users, synced_at)
      SELECT
        tenant_id,
        COALESCE(NULLIF(department,''), 'Unassigned') AS department,
        COUNT(*) AS headcount,
        ROUND(AVG(risk_score)) AS avg_risk_score,
        CASE WHEN AVG(risk_score) >= 75 THEN 'critical'
             WHEN AVG(risk_score) >= 50 THEN 'high'
             WHEN AVG(risk_score) >= 25 THEN 'moderate'
             ELSE 'low' END AS risk_level,
        ROUND(100.0 * SUM(phishing_clicked) / NULLIF(SUM(phishing_sent),0), 2) AS phish_prone_pct,
        ROUND(AVG(training_completion_pct), 2) AS training_completion_pct,
        SUM(CASE WHEN risk_score >= 50 THEN 1 ELSE 0 END) AS high_risk_users,
        now()
      FROM human_risk.users
      WHERE tenant_id = $1
      GROUP BY tenant_id, COALESCE(NULLIF(department,''), 'Unassigned')
      ON CONFLICT (tenant_id, department) DO UPDATE SET
        headcount = EXCLUDED.headcount,
        avg_risk_score = EXCLUDED.avg_risk_score,
        risk_level = EXCLUDED.risk_level,
        phish_prone_pct = EXCLUDED.phish_prone_pct,
        training_completion_pct = EXCLUDED.training_completion_pct,
        high_risk_users = EXCLUDED.high_risk_users,
        synced_at = now()
    `, [tenantId]);

    // Upsert org_scores from risk history
    const latest = riskHistory[riskHistory.length - 1];
    const yearAgo = riskHistory.find(h => {
      const d = new Date(h.date);
      const cutoff = new Date(Date.now() - 365 * 86_400_000);
      return Math.abs(d.getTime() - cutoff.getTime()) < 30 * 86_400_000;
    });
    if (latest) {
      const headcount = kb4Users.length;
      const highRisk = kb4Users.filter(u => (u.current_risk_score ?? 0) >= 50).length;
      const criticalRisk = kb4Users.filter(u => (u.current_risk_score ?? 0) >= 75).length;
      const totalAssigned = kb4Users.reduce((s, u) => s + (u.training_assignments ?? 0), 0);
      const totalCompleted = kb4Users.reduce((s, u) => s + (u.training_completions_count ?? 0), 0);
      const trainingPct = totalAssigned ? +(totalCompleted / totalAssigned * 100).toFixed(2) : 0;
      const avgScore = headcount
        ? +(kb4Users.reduce((s, u) => s + (u.current_risk_score ?? 0), 0) / headcount).toFixed(0)
        : 0;
      await pool.query(`
        INSERT INTO human_risk.org_scores
          (tenant_id, org_risk_score, org_risk_score_12m_ago,
           phish_prone_pct, phish_prone_pct_12m_ago,
           headcount, users_at_high_risk, users_at_critical_risk,
           training_completion_pct, risk_level,
           risk_score_history, synced_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,now())
        ON CONFLICT (tenant_id) DO UPDATE SET
          org_risk_score = EXCLUDED.org_risk_score,
          org_risk_score_12m_ago = EXCLUDED.org_risk_score_12m_ago,
          phish_prone_pct = EXCLUDED.phish_prone_pct,
          phish_prone_pct_12m_ago = EXCLUDED.phish_prone_pct_12m_ago,
          headcount = EXCLUDED.headcount,
          users_at_high_risk = EXCLUDED.users_at_high_risk,
          users_at_critical_risk = EXCLUDED.users_at_critical_risk,
          training_completion_pct = EXCLUDED.training_completion_pct,
          risk_level = EXCLUDED.risk_level,
          risk_score_history = EXCLUDED.risk_score_history,
          synced_at = now()
      `, [
        tenantId,
        avgScore,
        yearAgo ? Math.round(yearAgo.risk_score) : avgScore,
        latest.phish_prone_percentage,
        yearAgo ? yearAgo.phish_prone_percentage : latest.phish_prone_percentage,
        headcount, highRisk, criticalRisk,
        trainingPct,
        RISK_LEVEL(avgScore),
        JSON.stringify(riskHistory.slice(-12).map(h => Math.round(h.risk_score)))
      ]);
    }

    // Record sync job
    await pool.query(
      `INSERT INTO human_risk.sync_jobs (tenant_id, status) VALUES ($1, 'ok')`,
      [tenantId]
    );

    const ms = Date.now() - startedAt;
    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId,
      action: 'human_risk.synced',
      target: `tenant:${tenantId}`,
      result: 'success',
      metadata: { usersUpserted: kb4Users.length, durationMs: ms }
    });

    return json({ ok: true, usersSync: kb4Users.length, durationMs: ms });
  } catch (e) {
    const msg = (e as Error).message ?? 'Unknown error';
    await pool.query(
      `INSERT INTO human_risk.sync_jobs (tenant_id, status) VALUES ($1, 'error')`,
      [tenantId]
    ).catch(() => { /* best-effort */ });
    writeAuditLog({
      userId: locals.user.id,
      actorEmail: locals.user.email,
      tenantId,
      action: 'human_risk.sync_failed',
      target: `tenant:${tenantId}`,
      result: 'failure',
      metadata: { error: msg }
    });
    throw error(502, `KnowBe4 sync failed: ${msg}`);
  }
};
