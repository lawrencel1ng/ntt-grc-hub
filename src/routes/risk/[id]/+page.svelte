<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import LECCurve from '$lib/components/LECCurve.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { addToast } from '$lib/stores/toast';
  import { runFAIR } from '$lib/utils/fair';
  import { AlertTriangle, Calculator, Calendar, User as UserIcon, ListChecks, Layers, Activity, BookOpen, Hammer, History as HistoryIcon, ShieldCheck, Bot } from 'lucide-svelte';
  import type { Risk, RiskSeverity, RiskLikelihood, FAIRScenario } from '$lib/data/types';

  export let data;

  // ---------- Scoring ----------
  const SEV_RANK: Record<RiskSeverity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
  const LIK_RANK: Record<RiskLikelihood, number> = { 'almost-certain': 5, likely: 4, possible: 3, unlikely: 2, rare: 1 };
  function inhScore(r: Risk) { return SEV_RANK[r.inherentSeverity] * LIK_RANK[r.inherentLikelihood]; }
  function resScore(r: Risk) { return SEV_RANK[r.residualSeverity] * LIK_RANK[r.residualLikelihood]; }

  $: inh = inhScore(data.risk);
  $: res = resScore(data.risk);
  $: delta = inh - res;
  $: pctReduction = inh > 0 ? Math.round((delta / inh) * 100) : 0;

  function scoreCellColor(score: number): string {
    if (score >= 20) return 'bg-rose-200 text-rose-900 border-rose-300';
    if (score >= 15) return 'bg-orange-200 text-orange-900 border-orange-300';
    if (score >= 10) return 'bg-amber-200 text-amber-900 border-amber-300';
    if (score >= 5)  return 'bg-yellow-100 text-yellow-900 border-yellow-200';
    return 'bg-violet-100 text-violet-900 border-violet-200';
  }

  function statusCls(s: string): string {
    switch (s) {
      case 'identified': return 'bg-slate-100 text-slate-700 ring-slate-200';
      case 'assessed':   return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'treated':    return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'monitoring': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'closed':     return 'bg-slate-100 text-slate-500 ring-slate-200';
      default:           return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }
  function treatmentCls(t: string): string {
    switch (t) {
      case 'mitigate': return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'accept':   return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'transfer': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'avoid':    return 'bg-rose-50 text-rose-700 ring-rose-200';
      default:         return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }

  // ---------- Tabs ----------
  type Tab = 'overview' | 'treatments' | 'scenarios' | 'history' | 'controls';
  let tab: Tab = 'overview';
  const TABS: { id: Tab; label: string; icon: typeof Calculator }[] = [
    { id: 'overview',   label: 'Overview',         icon: BookOpen },
    { id: 'treatments', label: 'Treatments',       icon: Hammer },
    { id: 'scenarios',  label: 'Scenarios',        icon: Calculator },
    { id: 'history',    label: 'History',          icon: HistoryIcon },
    { id: 'controls',   label: 'Linked Controls',  icon: ShieldCheck }
  ];

  // ---------- Synthesised treatments ----------
  $: treatments = [
    { id: `tp_${data.risk.id}_1`, strategy: data.risk.treatmentStrategy, description: 'Tighten control suite and add automated detection; quarterly review.', owner: 'CISO Office', dueAt: new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10), status: 'in-progress' },
    { id: `tp_${data.risk.id}_2`, strategy: 'mitigate', description: 'Update vendor exit plan; multi-region failover playbook.', owner: 'Risk Owner', dueAt: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10), status: 'not-started' }
  ];

  // ---------- Run FAIR per scenario lazily ----------
  type ScenarioWithRun = FAIRScenario & {
    run: ReturnType<typeof runFAIR>;
  };
  $: scenariosWithRuns = data.scenarios.map((s) => ({
    ...s,
    run: runFAIR({
      trials: 10_000,
      seed: `scn-${s.id}`,
      frequencyDist: s.frequencyDist,
      magnitudeDist: s.magnitudeDist
    })
  })) as ScenarioWithRun[];

  // Open the hero scenario by default
  let openScenarioId: string | null = null;
  $: if (!openScenarioId && scenariosWithRuns.length > 0) openScenarioId = scenariosWithRuns[0].id;

  function fmtMoney(n: number, currency = 'SGD'): string {
    if (n >= 1e9) return `${currency} ${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${currency} ${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${currency} ${(n / 1e3).toFixed(0)}K`;
    return `${currency} ${n.toFixed(0)}`;
  }

  function fmtRel(iso?: string): string {
    if (!iso) return '—';
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const ad = Math.abs(diff);
    if (ad < 3600) return `${Math.floor(ad / 60)}m ${diff > 0 ? '' : 'ago'}`;
    if (ad < 86400) return `${Math.floor(ad / 3600)}h ${diff > 0 ? '' : 'ago'}`;
    return `${Math.floor(ad / 86400)}d ${diff > 0 ? '' : 'ago'}`;
  }

  function runFairAction() {
    addToast('success', `FAIR analysis queued for ${data.risk.code}. Risk Quantifier agent will report in ~30s.`);
  }

  // History (synthesised assessed events)
  $: history = (() => {
    const out: { ts: string; event: string; actor: string }[] = [];
    if (data.risk.lastAssessedAt) {
      out.push({ ts: data.risk.lastAssessedAt, event: `Residual revised to ${data.risk.residualSeverity}/${data.risk.residualLikelihood} (score ${res})`, actor: 'Risk Quantifier agent' });
    }
    out.push({ ts: new Date(Date.now() - 14 * 86_400_000).toISOString(), event: `Treatment plan approved (${data.risk.treatmentStrategy})`, actor: 'Risk owner' });
    out.push({ ts: new Date(Date.now() - 30 * 86_400_000).toISOString(), event: 'Risk identified and scoped', actor: 'Internal audit' });
    return out;
  })();

  function sevCls(s: string): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'low')      return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }

  // Tags helper — display key/value chips for object tags
  $: tagEntries = data.risk.tags ? Object.entries(data.risk.tags as Record<string, unknown>) : [];

  // Attribution: HERO + freshly assessed → assume Risk Quantifier
  $: agentAttributed = Boolean(data.risk.tags && (data.risk.tags as Record<string, unknown>).hero);
</script>

<PageHeader
  title={data.risk.code}
  breadcrumbs={[{ label: 'Risk', href: '/risk' }, { label: data.risk.code }]}
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset {sevCls(data.risk.residualSeverity)}">{data.risk.residualSeverity}</span>
    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset {statusCls(data.risk.status)}">{data.risk.status}</span>
    <button class="btn-primary" on:click={runFairAction}>
      <Calculator class="h-4 w-4" />
      <span>Run FAIR Analysis</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- Title card -->
  <div class="card p-5">
    <div class="flex items-start gap-3">
      <div class="rounded-lg bg-rose-50 p-2 text-rose-700"><AlertTriangle class="h-5 w-5" /></div>
      <div class="flex-1">
        <h2 class="text-lg font-semibold text-grc-ink">
          {data.risk.title}
          {#if data.risk.tags && (data.risk.tags as Record<string, unknown>).hero}
            <span class="ml-2 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200">HERO</span>
          {/if}
        </h2>
        <p class="mt-1 text-sm text-slate-600">{data.risk.description ?? '—'}</p>
      </div>
    </div>
  </div>

  <!-- Inherent → Residual visualisation -->
  <div class="card p-5">
    <div class="section-title mb-4">Inherent → Residual Reduction</div>
    <div class="flex flex-wrap items-center gap-6">
      <div class="text-center">
        <div class="text-[11px] uppercase tracking-wider text-slate-500">Inherent</div>
        <div class="mt-2 flex h-24 w-24 items-center justify-center rounded-xl border-2 font-mono text-3xl font-semibold {scoreCellColor(inh)}">{inh}</div>
        <div class="mt-1 text-[11px] text-slate-500">{data.risk.inherentSeverity} / {data.risk.inherentLikelihood}</div>
      </div>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <div class="h-0.5 flex-1 bg-slate-200"></div>
          <span class="text-2xl text-slate-400">→</span>
          <div class="h-0.5 flex-1 bg-slate-200"></div>
        </div>
        <div class="mt-2 text-center text-sm font-medium text-violet-700">
          {delta} point reduction · {pctReduction}% lower
        </div>
      </div>
      <div class="text-center">
        <div class="text-[11px] uppercase tracking-wider text-slate-500">Residual</div>
        <div class="mt-2 flex h-24 w-24 items-center justify-center rounded-xl border-2 font-mono text-3xl font-semibold {scoreCellColor(res)}">{res}</div>
        <div class="mt-1 text-[11px] text-slate-500">{data.risk.residualSeverity} / {data.risk.residualLikelihood}</div>
      </div>
      {#if data.fair}
        <div class="ml-auto text-right">
          <div class="text-[11px] uppercase tracking-wider text-slate-500">FAIR ALE</div>
          <div class="mt-1 font-mono text-2xl font-bold text-rose-700">{fmtMoney(data.fair.aleSgd)}</div>
          <div class="text-[11px] text-slate-500">ARO {data.fair.aro.toFixed(2)} · {data.fair.trials.toLocaleString()} trials</div>
        </div>
      {/if}
    </div>
  </div>

  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
    <Kpi label="Owner" value={data.risk.ownerUserId ?? '—'}>
      <UserIcon slot="icon" class="h-4 w-4 text-slate-500" />
    </Kpi>
    <Kpi label="Next Review" value={fmtRel(data.risk.nextReviewAt)}>
      <Calendar slot="icon" class="h-4 w-4 text-amber-600" />
    </Kpi>
    <Kpi label="Open Issues" value={data.openIssues.length.toString()}>
      <ListChecks slot="icon" class="h-4 w-4 text-rose-600" />
    </Kpi>
    <Kpi label="Linked Controls" value={data.linkedControls.length.toString()}>
      <Layers slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="FAIR Scenarios" value={data.scenarios.length.toString()}>
      <Calculator slot="icon" class="h-4 w-4 text-grc-primary" />
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
      <div class="space-y-4 p-5 text-sm">
        <div>
          <div class="section-title text-xs">Description</div>
          <p class="mt-1 text-slate-700">{data.risk.description ?? 'No description provided.'}</p>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div class="section-title text-xs">Business Service</div>
            <div class="mt-1 font-medium text-slate-800">{data.risk.businessService ?? '—'}</div>
          </div>
          <div>
            <div class="section-title text-xs">Category</div>
            <div class="mt-1 font-medium text-slate-800">{data.risk.category}</div>
          </div>
          <div>
            <div class="section-title text-xs">Jurisdiction</div>
            <div class="mt-1 font-medium text-slate-800">SG · MAS</div>
          </div>
        </div>
        <div>
          <div class="section-title text-xs">Tags</div>
          <div class="mt-1 flex flex-wrap gap-1.5">
            {#each tagEntries as [k, v]}
              <span class="tag tag-slate font-mono text-[10px]">{k}: {String(v)}</span>
            {:else}
              <span class="text-xs text-slate-400">no tags</span>
            {/each}
          </div>
        </div>
        <div>
          <div class="section-title text-xs">Last Assessed</div>
          <div class="mt-1 flex items-center gap-2 text-slate-700">
            <span class="font-mono text-xs">{data.risk.lastAssessedAt?.replace('T', ' ').slice(0, 19) ?? '—'}</span>
            {#if agentAttributed}
              <AgentTypeBadge type="intelligent" />
              <span class="text-xs text-slate-500">Risk Quantifier</span>
            {:else}
              <span class="text-xs text-slate-500">Risk owner</span>
            {/if}
          </div>
        </div>
      </div>

    <!-- Treatments -->
    {:else if tab === 'treatments'}
      <div class="divide-y divide-slate-100">
        {#each treatments as tp}
          <div class="px-5 py-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {treatmentCls(tp.strategy)}">{tp.strategy}</span>
                  <span class="font-semibold text-grc-ink">{tp.description}</span>
                </div>
                <div class="mt-1 text-xs text-slate-500">Owner: {tp.owner} · Due {tp.dueAt}</div>
              </div>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset bg-amber-50 text-amber-700 ring-amber-200">{tp.status}</span>
            </div>
          </div>
        {/each}
      </div>

    <!-- Scenarios -->
    {:else if tab === 'scenarios'}
      <div class="divide-y divide-slate-100">
        {#each scenariosWithRuns as s (s.id)}
          <div class="px-5 py-4">
            <div class="flex items-start justify-between gap-3">
              <button type="button" class="flex-1 text-left" on:click={() => (openScenarioId = openScenarioId === s.id ? null : s.id)}>
                <div class="flex items-center gap-2">
                  <Calculator class="h-4 w-4 text-grc-primary" />
                  <span class="font-semibold text-grc-ink">{s.name}</span>
                </div>
                <div class="mt-1 text-xs text-slate-500">
                  Freq: {s.frequencyDist.kind} · Mag: {s.magnitudeDist.kind} ·
                  ALE <span class="font-mono font-semibold text-rose-700">{fmtMoney(s.run.ale)}</span> ·
                  ARO <span class="font-mono">{s.run.aro.toFixed(2)}</span>
                </div>
              </button>
              <span class="text-xs text-slate-400">{openScenarioId === s.id ? '▾' : '▸'}</span>
            </div>
            {#if openScenarioId === s.id}
              <div class="mt-4 rounded-lg border border-slate-100 bg-slate-50/40 p-3">
                <LECCurve points={s.run.lecCurve} percentiles={{ p50: s.run.percentiles.p50, p90: s.run.percentiles.p90, p99: s.run.percentiles.p99 }} />
                <div class="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div><div class="text-slate-500">P50</div><div class="font-mono font-semibold">{fmtMoney(s.run.percentiles.p50)}</div></div>
                  <div><div class="text-slate-500">P90</div><div class="font-mono font-semibold">{fmtMoney(s.run.percentiles.p90)}</div></div>
                  <div><div class="text-slate-500">P95</div><div class="font-mono font-semibold">{fmtMoney(s.run.percentiles.p95)}</div></div>
                  <div><div class="text-slate-500">P99</div><div class="font-mono font-semibold">{fmtMoney(s.run.percentiles.p99)}</div></div>
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <div class="px-5 py-8 text-center text-sm text-slate-500">No FAIR scenarios attached.</div>
        {/each}
      </div>

    <!-- History -->
    {:else if tab === 'history'}
      <div class="px-5 py-4">
        <ol class="relative ml-3 border-l-2 border-slate-200">
          {#each history as h, i (i)}
            <li class="relative ml-6 py-3">
              <span class="absolute -left-[33px] top-4 inline-flex h-3 w-3 rounded-full bg-grc-primary ring-2 ring-white"></span>
              <div class="font-mono text-[11px] text-slate-500">{h.ts.replace('T', ' ').slice(0, 19)}</div>
              <div class="mt-0.5 text-sm font-medium text-grc-ink">{h.event}</div>
              <div class="mt-0.5 text-xs text-slate-500">by {h.actor}</div>
            </li>
          {/each}
        </ol>
      </div>

    <!-- Linked Controls -->
    {:else if tab === 'controls'}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Code</th>
              <th class="px-4 py-2 text-left">Title</th>
              <th class="px-4 py-2 text-left">Type</th>
              <th class="px-4 py-2 text-left">Maturity</th>
              <th class="px-4 py-2 text-left">Last Result</th>
              <th class="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {#each data.linkedControls as c (c.id)}
              <tr class="tr">
                <td class="td font-mono text-xs">
                  <a href="/controls/{c.id}" class="text-grc-primary hover:underline">{c.code}</a>
                </td>
                <td class="td max-w-md truncate">{c.title}</td>
                <td class="td"><span class="tag tag-slate">{c.type}</span></td>
                <td class="td text-xs text-slate-500">{c.maturity}</td>
                <td class="td">
                  <span class="inline-flex items-center gap-1 text-violet-700">
                    <Activity class="h-3 w-3" /> pass
                  </span>
                </td>
                <td class="td">
                  <a href="/controls/{c.id}" class="text-slate-400 hover:text-grc-primary">→</a>
                </td>
              </tr>
            {:else}
              <tr><td colspan="6" class="px-4 py-6 text-center text-sm text-slate-500">No controls linked.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  {#if agentAttributed}
    <div class="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs text-violet-700">
      <Bot class="inline h-3 w-3" />
      Auto-attributed: this risk was re-scored by the <span class="font-semibold">Risk Quantifier</span> agent {fmtRel(data.risk.lastAssessedAt)} after a regulatory horizon trigger.
    </div>
  {/if}
</div>
