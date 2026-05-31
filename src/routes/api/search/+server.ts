import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isPgMode, getPool } from '$lib/server/pg';
import { checkRateLimit } from '$lib/server/rateLimit';

export interface SearchResult {
  kind: 'risk' | 'control' | 'policy' | 'vendor' | 'issue';
  id: string;
  code?: string;
  title: string;
  subtitle?: string;
  href: string;
}

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) throw error(401, 'Not authenticated');
  if (!checkRateLimit('search', locals.user.id, 60, 60_000)) throw error(429, 'Too many searches — slow down.');

  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return json({ results: [] });
  if (q.length > 128) throw error(400, 'Query too long');

  if (!isPgMode()) return json({ results: [] });

  const pool = getPool();
  const tenantId = locals.user.tenantId;
  const likeQ = `%${q.toLowerCase()}%`;
  const isAdmin = locals.user.role === 'admin';

  const [risks, controls, policies, vendors, issues] = await Promise.all([
    pool.query<{ id: string; code: string; title: string; residual_severity: string }>(
      `SELECT id::text, code, title, residual_severity::text
       FROM risk.risks
       WHERE (${isAdmin ? 'TRUE' : 'tenant_id = $2'})
         AND (lower(title) LIKE $1 OR lower(code) LIKE $1 OR lower(description) LIKE $1)
       ORDER BY residual_severity DESC, title
       LIMIT 5`,
      isAdmin ? [likeQ] : [likeQ, tenantId]
    ).catch(() => ({ rows: [] as never[] })),

    pool.query<{ id: string; code: string; title: string; maturity: string }>(
      `SELECT id::text, code, title, maturity::text
       FROM control.library
       WHERE (${isAdmin ? 'TRUE' : 'tenant_id = $2'})
         AND (lower(title) LIKE $1 OR lower(code) LIKE $1 OR lower(description) LIKE $1)
       ORDER BY code
       LIMIT 5`,
      isAdmin ? [likeQ] : [likeQ, tenantId]
    ).catch(() => ({ rows: [] as never[] })),

    pool.query<{ id: string; code: string; title: string; jurisdiction: string }>(
      `SELECT id::text, code, title, jurisdiction
       FROM policy.documents
       WHERE (${isAdmin ? 'TRUE' : 'tenant_id = $2'})
         AND (lower(title) LIKE $1 OR lower(code) LIKE $1)
       ORDER BY code
       LIMIT 5`,
      isAdmin ? [likeQ] : [likeQ, tenantId]
    ).catch(() => ({ rows: [] as never[] })),

    pool.query<{ id: string; name: string; category: string }>(
      `SELECT id::text, name, category
       FROM vendor.vendors
       WHERE (${isAdmin ? 'TRUE' : 'tenant_id = $2'})
         AND (lower(name) LIKE $1 OR lower(category) LIKE $1)
       ORDER BY name
       LIMIT 5`,
      isAdmin ? [likeQ] : [likeQ, tenantId]
    ).catch(() => ({ rows: [] as never[] })),

    pool.query<{ id: string; title: string; severity: string }>(
      `SELECT id::text, title, severity::text
       FROM issue.issues
       WHERE (${isAdmin ? 'TRUE' : 'tenant_id = $2'})
         AND status != 'closed'
         AND lower(title) LIKE $1
       ORDER BY severity DESC, created_at DESC
       LIMIT 5`,
      isAdmin ? [likeQ] : [likeQ, tenantId]
    ).catch(() => ({ rows: [] as never[] }))
  ]);

  const results: SearchResult[] = [
    ...risks.rows.map((r) => ({
      kind: 'risk' as const,
      id: r.id,
      code: r.code,
      title: r.title,
      subtitle: r.residual_severity,
      href: `/risk/${r.id}`
    })),
    ...controls.rows.map((c) => ({
      kind: 'control' as const,
      id: c.id,
      code: c.code,
      title: c.title,
      subtitle: c.maturity,
      href: `/controls/${c.id}`
    })),
    ...policies.rows.map((p) => ({
      kind: 'policy' as const,
      id: p.id,
      code: p.code,
      title: p.title,
      subtitle: p.jurisdiction,
      href: `/policies/${p.id}`
    })),
    ...vendors.rows.map((v) => ({
      kind: 'vendor' as const,
      id: v.id,
      title: v.name,
      subtitle: v.category,
      href: `/vendors/${v.id}`
    })),
    ...issues.rows.map((i) => ({
      kind: 'issue' as const,
      id: i.id,
      title: i.title,
      subtitle: i.severity,
      href: `/issues`
    }))
  ];

  return json({ results });
};
