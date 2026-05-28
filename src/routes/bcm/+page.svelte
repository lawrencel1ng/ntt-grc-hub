<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import {
    LifeBuoy, ShieldAlert, Clock, CheckCircle2, Activity, ChevronRight, Network
  } from 'lucide-svelte';
  import type { BCMPlan, BCMDependency, BCMTest } from '$lib/data/types';

  export let data;

  type Row = { plan: BCMPlan; deps: BCMDependency[]; tests: BCMTest[] };

  // ---------- KPIs ----------
  $: total = data.rows.length;
  $: critical = data.rows.filter((r: Row) => r.deps.some((d) => d.criticality === 'critical')).length;
  $: testedLastQ = data.rows.filter((r: Row) => {
    if (!r.plan.lastTestedAt) return false;
    return (Date.now() - new Date(r.plan.lastTestedAt).getTime()) < 90 * 86_400_000;
  }).length;
  $: testedPct = total > 0 ? Math.round((testedLastQ / total) * 100) : 0;
  $: withinRto = data.rows.filter((r: Row) => {
    const last = r.tests[0];
    return last && (last.result === 'pass' || last.result === 'partial');
  }).length;
  $: withinRtoPct = total > 0 ? Math.round((withinRto / total) * 100) : 0;
  $: biaOpen = data.rows.reduce((s: number, r: Row) =>
    s + r.deps.filter((d) => d.criticality === 'critical' || d.criticality === 'high').length, 0);

  // ---------- Status traffic-light ----------
  function rowStatus(r: Row): 'green' | 'amber' | 'red' {
    const last = r.tests[0];
    if (!last) return 'amber';
    if (last.result === 'fail') return 'red';
    if (last.result === 'partial') return 'amber';
    if (r.plan.lastTestedAt && (Date.now() - new Date(r.plan.lastTestedAt).getTime()) > 180 * 86_400_000) return 'amber';
    return 'green';
  }

  function fmtMin(min: number): string {
    if (min < 60) return `${min}m`;
    if (min < 1440) return `${Math.round(min / 60)}h`;
    return `${Math.round(min / 1440)}d`;
  }
  function fmtRel(iso?: string): string {
    if (!iso) return '—';
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const ad = Math.abs(diff);
    if (ad < 3600) return `${Math.floor(ad / 60)}m ${diff > 0 ? 'in' : 'ago'}`;
    if (ad < 86400) return `${Math.floor(ad / 3600)}h ${diff > 0 ? 'in' : 'ago'}`;
    return `${Math.floor(ad / 86400)}d ${diff > 0 ? 'in' : 'ago'}`;
  }
  function dateColor(iso?: string, kind: 'past' | 'future' = 'past'): string {
    if (!iso) return 'text-slate-400';
    const ms = new Date(iso).getTime() - Date.now();
    if (kind === 'past') {
      const ago = -ms;
      if (ago > 180 * 86_400_000) return 'text-rose-600';
      if (ago > 90 * 86_400_000)  return 'text-amber-600';
      return 'text-violet-700';
    } else {
      if (ms < 0) return 'text-rose-600';
      if (ms < 30 * 86_400_000) return 'text-amber-600';
      return 'text-slate-500';
    }
  }
  function ownerFor(_r: Row): string {
    return 'CRO Office';
  }
</script>

<PageHeader title="Business Continuity Management" subtitle="ISO 22301 · MAS Notice 657 · DORA {data.isAll ? '· Maybank fallback' : ''}" />

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
    <Kpi label="Total Plans" value={total.toString()}>
      <LifeBuoy slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="Critical Services" value={critical.toString()} tone="bad">
      <ShieldAlert slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Tested Last Quarter" value={testedPct.toString()} suffix="%" hint="{testedLastQ}/{total} plans">
      <Activity slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Within RTO Target" value={withinRtoPct.toString()} suffix="%" hint="{withinRto}/{total} on-target">
      <CheckCircle2 slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Open BIA Dependencies" value={biaOpen.toString()} hint="critical + high">
      <Network slot="icon" class="h-4 w-4 text-amber-600" />
    </Kpi>
  </div>

  <!-- Plan cards grid -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {#each data.rows as r (r.plan.id)}
      {@const status = rowStatus(r)}
      <a href="/bcm/{r.plan.id}" class="block">
        <div class="card card-hover h-full p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate font-semibold text-grc-ink">{r.plan.name}</div>
              <div class="mt-0.5 text-xs text-slate-500">{r.plan.businessService}</div>
            </div>
            <StatusDot status={status} withLabel={false} />
          </div>
          <div class="mt-3 flex items-center gap-2">
            <span class="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
              RTO {fmtMin(r.plan.rtoMinutes)}
            </span>
            <span class="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              RPO {fmtMin(r.plan.rpoMinutes)}
            </span>
          </div>
          <div class="mt-3 space-y-1.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1 text-slate-500"><Clock class="h-3 w-3" /> Last tested</span>
              <span class="font-mono {dateColor(r.plan.lastTestedAt, 'past')}">{fmtRel(r.plan.lastTestedAt)}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1 text-slate-500"><Clock class="h-3 w-3" /> Next test</span>
              <span class="font-mono {dateColor(r.plan.nextTestAt, 'future')}">{fmtRel(r.plan.nextTestAt)}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Owner</span>
              <span class="font-medium text-slate-700">{ownerFor(r)}</span>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
            <span class="text-slate-500">{r.deps.length} deps · {r.tests.length} tests</span>
            <span class="inline-flex items-center gap-0.5 text-grc-primary">View plan <ChevronRight class="h-3 w-3" /></span>
          </div>
        </div>
      </a>
    {:else}
      <div class="col-span-3 px-4 py-8 text-center text-sm text-slate-500">No BCM plans recorded.</div>
    {/each}
  </div>
</div>
