<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import Sankey from '$lib/components/Sankey.svelte';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import { addToast } from '$lib/stores/toast';
  import { ShieldAlert, CheckCircle2, Activity, Network, ChevronDown, ChevronRight, CalendarClock } from 'lucide-svelte';
  import type { BCMPlan, BCMDependency, BCMTest, BCMTestResult } from '$lib/data/types';

  export let data;

  let scheduling: string | null = null; // planId being scheduled

  async function scheduleTest(planId: string, kind = 'tabletop') {
    if (scheduling) return;
    scheduling = planId;
    try {
      const res = await fetch(`/api/bcm/${planId}/schedule-test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind })
      });
      if (res.ok) {
        addToast('success', `${kind} test scheduled.`);
      } else {
        const msg = await res.text().catch(() => '');
        addToast('error', msg || 'Could not schedule test — check permissions.');
      }
    } catch {
      addToast('error', 'Network error scheduling test.');
    } finally {
      scheduling = null;
    }
  }

  type Row = { plan: BCMPlan; deps: BCMDependency[]; tests: BCMTest[] };

  // ---------- KPIs ----------
  $: totalIBS = data.rows.length;
  $: criticalIBS = data.rows.filter((r) => r.deps.some((d) => d.criticality === 'critical')).length;
  $: testedLastQuarter = data.rows.filter((r) => {
    if (!r.plan.lastTestedAt) return false;
    return (Date.now() - new Date(r.plan.lastTestedAt).getTime()) < 90 * 86_400_000;
  }).length;
  $: testedPct = totalIBS ? Math.round((testedLastQuarter / totalIBS) * 100) : 0;

  $: withinRtoTargets = data.rows.filter((r) => {
    const last = r.tests[0];
    return last && (last.result === 'pass' || last.result === 'partial');
  }).length;
  $: withinPct = totalIBS ? Math.round((withinRtoTargets / totalIBS) * 100) : 0;

  $: depsAtRisk = data.rows.reduce((s, r) =>
    s + r.deps.filter((d) => d.criticality === 'critical' || d.criticality === 'high').length, 0);

  $: lastTested = data.rows
    .map((r) => r.plan.lastTestedAt)
    .filter((x): x is string => Boolean(x))
    .sort()
    .pop();

  // ---------- Expand-row state ----------
  let openId: string | null = null;
  function toggle(id: string) { openId = openId === id ? null : id; }

  // ---------- Status traffic-light per row ----------
  function rowStatus(r: Row): 'green' | 'amber' | 'red' {
    const last = r.tests[0];
    if (!last) return 'amber';
    if (last.result === 'fail') return 'red';
    if (last.result === 'partial') return 'amber';
    // Also flag if tested > 180d ago
    if (r.plan.lastTestedAt && (Date.now() - new Date(r.plan.lastTestedAt).getTime()) > 180 * 86_400_000) return 'amber';
    return 'green';
  }

  // ---------- Sparkline of recent test results (pass=100, partial=60, fail=10) ----------
  function testTrend(tests: BCMTest[]): number[] {
    if (tests.length === 0) return [50, 50, 50];
    const map: Record<BCMTestResult, number> = { pass: 100, partial: 60, fail: 10 };
    return tests.slice().reverse().map((t) => map[t.result]);
  }

  // ---------- Sankey for dependencies. We build 3 columns: Service → Tech → Vendor.
  // Only real BCM dependencies are shown; empty columns are omitted.
  function depsSankey(r: Row) {
    const serviceId = `svc:${r.plan.id}`;
    const nodes: { id: string; name: string; column: 0 | 1 | 2 }[] = [];
    const links: { source: string; target: string; value: number; color?: string }[] = [];
    nodes.push({ id: serviceId, name: r.plan.businessService, column: 0 });

    const techDeps = r.deps.filter((d) => d.dependencyKind === 'tech' || d.dependencyKind === 'site');
    const vendorDeps = r.deps.filter((d) => d.dependencyKind === 'vendor' || d.dependencyKind === 'people');

    // Tech middle column (real deps only)
    techDeps.forEach((t) => {
      const id = `tech-${t.id}`;
      nodes.push({ id, name: t.name, column: 1 });
      links.push({ source: serviceId, target: id, value: critWeight(t.criticality), color: critColor(t.criticality) });
    });

    // Vendor right column (real deps only)
    vendorDeps.forEach((v) => {
      const id = `vnd-${v.id}`;
      nodes.push({ id, name: v.name, column: 2 });
      if (techDeps.length) {
        techDeps.forEach((t) => {
          links.push({ source: `tech-${t.id}`, target: id, value: critWeight(v.criticality), color: critColor(v.criticality) });
        });
      } else {
        links.push({ source: serviceId, target: id, value: critWeight(v.criticality), color: critColor(v.criticality) });
      }
    });

    return { nodes, links };
  }
  function critWeight(c: string): number {
    switch (c) {
      case 'critical': return 8;
      case 'high':     return 5;
      case 'medium':   return 3;
      default:         return 1;
    }
  }
  function critColor(c: string): string {
    switch (c) {
      case 'critical': return '#e11d48';
      case 'high':     return '#f97316';
      case 'medium':   return '#f59e0b';
      default:         return '#8b5cf6';
    }
  }

  // ---------- Issue badge per row ----------
  function openIssuesForPlan(r: Row): number {
    return data.issues.filter((i) => i.title.toLowerCase().includes(r.plan.businessService.toLowerCase()) && (i.status === 'open' || i.status === 'in-progress')).length;
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
    if (ad < 3600) return `${Math.floor(ad / 60)}m ${diff > 0 ? '' : 'ago'}`;
    if (ad < 86400) return `${Math.floor(ad / 3600)}h ${diff > 0 ? '' : 'ago'}`;
    return `${Math.floor(ad / 86400)}d ${diff > 0 ? '' : 'ago'}`;
  }
  function dateColor(iso?: string, kind: 'past' | 'future' = 'past'): string {
    if (!iso) return 'text-slate-400';
    const ms = new Date(iso).getTime() - Date.now();
    if (kind === 'past') {
      const ago = -ms;
      if (ago > 180 * 86_400_000) return 'text-rose-600';
      if (ago > 90 * 86_400_000) return 'text-amber-600';
      return 'text-violet-700';
    } else {
      if (ms < 0) return 'text-rose-600';
      if (ms < 30 * 86_400_000) return 'text-amber-600';
      return 'text-slate-500';
    }
  }
</script>

<PageHeader title="Operational Resilience" subtitle="DORA · APRA CPS 230 · MAS Notice 658 {data.isAll ? '· aggregated view' : ''}" />

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Important Business Services" value={totalIBS.toString()} hint="{criticalIBS} critical">
      <ShieldAlert slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Tested Last Quarter" value={testedPct.toString()} suffix="%" hint="{testedLastQuarter}/{totalIBS} services">
      <Activity slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Within RTO/RPO" value={withinPct.toString()} suffix="%" hint="{withinRtoTargets}/{totalIBS} on-target">
      <CheckCircle2 slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Dependencies at Risk" value={depsAtRisk.toString()} tone="bad">
      <Network slot="icon" class="h-4 w-4 text-amber-600" />
    </Kpi>
  </div>

  <!-- Hero card -->
  <div class="card p-5">
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <div class="rounded-lg bg-rose-50 p-2 text-rose-700"><ShieldAlert class="h-5 w-5" /></div>
      <div class="flex-1">
        <div class="font-semibold text-grc-ink">
          {totalIBS} Important Business Services mapped
        </div>
        <div class="mt-1 text-xs text-slate-500">
          {criticalIBS} critical · {totalIBS - criticalIBS} non-critical · Last tested: <span class="font-mono">{lastTested ? lastTested.slice(0, 10) : '—'}</span> ({fmtRel(lastTested)})
        </div>
      </div>
    </div>
  </div>

  <!-- IBS Table -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">Important Business Services</h2>
      <span class="text-xs text-slate-400">{totalIBS} services · click a row to expand</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="w-6 px-2 py-2"></th>
            <th class="px-4 py-2 text-left">Service</th>
            <th class="px-4 py-2 text-left">Category</th>
            <th class="px-4 py-2 text-left">Owner</th>
            <th class="px-4 py-2 text-right">RTO</th>
            <th class="px-4 py-2 text-right">RPO</th>
            <th class="px-4 py-2 text-left">Last Tested</th>
            <th class="px-4 py-2 text-left">Next Test</th>
            <th class="px-4 py-2 text-center">Deps</th>
            <th class="px-4 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each data.rows as r (r.plan.id)}
            {@const isOpen = openId === r.plan.id}
            <tr class="tr cursor-pointer" on:click={() => toggle(r.plan.id)}>
              <td class="td">
                {#if isOpen}<ChevronDown class="h-4 w-4 text-slate-400" />{:else}<ChevronRight class="h-4 w-4 text-slate-400" />{/if}
              </td>
              <td class="td font-medium">{r.plan.name}</td>
              <td class="td"><span class="tag tag-slate">{r.plan.businessService}</span></td>
              <td class="td text-xs text-slate-500">{r.plan.ownerEmail ?? '—'}</td>
              <td class="td text-right font-mono text-xs">{fmtMin(r.plan.rtoMinutes)}</td>
              <td class="td text-right font-mono text-xs">{fmtMin(r.plan.rpoMinutes)}</td>
              <td class="td font-mono text-xs {dateColor(r.plan.lastTestedAt, 'past')}">{fmtRel(r.plan.lastTestedAt)}</td>
              <td class="td font-mono text-xs {dateColor(r.plan.nextTestAt, 'future')}">{fmtRel(r.plan.nextTestAt)}</td>
              <td class="td text-center font-mono text-xs">{r.deps.length}</td>
              <td class="td"><StatusDot status={rowStatus(r)} withLabel /></td>
            </tr>
            {#if isOpen}
              {@const sk = depsSankey(r)}
              {@const issuesCount = openIssuesForPlan(r)}
              <tr class="border-t border-slate-100 bg-slate-50/60">
                <td colspan="10" class="p-5">
                  <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div class="lg:col-span-2">
                      <div class="section-title mb-2 text-xs">Dependency Map (Service → Tech → Vendor)</div>
                      <div class="rounded-lg bg-white ring-1 ring-inset ring-slate-200/70 p-3">
                        <Sankey nodes={sk.nodes} links={sk.links} height={260} />
                      </div>
                    </div>
                    <div class="space-y-3">
                      <div>
                        <div class="section-title mb-1 text-xs">Recent Test Results</div>
                        <div class="rounded-lg bg-white ring-1 ring-inset ring-slate-200/70 p-3">
                          {#if r.tests.length > 0}
                            <Sparkline data={testTrend(r.tests)} height={48} />
                            <ul class="mt-2 space-y-1 text-xs text-slate-600">
                              {#each r.tests.slice(0, 3) as t}
                                <li class="flex items-center justify-between">
                                  <span class="font-mono">{t.conductedAt.slice(0, 10)}</span>
                                  <span class="tag tag-{t.result === 'pass' ? 'emerald' : t.result === 'partial' ? 'amber' : 'red'}">{t.kind} · {t.result}</span>
                                </li>
                              {/each}
                            </ul>
                          {:else}
                            <div class="text-xs text-slate-400">No test results recorded.</div>
                          {/if}
                        </div>
                      </div>
                      <div>
                        <div class="section-title mb-1 text-xs">Open Issues</div>
                        <a href="/issues" class="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs">
                          <span class="font-mono text-base font-semibold text-rose-700">{issuesCount}</span>
                          <span class="text-rose-700">open · view in Issues →</span>
                        </a>
                      </div>
                      {#if !data.isAll}
                        <div>
                          <div class="section-title mb-1 text-xs">Actions</div>
                          <div class="flex flex-wrap gap-2">
                            {#each ['tabletop', 'walkthrough', 'simulation', 'full-failover'] as kind}
                              <button
                                class="btn-secondary py-1 text-xs"
                                disabled={scheduling === r.plan.id}
                                on:click|stopPropagation={() => scheduleTest(r.plan.id, kind)}
                              >
                                <CalendarClock class="h-3 w-3" />
                                {kind}
                              </button>
                            {/each}
                          </div>
                        </div>
                      {/if}
                    </div>
                  </div>
                </td>
              </tr>
            {/if}
          {:else}
            <tr><td colspan="10" class="px-4 py-8 text-center text-sm text-slate-500">No Important Business Services mapped.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
