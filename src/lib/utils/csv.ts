/**
 * Convert an array of records to a CSV string. Handles common escaping
 * rules: wrap in quotes if the value contains comma/quote/newline,
 * double-up internal quotes.
 *
 * If `columns` is omitted we infer from the first row's keys.
 */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns?: (keyof T)[]
): string {
  if (rows.length === 0) return columns?.join(',') ?? '';
  const cols = columns ?? (Object.keys(rows[0]) as (keyof T)[]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.map((c) => escape(String(c))).join(',');
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}
