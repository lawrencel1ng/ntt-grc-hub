<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import { Building2, AlertTriangle, ShieldCheck, ClipboardCheck, Bot, FileBarChart, ShieldAlert } from 'lucide-svelte';
  import { formatRelative } from '$lib/utils/dates';
  import type { Tenant } from '$lib/data/types';

  export let data;

  function tenantById(id: string): Tenant | undefined {
    return data.tenants.find((t) => t.id === id);
  }

  // ---------- Color-band helper ----------
  // For each metric we declare:
  //   higherIsBetter: bigger numbers are better (e.g. compliance score, FTE saved)
  //   lowerIsBetter:  smaller numbers are better (e.g. critical risks, findings)
  // The helper picks violet (best), amber (middle), rose (worst) by rank.
  type Direction = 'higher' | 'lower';
  function bandCls(values: number[], v: number, dir: Direction): string {
    const sorted = [...values].sort((a, b) => dir === 'higher' ? b - a : a - b);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (v === best && best !== worst) return 'bg-violet-50 text-violet-800 ring-violet-200';
    if (v === worst && best !== worst) return 'bg-rose-50 text-rose-800 ring-rose-200';
    return 'bg-amber-50 text-amber-800 ring-amber-200';
  }

  // ---------- Comparison table rows ----------
  // Each row: label, metric extractor, direction, formatter.
  type Row = {
    label: string;
    get: (h: typeof data.heroes[number]) => number;
    dir: Direction;
    fmt?: (n: number) => string;
    hint?: string;
  };
  const ROWS: Row[] = [
    { label: 'Open Critical Risks',         get: (h) => h.openCriticalRisks, dir: 'lower', hint: 'residual critical & open' },
    { label: 'Avg Compliance Score',        get: (h) => h.avgComplianceScore, dir: 'higher', fmt: (n) => `${n.toFixed(1)}/100`, hint: '8 hero frameworks' },
    { label: 'Open Findings',               get: (h) => h.openFindings, dir: 'lower', hint: 'across audit engagements' },
    { label: 'Vendor Risk Index',           get: (h) => h.vendorRiskIndex, dir: 'lower', fmt: (n) => `${n}/100`, hint: 'aggregate posture' },
    { label: 'Agent FTE Saved (30d)',       get: (h) => h.agentFteSaved30d, dir: 'higher', fmt: (n) => `${n.toFixed(1)} FTE`, hint: '@ 160 hrs/FTE' },
    { label: 'Critical Vendors',            get: (h) => h.criticalVendors, dir: 'lower', hint: 'tier 1 / critical-criticality' },
    { label: 'Active Frameworks',           get: (h) => h.activeFrameworks, dir: 'higher', hint: 'scored in last 90d' }
  ];

  // ---------- Hero card industry/region badge cls ----------
  function regionCls(region: string): string {
    if (region === 'SG') return 'bg-violet-50 text-violet-700 ring-violet-200';
    if (region === 'APAC') return 'bg-blue-50 text-blue-700 ring-blue-200';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
  function tierCls(tier: string): string {
    if (tier === 'sovereign') return 'bg-violet-50 text-violet-700 ring-violet-200';
    if (tier === 'platinum') return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (tier === 'gold') return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
</script>

<PageHeader
  title="MSSP Tenant Comparison"
  subtitle="NTT-managed GRC posture across {data.aggregate.totalTenants} customers"
/>

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
    <Kpi label="Total Tenants" value={data.aggregate.totalTenants.toString()} hint="across APAC">
      <Building2 slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="Avg Compliance" value={data.aggregate.avgComplianceScore.toFixed(1)} suffix="/100">
      <ShieldCheck slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Open Critical Risks" value={data.aggregate.totalOpenCritical.toString()} tone="bad" hint="across all tenants">
      <AlertTriangle slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Active Audits" value={data.aggregate.totalActiveAudits.toString()} hint="in progress">
      <ClipboardCheck slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="Agent FTE Saved (30d)" value={data.aggregate.totalFte30d.toFixed(1)} suffix="FTE" hint="all tenants">
      <Bot slot="icon" class="h-4 w-4 text-violet-500" />
    </Kpi>
  </div>

  <!-- Hero header card -->
  <div class="card overflow-hidden">
    <div class="border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">Hero Tenants</h2>
    </div>
    <div class="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
      {#each data.heroes as h, i}
        {@const t = tenantById(h.tenantId)}
        <div class="p-5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold text-grc-ink">{t?.name ?? h.tenantId}</h3>
                {#if t?.classified}
                  <ShieldAlert class="h-4 w-4 text-rose-500" />
                {/if}
              </div>
              <p class="mt-0.5 text-xs text-slate-500">{t?.industry} · HQ {t?.headquarteredIn}</p>
            </div>
            <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset {regionCls(t?.region ?? '')}">
              {t?.region}
            </span>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset {tierCls(t?.slaTier ?? '')}">
              {t?.slaTier}
            </span>
            <span class="tag tag-emerald">{t?.primaryFramework?.toUpperCase()}</span>
          </div>
          <div class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-lg bg-slate-50 px-2 py-2 ring-1 ring-inset ring-slate-100">
              <div class="text-[10px] uppercase tracking-wider text-slate-400">Risks</div>
              <div class="font-mono text-sm font-semibold text-slate-800">{h.totalRisks}</div>
            </div>
            <div class="rounded-lg bg-slate-50 px-2 py-2 ring-1 ring-inset ring-slate-100">
              <div class="text-[10px] uppercase tracking-wider text-slate-400">Vendors</div>
              <div class="font-mono text-sm font-semibold text-slate-800">{h.totalVendors}</div>
            </div>
            <div class="rounded-lg bg-slate-50 px-2 py-2 ring-1 ring-inset ring-slate-100">
              <div class="text-[10px] uppercase tracking-wider text-slate-400">MRR</div>
              <div class="font-mono text-sm font-semibold text-violet-700">S${((t?.mrrSgd ?? 0) / 1000).toFixed(0)}K</div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Comparison table (long form) -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">Side-by-Side Comparison</h2>
      <span class="text-xs text-slate-400">Green = best · Rose = worst · Amber = middle</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-3 text-left">Metric</th>
            {#each data.heroes as h}
              {@const t = tenantById(h.tenantId)}
              <th class="px-4 py-3 text-center">
                <div class="font-semibold text-slate-700">{t?.name ?? h.tenantId}</div>
                <div class="mt-0.5 text-[10px] font-normal text-slate-400">{t?.industry} · {t?.region}</div>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each ROWS as row}
            {@const values = data.heroes.map((h) => row.get(h))}
            <tr class="tr">
              <td class="td">
                <div class="font-medium text-slate-700">{row.label}</div>
                {#if row.hint}
                  <div class="mt-0.5 text-[10px] text-slate-400">{row.hint}</div>
                {/if}
              </td>
              {#each data.heroes as h}
                {@const v = row.get(h)}
                <td class="td text-center">
                  <span class="inline-flex items-center justify-center rounded-md px-2.5 py-1 font-mono text-sm font-semibold ring-1 ring-inset {bandCls(values, v, row.dir)}">
                    {row.fmt ? row.fmt(v) : v.toLocaleString()}
                  </span>
                </td>
              {/each}
            </tr>
          {/each}
          <tr class="tr">
            <td class="td">
              <div class="font-medium text-slate-700">Last Audit</div>
              <div class="mt-0.5 text-[10px] text-slate-400">most-recent opened engagement</div>
            </td>
            {#each data.heroes as h}
              <td class="td text-center">
                <span class="text-sm text-slate-700">{h.lastAuditAt ? formatRelative(h.lastAuditAt) : '—'}</span>
              </td>
            {/each}
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Shallow tenants secondary table -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">Shallow Tenants</h2>
      <span class="text-xs text-slate-400">{data.shallow.length} tenants · headline metrics only</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Tenant</th>
            <th class="px-4 py-2 text-left">Industry</th>
            <th class="px-4 py-2 text-left">Region</th>
            <th class="px-4 py-2 text-left">Primary Framework</th>
            <th class="px-4 py-2 text-right">Open Risks</th>
            <th class="px-4 py-2 text-right">Avg Score</th>
            <th class="px-4 py-2 text-right">FTE Saved (30d)</th>
            <th class="px-4 py-2 text-right">MRR (S$)</th>
          </tr>
        </thead>
        <tbody>
          {#each data.shallow as s}
            {@const t = tenantById(s.tenantId)}
            <tr class="tr">
              <td class="td font-medium text-grc-primary">{t?.name ?? s.tenantId}</td>
              <td class="td text-slate-600">{t?.industry}</td>
              <td class="td">
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset {regionCls(t?.region ?? '')}">
                  {t?.region}
                </span>
              </td>
              <td class="td">
                <span class="tag tag-slate">{t?.primaryFramework?.toUpperCase()}</span>
              </td>
              <td class="td text-right font-mono">{s.openRisks}</td>
              <td class="td text-right font-mono">{s.avgComplianceScore.toFixed(1)}</td>
              <td class="td text-right font-mono">{s.agentFteSaved30d.toFixed(1)}</td>
              <td class="td text-right font-mono text-violet-700">{((t?.mrrSgd ?? 0) / 1000).toFixed(0)}K</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Footer note -->
  <div class="rounded-xl bg-white px-5 py-4 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
    <FileBarChart class="-mt-1 mr-1 inline h-4 w-4 text-violet-700" />
    NTT operates this fleet as a managed GRC service. The 10-agent platform runs across all eight tenants
    and bills via <span class="font-mono text-xs">agent.cost_ledger</span>; per-tenant FTE-savings flow up to MRR justification.
  </div>
</div>
