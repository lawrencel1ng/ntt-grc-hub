<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import LECCurve from '$lib/components/LECCurve.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { addToast } from '$lib/stores/toast';
  import { runFAIR } from '$lib/utils/fair';
  import { AlertTriangle, Calculator, Calendar, User as UserIcon, ListChecks, Layers, BookOpen, Hammer, History as HistoryIcon, ShieldCheck, Bot, Pencil, Plus } from 'lucide-svelte';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import { enhance } from '$app/forms';
  import type { Risk, RiskSeverity, RiskLikelihood, FAIRScenario } from '$lib/data/types';

  export let data;
  export let form: {
    statusUpdated?: boolean; newStatus?: string; statusError?: string;
    editSuccess?: boolean; editError?: string; ownerEmail?: string;
    treatmentCreated?: boolean; treatmentError?: string;
  } | null = null;

  $: if (form?.statusUpdated) addToast('success', `Risk status updated to "${form.newStatus}".`);
  $: if (form?.statusError) addToast('error', form.statusError);
  $: if (form?.editSuccess) {
    addToast('success', 'Risk updated.');
    showEditForm = false;
    if (form.ownerEmail) {
      data = { ...data, risk: { ...data.risk, ownerEmail: form.ownerEmail } };
    }
  }
  $: if (form?.editError) addToast('error', form.editError);
  $: if (form?.treatmentCreated) { addToast('success', 'Treatment plan added.'); showTreatmentForm = false; }
  $: if (form?.treatmentError) addToast('error', form.treatmentError);

  let showEditForm = false;
  let showTreatmentForm = false;

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
    // Single-hue amber → rose ramp; matches Heatmap5x5 palette.
    if (score >= 20) return 'bg-rose-600 text-white border-rose-700';
    if (score >= 15) return 'bg-orange-500 text-white border-orange-600';
    if (score >= 10) return 'bg-amber-300 text-amber-900 border-amber-400';
    if (score >= 5)  return 'bg-amber-100 text-amber-900 border-amber-200';
    return 'bg-amber-50 text-amber-900 border-amber-100';
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

  import type { RiskTreatment, RiskHistoryEntry } from '$lib/data/types';
  $: treatments = data.treatments as RiskTreatment[];
  $: history = data.history as RiskHistoryEntry[];

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

  let liveAle: { p10: number; p50: number; p90: number; mean: number } | null = null;

  async function runFairAction() {
    try {
      const res = await fetch(`/api/risk/${data.risk.id}/run-fair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.ale) {
          liveAle = body.ale;
          addToast('success', `FAIR ALE for ${data.risk.code}: ${fmtMoney(body.ale.p50)} median (P10 ${fmtMoney(body.ale.p10)} · P90 ${fmtMoney(body.ale.p90)}) — 10,000-trial Monte Carlo`);
        } else {
          addToast('success', `FAIR analysis complete for ${data.risk.code}.`);
        }
      } else {
        const msg = await res.text().catch(() => '');
        addToast('error', msg || 'Failed to run FAIR analysis.');
      }
    } catch {
      addToast('error', 'Network error — check your connection and try again.');
    }
  }


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
    <form method="POST" action="?/updateStatus" use:enhance class="flex items-center gap-1.5">
      <select name="status" class="input py-1 text-xs" value={form?.newStatus ?? data.risk.status}>
        <option value="identified">identified</option>
        <option value="assessed">assessed</option>
        <option value="treated">treated</option>
        <option value="monitoring">monitoring</option>
        <option value="closed">closed</option>
      </select>
      <button type="submit" class="btn-secondary py-1 text-xs">Update</button>
    </form>
    <button class="btn-secondary" on:click={() => (showEditForm = !showEditForm)}>
      <Pencil class="h-4 w-4" />
      <span>Edit</span>
    </button>
    <button class="btn-primary" on:click={runFairAction}>
      <Calculator class="h-4 w-4" />
      <span>Run FAIR Analysis</span>
    </button>
  </svelte:fragment>
</PageHeader>

{#if showEditForm}
  <div class="card p-5">
    <h3 class="mb-4 text-sm font-semibold text-grc-ink">Edit Risk</h3>
    <form method="POST" action="?/updateRisk" use:enhance class="space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium text-slate-700">Title</span>
          <input name="title" class="input" value={data.risk.title} required maxlength="256" />
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium text-slate-700">Description</span>
          <textarea name="description" class="input h-20 resize-none" maxlength="2048">{data.risk.description ?? ''}</textarea>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Category</span>
          <input name="category" class="input" value={data.risk.category} maxlength="128" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Treatment Strategy</span>
          <select name="treatmentStrategy" class="input" value={data.risk.treatmentStrategy}>
            <option value="mitigate">Mitigate</option>
            <option value="accept">Accept</option>
            <option value="transfer">Transfer</option>
            <option value="avoid">Avoid</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Inherent Severity</span>
          <select name="inherentSeverity" class="input" value={data.risk.inherentSeverity}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Inherent Likelihood</span>
          <select name="inherentLikelihood" class="input" value={data.risk.inherentLikelihood}>
            <option value="almost-certain">Almost Certain</option>
            <option value="likely">Likely</option>
            <option value="possible">Possible</option>
            <option value="unlikely">Unlikely</option>
            <option value="rare">Rare</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Residual Severity</span>
          <select name="residualSeverity" class="input" value={data.risk.residualSeverity}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Residual Likelihood</span>
          <select name="residualLikelihood" class="input" value={data.risk.residualLikelihood}>
            <option value="almost-certain">Almost Certain</option>
            <option value="likely">Likely</option>
            <option value="possible">Possible</option>
            <option value="unlikely">Unlikely</option>
            <option value="rare">Rare</option>
          </select>
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium text-slate-700">Owner email</span>
          <input name="ownerEmail" type="email" class="input" value={data.risk.ownerEmail ?? ''} placeholder="Leave blank to keep current owner" maxlength="256" />
        </label>
      </div>
      <div class="flex gap-2">
        <button type="submit" class="btn-primary">Save changes</button>
        <button type="button" class="btn-secondary" on:click={() => (showEditForm = false)}>Cancel</button>
      </div>
    </form>
  </div>
{/if}

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
      {#if liveAle}
        <div class="ml-auto text-right">
          <div class="text-[11px] uppercase tracking-wider text-slate-500">FAIR ALE (live)</div>
          <div class="mt-1 font-mono text-2xl font-bold text-rose-700">{fmtMoney(liveAle.p50)}</div>
          <div class="text-[11px] text-slate-500">P10 {fmtMoney(liveAle.p10)} · P90 {fmtMoney(liveAle.p90)} · 10,000 trials</div>
        </div>
      {:else if data.fair}
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
    <Kpi label="Owner" value={data.risk.ownerEmail ?? '—'}>
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
            <div class="mt-1 font-medium text-slate-800">{data.risk.tags?.['jurisdiction'] ?? '—'}</div>
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
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <span class="text-xs text-slate-500">{treatments.length} treatment{treatments.length !== 1 ? 's' : ''}</span>
        <button class="btn-ghost text-xs" on:click={() => (showTreatmentForm = !showTreatmentForm)}>
          <Plus class="h-3.5 w-3.5" />
          Add treatment
        </button>
      </div>
      {#if showTreatmentForm}
        <div class="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <form method="POST" action="?/createTreatment" use:enhance class="space-y-3">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">Strategy</span>
                <select name="strategy" class="input" required>
                  <option value="mitigate">Mitigate</option>
                  <option value="accept">Accept</option>
                  <option value="transfer">Transfer</option>
                  <option value="avoid">Avoid</option>
                </select>
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">Due date</span>
                <input name="dueAt" type="date" class="input" />
              </label>
            </div>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Description</span>
              <input name="description" type="text" class="input" placeholder="Describe the treatment action…" required maxlength="1024" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Estimated cost (S$)</span>
              <input name="costSgd" type="number" min="0" step="1000" class="input w-40" placeholder="0" />
            </label>
            <div class="flex gap-2">
              <button type="submit" class="btn-primary">Add treatment</button>
              <button type="button" class="btn-secondary" on:click={() => (showTreatmentForm = false)}>Cancel</button>
            </div>
          </form>
        </div>
      {/if}
      <div class="divide-y divide-slate-100">
        {#each treatments as tp (tp.id)}
          <div class="px-5 py-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {treatmentCls(tp.strategy)}">{tp.strategy}</span>
                  <span class="font-semibold text-grc-ink">{tp.description}</span>
                </div>
                <div class="mt-1 text-xs text-slate-500">
                  {tp.dueAt ? `Due ${tp.dueAt.slice(0, 10)}` : 'No due date'}
                  {#if tp.costSgd}<span class="ml-2">· S${tp.costSgd.toLocaleString()}</span>{/if}
                </div>
              </div>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {tp.completedAt ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}">{tp.completedAt ? 'completed' : 'in-progress'}</span>
            </div>
          </div>
        {:else}
          <div class="px-5 py-6 text-center text-sm text-slate-400">No treatment plans recorded for this risk.</div>
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
        {#if history.length === 0}
          <div class="py-4 text-center text-sm text-slate-400">No history recorded yet.</div>
        {:else}
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
        {/if}
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
                  {#if c.lastTestResult}
                    <StatusDot status={c.lastTestResult} withLabel />
                  {:else}
                    <span class="text-xs text-slate-400">no runs</span>
                  {/if}
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
