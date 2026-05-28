<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import { addToast } from '$lib/stores/toast';
  import {
    LifeBuoy, Clock, Calendar, BookOpen, Network, History as HistoryIcon, AlertTriangle,
    Users as UsersIcon, Server, MapPin, Building
  } from 'lucide-svelte';
  import type {
    BCMPlan, BCMDependency, BCMTest, BCMTestKind, BCMTestResult, BCMDependencyKind,
    VendorCriticality, Risk, RiskSeverity
  } from '$lib/data/types';

  export let data;

  // ---------- Tabs ----------
  type Tab = 'overview' | 'bia' | 'tests' | 'risks';
  let tab: Tab = 'overview';
  const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: 'overview', label: 'Overview',         icon: BookOpen },
    { id: 'bia',      label: 'BIA Dependencies', icon: Network },
    { id: 'tests',    label: 'Tests History',    icon: HistoryIcon },
    { id: 'risks',    label: 'Linked Risks',     icon: AlertTriangle }
  ];

  // ---------- Helpers ----------
  function fmtMin(min: number): string {
    if (min < 60) return `${min}m`;
    if (min < 1440) return `${Math.round(min / 60)}h`;
    return `${Math.round(min / 1440)}d`;
  }
  function fmtDate(iso?: string): string {
    if (!iso) return '—';
    return iso.slice(0, 10);
  }
  function fmtRel(iso?: string): string {
    if (!iso) return '—';
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const ad = Math.abs(diff);
    if (ad < 86400) return `${Math.floor(ad / 3600)}h ${diff > 0 ? 'in' : 'ago'}`;
    return `${Math.floor(ad / 86400)}d ${diff > 0 ? 'in' : 'ago'}`;
  }
  function depKindIcon(k: BCMDependencyKind) {
    switch (k) {
      case 'people': return UsersIcon;
      case 'tech':   return Server;
      case 'site':   return MapPin;
      case 'vendor': return Building;
    }
  }
  function depKindCls(k: BCMDependencyKind): string {
    switch (k) {
      case 'people': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'tech':   return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'site':   return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'vendor': return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }
  function critCls(c: VendorCriticality): string {
    switch (c) {
      case 'critical': return 'bg-rose-100 text-rose-800 ring-rose-200';
      case 'high':     return 'bg-orange-50 text-orange-700 ring-orange-200';
      case 'medium':   return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'low':      return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }
  function testResultCls(r: BCMTestResult): string {
    switch (r) {
      case 'pass':    return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'partial': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'fail':    return 'bg-rose-50 text-rose-700 ring-rose-200';
    }
  }
  function testKindCls(k: BCMTestKind): string {
    switch (k) {
      case 'tabletop':       return 'bg-slate-100 text-slate-700 ring-slate-200';
      case 'walkthrough':    return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'simulation':     return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'full-failover':  return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }
  function sevCls(s: RiskSeverity): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'low')      return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }

  // ---------- Synthesised description, recovery strategy, escalation contacts ----------
  function description(p: BCMPlan): string {
    return `${p.name} establishes the continuity and recovery posture for ${p.businessService}. The plan defines RTO of ${fmtMin(p.rtoMinutes)} and RPO of ${fmtMin(p.rpoMinutes)}, with multi-region failover to a warm-standby environment and quarterly tabletop exercises.`;
  }
  function recoveryStrategy(_p: BCMPlan): string {
    return 'Active-active across two AZ-pairs (ap-southeast-1a/1b) with cross-region async replication to ap-southeast-3. Tier-1 data is backed up every 15 minutes; tier-2 hourly. DR runbook auto-generated in Confluence and validated by Resilience Coach agent monthly.';
  }
  const ESCALATION_CONTACTS = [
    { name: 'Incident Commander', role: 'CRO Office', email: 'ic@example.com', phone: '+65 9000 1001' },
    { name: 'Tech Lead',          role: 'SRE',        email: 'sre@example.com', phone: '+65 9000 1002' },
    { name: 'Comms Lead',         role: 'PR',         email: 'pr@example.com',  phone: '+65 9000 1003' },
    { name: 'Regulatory Lead',    role: 'Compliance', email: 'comp@example.com', phone: '+65 9000 1004' }
  ];

  // ---------- Action ----------
  function scheduleTest() {
    addToast('success', `Test scheduled for ${data.plan.name}. Resilience Coach agent will draft scenario and notify owners.`);
  }
</script>

<PageHeader
  title={data.plan.name}
  breadcrumbs={[{ label: 'BCM', href: '/bcm' }, { label: data.plan.name }]}
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">RTO {fmtMin(data.plan.rtoMinutes)}</span>
    <span class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">RPO {fmtMin(data.plan.rpoMinutes)}</span>
    <button class="btn-primary" on:click={scheduleTest}>
      <Calendar class="h-4 w-4" />
      <span>Schedule Test</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- Title card -->
  <div class="card p-5">
    <div class="flex items-start gap-3">
      <div class="rounded-lg bg-rose-50 p-2 text-rose-700"><LifeBuoy class="h-5 w-5" /></div>
      <div class="flex-1">
        <h2 class="text-lg font-semibold text-grc-ink">{data.plan.businessService}</h2>
        <p class="mt-1 text-sm text-slate-600">Owner: <span class="font-medium text-slate-800">CRO Office</span></p>
      </div>
    </div>
  </div>

  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="RTO Target" value={fmtMin(data.plan.rtoMinutes)} hint="recovery time">
      <Clock slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="RPO Target" value={fmtMin(data.plan.rpoMinutes)} hint="recovery point">
      <Clock slot="icon" class="h-4 w-4 text-amber-600" />
    </Kpi>
    <Kpi label="Last Tested" value={fmtRel(data.plan.lastTestedAt)}>
      <HistoryIcon slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Next Test" value={fmtRel(data.plan.nextTestAt)}>
      <Calendar slot="icon" class="h-4 w-4 text-blue-600" />
    </Kpi>
  </div>

  <!-- Tabs -->
  <div class="card overflow-hidden">
    <div class="flex flex-wrap border-b border-slate-100 px-2">
      {#each TABS as t}
        {@const Icon = t.icon}
        <button type="button"
          class="-mb-px flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors {tab === t.id
            ? 'border-grc-primary text-grc-primary'
            : 'border-transparent text-slate-500 hover:text-slate-700'}"
          on:click={() => (tab = t.id)}>
          <Icon class="h-4 w-4" />
          {t.label}
        </button>
      {/each}
    </div>

    <!-- Overview -->
    {#if tab === 'overview'}
      <div class="space-y-5 p-5 text-sm">
        <div>
          <div class="section-title text-xs">Plan Description</div>
          <p class="mt-1 leading-relaxed text-slate-700">{description(data.plan)}</p>
        </div>
        <div>
          <div class="section-title text-xs">Recovery Strategy</div>
          <p class="mt-1 leading-relaxed text-slate-700">{recoveryStrategy(data.plan)}</p>
        </div>
        <div>
          <div class="section-title text-xs">Escalation Contacts</div>
          <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {#each ESCALATION_CONTACTS as c}
              <div class="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-grc-ink">{c.name}</span>
                  <span class="tag tag-slate">{c.role}</span>
                </div>
                <div class="mt-1 flex items-center justify-between text-slate-500">
                  <span class="font-mono">{c.email}</span>
                  <span class="font-mono">{c.phone}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>

    <!-- BIA Dependencies -->
    {:else if tab === 'bia'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Kind</th>
              <th class="px-4 py-2 text-left">Name</th>
              <th class="px-4 py-2 text-left">Criticality</th>
              <th class="px-4 py-2 text-right">Downtime Tolerance</th>
            </tr>
          </thead>
          <tbody>
            {#each data.deps as d (d.id)}
              {@const Icon = depKindIcon(d.dependencyKind)}
              <tr class="tr">
                <td class="td">
                  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {depKindCls(d.dependencyKind)}">
                    <Icon class="h-3 w-3" />{d.dependencyKind}
                  </span>
                </td>
                <td class="td font-medium">{d.name}</td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {critCls(d.criticality)}">{d.criticality}</span>
                </td>
                <td class="td text-right font-mono text-xs">{d.downtimeToleranceHours}h</td>
              </tr>
            {:else}
              <tr><td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">No dependencies mapped.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Tests History -->
    {:else if tab === 'tests'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Kind</th>
              <th class="px-4 py-2 text-left">Conducted</th>
              <th class="px-4 py-2 text-left">Result</th>
              <th class="px-4 py-2 text-left">Lessons (snippet)</th>
            </tr>
          </thead>
          <tbody>
            {#each data.tests as t (t.id)}
              <tr class="tr">
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {testKindCls(t.kind)}">{t.kind}</span>
                </td>
                <td class="td font-mono text-xs">{fmtDate(t.conductedAt)}</td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {testResultCls(t.result)}">{t.result}</span>
                </td>
                <td class="td max-w-md text-xs text-slate-600">{t.lessonsMd.replace(/^#+\s+/gm, '').slice(0, 140)}{t.lessonsMd.length > 140 ? '…' : ''}</td>
              </tr>
            {:else}
              <tr><td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">No tests recorded.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Linked Risks -->
    {:else if tab === 'risks'}
      <div class="divide-y divide-slate-100">
        {#each data.linkedRisks as r (r.id)}
          <a href="/risk/{r.id}" class="block px-5 py-4 hover:bg-slate-50/60">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs font-semibold text-grc-ink">{r.code}</span>
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(r.residualSeverity)}">{r.residualSeverity}</span>
                  <span class="font-medium text-slate-800">{r.title}</span>
                </div>
                <p class="mt-1 text-xs text-slate-500">{r.description ?? ''}</p>
              </div>
              <span class="tag tag-slate">{r.category}</span>
            </div>
          </a>
        {:else}
          <div class="px-4 py-8 text-center text-sm text-slate-500">No risks currently linked to <span class="font-semibold">{data.plan.businessService}</span>.</div>
        {/each}
      </div>
    {/if}
  </div>
</div>
