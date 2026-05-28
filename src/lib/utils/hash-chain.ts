import { createHash } from 'node:crypto';

/**
 * Compute a row hash for a hash-chained ledger entry. The chain is
 * defined as: row_hash = sha256(prev_hash || '|' || canonicalJson(payload)).
 *
 * Use a `|` delimiter so a payload that contains the prev hash text as a
 * value can't collide with the link.
 */
export function rowHash(prevHash: string | null | undefined, payload: object): string {
  const h = createHash('sha256');
  h.update(prevHash ?? '');
  h.update('|');
  h.update(JSON.stringify(payload));
  return h.digest('hex');
}

export interface ChainItem {
  prevHash: string | null | undefined;
  rowHash: string;
  payload: object;
}

/**
 * Verifies a sequence of hash-chain items. Returns the first index where
 * recomputed != stored, or `{ ok: true }` if intact.
 */
export function verifyChain(items: ChainItem[]): { ok: boolean; brokenAt?: number } {
  let prev: string | null | undefined = null;
  for (let i = 0; i < items.length; i++) {
    const computed = rowHash(prev, items[i].payload);
    if (computed !== items[i].rowHash) return { ok: false, brokenAt: i };
    prev = items[i].rowHash;
  }
  return { ok: true };
}
