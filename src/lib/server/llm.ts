/**
 * Thin LLM abstraction that routes to the correct AI provider based on
 * the tenant's configured `ai_provider` column.
 *
 * Supported providers (all fall back to template when key is absent):
 *   anthropic  — ANTHROPIC_API_KEY  (uses @anthropic-ai/sdk)
 *   openai     — OPENAI_API_KEY     (uses fetch against OpenAI chat completions)
 *   tsuzumi    — TSUZUMI_API_KEY    (uses fetch against NTT Tsuzumi endpoint)
 */

import { env } from '$env/dynamic/private';
import { isPgMode, getPool } from './pg';

export type LlmProvider = 'anthropic' | 'openai' | 'tsuzumi';

export interface LlmOptions {
  maxTokens?: number;
  model?: string;
}

/**
 * Look up the tenant's configured AI provider from the DB.
 * Falls back to 'anthropic' if not in pg mode or tenant not found.
 */
export async function getTenantProvider(tenantId?: string): Promise<LlmProvider> {
  if (!tenantId || !isPgMode()) return 'anthropic';
  try {
    const pool = getPool();
    const { rows } = await pool.query<{ ai_provider: string }>(
      `SELECT COALESCE(ai_provider, 'anthropic') AS ai_provider
       FROM platform.tenants WHERE id = $1 LIMIT 1`,
      [tenantId]
    );
    const val = rows[0]?.ai_provider ?? 'anthropic';
    if (val === 'openai' || val === 'tsuzumi') return val;
    return 'anthropic';
  } catch {
    return 'anthropic';
  }
}

/**
 * Call the LLM and return the text response, or null on failure.
 *
 * @param systemPrompt  Instruction/context for the model
 * @param userPrompt    The user message
 * @param provider      Which backend to use
 * @param opts          Optional model / max_tokens overrides
 */
export async function callLlm(
  systemPrompt: string,
  userPrompt: string,
  provider: LlmProvider = 'anthropic',
  opts: LlmOptions = {}
): Promise<string | null> {
  const maxTokens = opts.maxTokens ?? 700;

  if (provider === 'anthropic') {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: opts.model ?? 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });
      const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
      return text.trim() || null;
    } catch {
      return null;
    }
  }

  if (provider === 'openai') {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) return null;
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: opts.model ?? 'gpt-4o-mini',
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        }),
        signal: AbortSignal.timeout(30_000)
      });
      if (!res.ok) return null;
      const body = await res.json() as { choices?: { message?: { content?: string } }[] };
      return body.choices?.[0]?.message?.content?.trim() || null;
    } catch {
      return null;
    }
  }

  if (provider === 'tsuzumi') {
    const apiKey = env.TSUZUMI_API_KEY;
    const endpoint = env.TSUZUMI_ENDPOINT ?? 'https://api.ntt-tsuzumi.ai/v1/chat/completions';
    if (!apiKey) return null;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: opts.model ?? 'tsuzumi-7b',
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        }),
        signal: AbortSignal.timeout(30_000)
      });
      if (!res.ok) return null;
      const body = await res.json() as { choices?: { message?: { content?: string } }[] };
      return body.choices?.[0]?.message?.content?.trim() || null;
    } catch {
      return null;
    }
  }

  return null;
}
