// Small date helpers — used across the demo for consistent display.
// We deliberately format dates in Singapore time (SGT, UTC+8) to match
// the tenant focus; tweak the timezone here if expanding to APAC later.

const SGT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Singapore',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
};

export function formatIsoSgt(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-SG', SGT_OPTIONS).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} SGT`;
}

export function formatRelative(date: string | Date, now: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  const diffSec = Math.round((now.getTime() - d.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const future = diffSec < 0;
  let value: number;
  let unit: string;
  if (abs < 60) { value = abs; unit = 'sec'; }
  else if (abs < 3600) { value = Math.floor(abs / 60); unit = 'min'; }
  else if (abs < 86_400) { value = Math.floor(abs / 3600); unit = 'h'; }
  else if (abs < 30 * 86_400) { value = Math.floor(abs / 86_400); unit = 'd'; }
  else if (abs < 365 * 86_400) { value = Math.floor(abs / (30 * 86_400)); unit = 'mo'; }
  else { value = Math.floor(abs / (365 * 86_400)); unit = 'y'; }
  return future ? `in ${value}${unit}` : `${value}${unit} ago`;
}

export function daysAgo(n: number, base: Date = new Date()): Date {
  return new Date(base.getTime() - n * 86_400_000);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export function formatCurrency(amount: number, ccy = 'SGD'): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: ccy,
    maximumFractionDigits: 0
  }).format(amount);
}

/** Format cents as a currency value. */
export function formatCents(cents: number, ccy = 'SGD'): string {
  return formatCurrency(cents / 100, ccy);
}
