<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import AgentCard from '$lib/components/AgentCard.svelte';
  import type { Agent, AgentType, AgentStatus } from '$lib/data/types';
  import { Bot, DollarSign, Clock, ShieldCheck, UserCheck, Gauge, Search } from 'lucide-svelte';

  export let data;

  // ---------- Derived numbers across the whole 30d window ----------
  $: totalRuns30d = data.fleetSummary.reduce((s, x) => s + x.runs30d, 0);
  $: totalCostCents30d = data.fleetSummary.reduce((s, x) => s + x.costCents30d, 0);
  $: totalFteHours30d = data.fleetSummary.reduce((s, x) => s + x.fteHours30d, 0);
  // 160h/mo per FTE — keeps the math sane against an industry-standard
  // working month.
  $: totalFte = +(totalFteHours30d / 160).toFixed(1);

  // 30d decision economics — drives HITL Approval Rate + Auto-Approved %.
  $: decisionStats = (() => {
    const decisions = data.decisions;
    const total = decisions.length || 1;
    const auto = decisions.filter((d) => d.outcome === 'auto-approved').length;
    const hitlReviewed = decisions.filter(
      (d) => d.outcome === 'hitl-approved' || d.outcome === 'hitl-rejected'
    ).length;
    const hitlApproved = decisions.filter((d) => d.outcome === 'hitl-approved').length;
    const avgConfidence = decisions.reduce((s, d) => s + d.confidence, 0) / total;
    const hitlApprovalRate = hitlReviewed === 0 ? 1 : hitlApproved / hitlReviewed;
    return {
      total,
      auto,
      autoPct: auto / total,
      hitlApprovalRate,
      avgConfidence
    };
  })();

  // 30d savings story — FTE-hour × fully-loaded analyst cost ($120/h).
  $: annualSavings = (() => {
    const avoided30d = totalFteHours30d * 120;
    return (avoided30d * 12) / 30;
  })();
  $: fleetMonthlyCost = data.agents.reduce((s, a) => s + a.costMonthlyEstimateCents, 0) / 100;
  $: humanMonthlyEquivalent = (totalFteHours30d * 120 * 30) / 30;

  // ---------- Filter state ----------
  type TypeFilter = 'all' | AgentType;
  type StatusFilter = 'all' | AgentStatus;
  let typeFilter: TypeFilter = 'all';
  let statusFilter: StatusFilter = 'all';
  let search = '';

  $: filteredAgents = data.agents.filter((a: Agent) => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  $: statsById = new Map(data.fleetSummary.map((s) => [s.id, s]));

  function fmtMoney(dollars: number): string {
    if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
    if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
    return `$${dollars.toFixed(0)}`;
  }

  const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'deterministic', label: 'Deterministic' },
    { id: 'ai-powered', label: 'AI-Powered' },
    { id: 'intelligent', label: 'Intelligent' }
  ];
  const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'running', label: 'Running' },
    { id: 'idle', label: 'Idle' },
    { id: 'paused', label: 'Paused' }
  ];
</script>

<PageHeader
  title="Agent Fleet"
  subtitle="10 agents · {totalFte} FTE replaced · {fmtMoney(annualSavings)} saved annually"
/>

<div class="space-y-6">
  <!-- ============================================================== -->
  <!-- KPI strip (6)                                                   -->
  <!-- ============================================================== -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
    <Kpi label="Total Runs (30d)" value={totalRuns30d.toLocaleString()} delta={14} hint="across fleet">
      <Bot slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Total Cost (30d)" value={fmtMoney(totalCostCents30d / 100)} delta={6} hint="run rate">
      <DollarSign slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="FTE Hours (30d)" value={totalFteHours30d.toFixed(0)} delta={22} hint="≈ {totalFte} FTE">
      <Clock slot="icon" class="h-4 w-4 text-violet-500" />
    </Kpi>
    <Kpi
      label="HITL Approval Rate"
      value={(decisionStats.hitlApprovalRate * 100).toFixed(1)}
      suffix="%"
      hint="reviewed decisions"
    >
      <UserCheck slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi
      label="Auto-Approved"
      value={(decisionStats.autoPct * 100).toFixed(1)}
      suffix="%"
      hint="{decisionStats.auto}/{decisionStats.total}"
    >
      <ShieldCheck slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Avg Confidence" value={(decisionStats.avgConfidence * 100).toFixed(1)} suffix="%" hint="fleet-wide">
      <Gauge slot="icon" class="h-4 w-4 text-slate-500" />
    </Kpi>
  </div>

  <!-- ============================================================== -->
  <!-- Filter bar                                                      -->
  <!-- ============================================================== -->
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type:</span>
      {#each TYPE_FILTERS as f}
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {typeFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (typeFilter = f.id)}
        >
          {f.label}
        </button>
      {/each}
    </div>
    <span class="text-slate-300">·</span>
    <div class="flex items-center gap-1">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status:</span>
      {#each STATUS_FILTERS as f}
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {statusFilter === f.id
            ? 'bg-grc-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
          on:click={() => (statusFilter = f.id)}
        >
          {f.label}
        </button>
      {/each}
    </div>
    <div class="relative ml-auto w-full sm:w-64">
      <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        bind:value={search}
        placeholder="Search agents…"
        class="input pl-8"
      />
    </div>
  </div>

  <!-- ============================================================== -->
  <!-- Agent grid                                                      -->
  <!-- ============================================================== -->
  {#if filteredAgents.length === 0}
    <div class="card p-8 text-center text-sm text-slate-500">No agents match those filters.</div>
  {:else}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {#each filteredAgents as a (a.id)}
        {@const s = statsById.get(a.id) ?? { runs30d: 0, costCents30d: 0, fteHours30d: 0 }}
        <AgentCard agent={a} stats={{ runs30d: s.runs30d, costCents30d: s.costCents30d, fteHours30d: s.fteHours30d }} />
      {/each}
    </div>
  {/if}

  <!-- ============================================================== -->
  <!-- ROI banner                                                      -->
  <!-- ============================================================== -->
  <div class="relative overflow-hidden rounded-xl bg-white p-6 ring-1 ring-inset ring-slate-200">
    <span class="absolute inset-y-0 left-0 w-1 bg-violet-600" aria-hidden="true"></span>
    <div class="relative pl-4">
      <div class="mb-1 flex items-center gap-2">
        <Bot class="h-4 w-4 text-violet-600" />
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Agent Fleet ROI</span>
      </div>
      <div class="num text-[28px] font-semibold tracking-tight text-grc-ink">{fmtMoney(annualSavings)} <span class="font-sans text-sm font-medium text-slate-500">saved annually</span></div>
      <div class="mt-1 max-w-2xl text-sm text-slate-600">
        10 agents replaced <span class="font-semibold text-slate-800">{totalFte} FTE</span> across the
        fleet — equivalent to <span class="font-semibold text-slate-800">{totalFteHours30d.toFixed(0)} analyst hours</span>
        of work in the last 30 days.
      </div>

      <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="rounded-lg bg-slate-50 p-4 ring-1 ring-inset ring-slate-200/70">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Fleet cost</div>
          <div class="mt-1 num text-xl font-semibold text-slate-800">{fmtMoney(fleetMonthlyCost)}<span class="font-sans text-xs font-medium text-slate-500">/mo</span></div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div class="h-full rounded-full bg-violet-600" style="width: {Math.max(1, Math.min(100, (fleetMonthlyCost / Math.max(1, humanMonthlyEquivalent)) * 100))}%"></div>
          </div>
        </div>
        <div class="rounded-lg bg-slate-50 p-4 ring-1 ring-inset ring-slate-200/70">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Human equivalent</div>
          <div class="mt-1 num text-xl font-semibold text-slate-800">{fmtMoney(humanMonthlyEquivalent)}<span class="font-sans text-xs font-medium text-slate-500">/mo</span></div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div class="h-full rounded-full bg-slate-500" style="width: 100%"></div>
          </div>
        </div>
      </div>

      <div class="mt-4 inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 ring-1 ring-inset ring-slate-200">
        <Bot class="h-3 w-3 text-violet-600" />
        {(humanMonthlyEquivalent / Math.max(1, fleetMonthlyCost)).toFixed(0)}× ROI · zero-headcount scaling
      </div>
    </div>
  </div>
</div>
