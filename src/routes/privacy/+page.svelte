<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import {
    Lock, FileText, Mail, Globe, AlertTriangle,
    ScrollText, ClipboardCheck, Users as UsersIcon, ShieldAlert
  } from 'lucide-svelte';
  import type {
    PrivacyActivity, DPIA, SubjectRequest, Breach,
    RiskSeverity, SubjectRequestKind, SubjectRequestStatus
  } from '$lib/data/types';

  export let data;

  // ---------- KPIs ----------
  $: activitiesCount = data.activities.length;
  $: activeDpiasCount = data.dpias.filter((d: DPIA) => d.status !== 'retired').length;
  $: requests90d = data.requests.filter((r: SubjectRequest) =>
    (Date.now() - new Date(r.receivedAt).getTime()) <= 90 * 86_400_000).length;
  $: openBreaches = data.breaches.filter((b: Breach) => !b.reportedAt).length || data.breaches.length;
  $: crossBorderCount = data.activities.filter((a: PrivacyActivity) => a.crossBorder).length;

  // ---------- Tabs ----------
  type Tab = 'ropa' | 'dpias' | 'requests' | 'breaches';
  let tab: Tab = 'ropa';
  const TABS: { id: Tab; label: string; icon: typeof FileText; count: number }[] = [];
  $: TABS.length = 0; // reset
  $: TABS.push(
    { id: 'ropa',     label: 'RoPA',             icon: ScrollText,     count: activitiesCount },
    { id: 'dpias',    label: 'DPIAs',            icon: ClipboardCheck, count: data.dpias.length },
    { id: 'requests', label: 'Subject Requests', icon: UsersIcon,      count: data.requests.length },
    { id: 'breaches', label: 'Breaches',         icon: ShieldAlert,    count: data.breaches.length }
  );

  // ---------- Helpers ----------
  function sevCls(s: RiskSeverity | string): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'low')      return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }

  function basisCls(b: string): string {
    switch (b) {
      case 'consent':             return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
      case 'contract':            return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'legal-obligation':    return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'legitimate-interests':return 'bg-amber-50 text-amber-700 ring-amber-200';
      default:                    return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }

  function dpiaStatusCls(s: string): string {
    switch (s) {
      case 'approved':  return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
      case 'in-review': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'draft':     return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'retired':   return 'bg-slate-100 text-slate-500 ring-slate-200';
      default:          return 'bg-slate-100 text-slate-600 ring-slate-200';
    }
  }

  function srKindCls(k: SubjectRequestKind): string {
    switch (k) {
      case 'access':        return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'erasure':       return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'portability':   return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'objection':     return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'rectification': return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    }
  }

  function srStatusCls(s: SubjectRequestStatus): string {
    switch (s) {
      case 'received':    return 'bg-slate-100 text-slate-700 ring-slate-200';
      case 'in-progress': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'resolved':    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
      case 'rejected':    return 'bg-rose-50 text-rose-700 ring-rose-200';
    }
  }

  function slaPct(r: SubjectRequest): number {
    const total = new Date(r.dueAt).getTime() - new Date(r.receivedAt).getTime();
    const elapsed = Date.now() - new Date(r.receivedAt).getTime();
    if (total <= 0) return 100;
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  }
  function slaColor(pct: number): string {
    if (pct >= 90) return 'bg-rose-500';
    if (pct >= 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  function fmtDate(iso?: string): string {
    if (!iso) return '—';
    return iso.slice(0, 10);
  }
  function fmtDays(iso?: string): string {
    if (!iso) return '—';
    const diff = (new Date(iso).getTime() - Date.now()) / 86_400_000;
    if (Math.abs(diff) < 1) return `today`;
    if (diff > 0) return `in ${Math.ceil(diff)}d`;
    return `${Math.floor(-diff)}d ago`;
  }

  // Sort breaches chronologically (most recent first)
  $: breachesSorted = data.breaches.slice().sort((a: Breach, b: Breach) =>
    new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  // Sort DPIAs by status priority (in-review > draft > approved > retired)
  const DPIA_RANK: Record<string, number> = { 'in-review': 0, 'draft': 1, 'approved': 2, 'retired': 3 };
  $: dpiasSorted = data.dpias.slice().sort((a: DPIA, b: DPIA) =>
    (DPIA_RANK[a.status] ?? 9) - (DPIA_RANK[b.status] ?? 9));

  // Sort subject requests with overdue first
  $: requestsSorted = data.requests.slice().sort((a: SubjectRequest, b: SubjectRequest) =>
    slaPct(b) - slaPct(a));
</script>

<PageHeader title="Privacy" subtitle="GDPR · PDPA · PIPL · CCPA · HIPAA {data.isAll ? '· Maybank fallback' : ''}" />

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
    <Kpi label="Processing Activities" value={activitiesCount.toString()}>
      <ScrollText slot="icon" class="h-4 w-4 text-grc-primary" />
    </Kpi>
    <Kpi label="Active DPIAs" value={activeDpiasCount.toString()}>
      <ClipboardCheck slot="icon" class="h-4 w-4 text-emerald-600" />
    </Kpi>
    <Kpi label="Subject Requests (90d)" value={requests90d.toString()}>
      <UsersIcon slot="icon" class="h-4 w-4 text-blue-600" />
    </Kpi>
    <Kpi label="Open Breaches" value={openBreaches.toString()} tone="bad">
      <ShieldAlert slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Cross-Border Transfers" value={crossBorderCount.toString()} hint="activities flagged">
      <Globe slot="icon" class="h-4 w-4 text-violet-600" />
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
          <span class="rounded-full bg-slate-100 px-1.5 text-[10px] font-mono text-slate-600">{t.count}</span>
        </button>
      {/each}
    </div>

    <!-- RoPA -->
    {#if tab === 'ropa'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Code</th>
              <th class="px-4 py-2 text-left">Name</th>
              <th class="px-4 py-2 text-left">Controller</th>
              <th class="px-4 py-2 text-left">Processor</th>
              <th class="px-4 py-2 text-left">Purpose</th>
              <th class="px-4 py-2 text-left">Lawful Basis</th>
              <th class="px-4 py-2 text-left">Data Categories</th>
              <th class="px-4 py-2 text-left">Retention</th>
              <th class="px-4 py-2 text-center">Cross-Border</th>
              <th class="px-4 py-2 text-left">Jurisdictions</th>
            </tr>
          </thead>
          <tbody>
            {#each data.activities as a (a.id)}
              <tr class="tr">
                <td class="td font-mono text-xs">{a.code}</td>
                <td class="td font-medium">{a.name}</td>
                <td class="td text-xs text-slate-500">{a.controller}</td>
                <td class="td text-xs text-slate-500">{a.processor ?? '—'}</td>
                <td class="td max-w-xs truncate text-xs text-slate-600">{a.purpose}</td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {basisCls(a.lawfulBasis)}">{a.lawfulBasis}</span>
                </td>
                <td class="td">
                  <div class="flex flex-wrap gap-1">
                    {#each a.dataCategories.slice(0, 3) as cat}
                      <span class="tag tag-slate text-[10px]">{cat}</span>
                    {/each}
                    {#if a.dataCategories.length > 3}
                      <span class="text-[10px] text-slate-400">+{a.dataCategories.length - 3}</span>
                    {/if}
                  </div>
                </td>
                <td class="td text-xs text-slate-500">{a.retentionPeriod}</td>
                <td class="td text-center">
                  {#if a.crossBorder}
                    <span class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                      <Globe class="h-3 w-3" /> yes
                    </span>
                  {:else}
                    <span class="text-xs text-slate-400">no</span>
                  {/if}
                </td>
                <td class="td text-xs font-mono text-slate-600">{a.jurisdictions.join(' · ')}</td>
              </tr>
            {:else}
              <tr><td colspan="10" class="px-4 py-8 text-center text-sm text-slate-500">No processing activities recorded.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- DPIAs -->
    {:else if tab === 'dpias'}
      <div class="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
        {#each dpiasSorted as d (d.id)}
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="truncate font-semibold text-grc-ink">{d.activityName ?? '(unknown activity)'}</div>
                <div class="mt-0.5 text-xs text-slate-500">DPIA · conducted {fmtDate(d.conductedAt)}</div>
              </div>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {dpiaStatusCls(d.status)}">{d.status}</span>
            </div>
            <div class="mt-3 flex items-center justify-between">
              <span class="text-[11px] uppercase tracking-wider text-slate-500">Residual risk</span>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(d.residualRiskSeverity)}">{d.residualRiskSeverity}</span>
            </div>
            <div class="mt-3">
              <div class="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>Progress</span>
                <span class="font-mono">{d.status === 'approved' ? 100 : d.status === 'in-review' ? 75 : d.status === 'draft' ? 35 : 100}%</span>
              </div>
              <ProgressBar value={d.status === 'approved' ? 100 : d.status === 'in-review' ? 75 : d.status === 'draft' ? 35 : 100} color={d.status === 'approved' ? 'bg-emerald-500' : d.status === 'in-review' ? 'bg-blue-500' : 'bg-amber-500'} />
            </div>
            <div class="mt-3 text-xs text-slate-500">
              Conducted by: <span class="font-medium text-slate-700">DPO Office</span>
            </div>
          </div>
        {:else}
          <div class="col-span-3 px-4 py-8 text-center text-sm text-slate-500">No DPIAs in progress.</div>
        {/each}
      </div>

    <!-- Subject Requests -->
    {:else if tab === 'requests'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Kind</th>
              <th class="px-4 py-2 text-left">Requester</th>
              <th class="px-4 py-2 text-left">Received</th>
              <th class="px-4 py-2 text-left">Due</th>
              <th class="w-64 px-4 py-2 text-left">SLA</th>
              <th class="px-4 py-2 text-left">Status</th>
              <th class="px-4 py-2 text-left">Resolved</th>
            </tr>
          </thead>
          <tbody>
            {#each requestsSorted as r (r.id)}
              {@const pct = slaPct(r)}
              <tr class="tr">
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {srKindCls(r.kind)}">{r.kind}</span>
                </td>
                <td class="td">
                  <span class="inline-flex items-center gap-1 font-mono text-xs">
                    <Mail class="h-3 w-3 text-slate-400" />{r.requesterEmail}
                  </span>
                </td>
                <td class="td font-mono text-xs">{fmtDate(r.receivedAt)}</td>
                <td class="td font-mono text-xs">{fmtDate(r.dueAt)} <span class="text-slate-400">· {fmtDays(r.dueAt)}</span></td>
                <td class="td">
                  <div class="flex items-center gap-2">
                    <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div class="h-full {slaColor(pct)} transition-all" style="width:{pct}%"></div>
                    </div>
                    <span class="font-mono text-[10px] text-slate-500">{Math.round(100 - pct)}% left</span>
                  </div>
                </td>
                <td class="td">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {srStatusCls(r.status)}">{r.status}</span>
                </td>
                <td class="td font-mono text-xs text-slate-500">{fmtDate(r.resolvedAt)}</td>
              </tr>
            {:else}
              <tr><td colspan="7" class="px-4 py-8 text-center text-sm text-slate-500">No subject requests received.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Breaches -->
    {:else if tab === 'breaches'}
      <div class="p-5">
        {#if breachesSorted.length === 0}
          <div class="px-4 py-8 text-center text-sm text-slate-500">No breach incidents recorded.</div>
        {:else}
          <ol class="relative ml-4 space-y-6 border-l-2 border-slate-200 pl-6">
            {#each breachesSorted as b (b.id)}
              <li class="relative">
                <span class="absolute -left-[34px] flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 ring-4 ring-white">
                  <AlertTriangle class="h-2.5 w-2.5 text-white" />
                </span>
                <div class="card p-4">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-xs font-semibold text-grc-ink">{b.code}</span>
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(b.severity)}">{b.severity}</span>
                      {#if b.regulatorNotified}
                        <span class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">regulator notified</span>
                      {:else}
                        <span class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">notification pending</span>
                      {/if}
                    </div>
                    <span class="font-mono text-xs text-slate-500">{(b.affectedSubjects).toLocaleString()} subjects affected</span>
                  </div>
                  <div class="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                    <div>
                      <div class="section-title text-[10px]">Occurred</div>
                      <div class="mt-0.5 font-mono text-slate-700">{fmtDate(b.occurredAt)}</div>
                    </div>
                    <div>
                      <div class="section-title text-[10px]">Detected</div>
                      <div class="mt-0.5 font-mono text-slate-700">{fmtDate(b.detectedAt)}</div>
                    </div>
                    <div>
                      <div class="section-title text-[10px]">Reported</div>
                      <div class="mt-0.5 font-mono text-slate-700">{fmtDate(b.reportedAt)}</div>
                    </div>
                  </div>
                  <div class="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
                    <span class="font-semibold text-slate-700">Root cause:</span>
                    <span class="ml-1 text-slate-600">{b.rootCause}</span>
                  </div>
                </div>
              </li>
            {/each}
          </ol>
        {/if}
      </div>
    {/if}
  </div>
</div>
