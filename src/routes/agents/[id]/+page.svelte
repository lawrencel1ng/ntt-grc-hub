<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import AgentRunLog from '$lib/components/AgentRunLog.svelte';
  import DecisionRow from '$lib/components/DecisionRow.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import { addToast } from '$lib/stores/toast';
  import {
    Bot, Clock, DollarSign, Gauge, Play, Plug, Database, Brain, Search as SearchIcon, Terminal,
    UserCheck, ShieldCheck, FileCheck2, Settings as SettingsIcon, Sparkles
  } from 'lucide-svelte';
  import type { AgentDecisionOutcome } from '$lib/data/types';

  export let data;

  type Tab = 'runs' | 'decisions' | 'tools' | 'audit' | 'settings';
  let activeTab: Tab = 'runs';

  // ---------- Derived KPIs (last 30d slice) ----------
  $: latencies = data.runs.map((r) => r.latencyMs).sort((a, b) => a - b);
  $: p95Latency = latencies.length
    ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]
    : 0;
  $: avgConfidence = data.decisions.length
    ? data.decisions.reduce((s, d) => s + d.confidence, 0) / data.decisions.length
    : 0;
  $: hitlReviewed = data.decisions.filter(
    (d) => d.outcome === 'hitl-approved' || d.outcome === 'hitl-rejected'
  ).length;
  $: hitlApproved = data.decisions.filter((d) => d.outcome === 'hitl-approved').length;
  $: hitlApprovalRate = hitlReviewed === 0 ? 1 : hitlApproved / hitlReviewed;

  // ---------- Decisions tab — outcome chip filter ----------
  type OutcomeFilter = 'all' | AgentDecisionOutcome;
  let outcomeFilter: OutcomeFilter = 'all';
  $: visibleDecisions = outcomeFilter === 'all'
    ? data.decisions
    : data.decisions.filter((d) => d.outcome === outcomeFilter);

  // ---------- Runs pagination ----------
  let runsPage = 0;
  const runsPerPage = 20;
  $: pagedRuns = data.runs.slice(runsPage * runsPerPage, (runsPage + 1) * runsPerPage);
  $: totalRunsPages = Math.max(1, Math.ceil(data.runs.length / runsPerPage));

  // Per-agent framework tags derived from the agent's documented scope.
  const FRAMEWORKS_BY_AGENT: Record<string, string[]> = {
    ag_evidence: ['ISO 27001', 'SOC 2', 'PCI DSS', 'MAS TRM'],
    ag_tester:   ['SOC 2', 'NIST CSF', 'PCI DSS', 'ISO 27001'],
    ag_vendor:   ['SOC 2', 'ISO 27001', 'MAS TRM', 'DORA'],
    ag_policy:   ['ISO 27001', 'GDPR', 'PDPA', 'EU AI Act'],
    ag_regwatch: ['MAS', 'EU AI Act', 'APRA', 'GDPR', 'RBI'],
    ag_audit:    ['SOC 2', 'ISO 27001', 'PCI DSS', 'MAS TRM'],
    ag_fair:     ['FAIR-MAM', 'NIST CSF', 'DORA'],
    ag_incident: ['NIS 2', 'DORA', 'SOC 2', 'MAS TRM'],
    ag_mapper:   data.frameworkCount ? [`All ${data.frameworkCount} frameworks`] : ['All configured frameworks'],
    ag_board:    ['Board Pack', 'CRO Charter']
  };
  $: frameworks = FRAMEWORKS_BY_AGENT[data.agent.id] ?? [];

  // ---------- Tools tab icon picker ----------
  function toolIcon(kind: string) {
    switch (kind) {
      case 'api': return Plug;
      case 'db': return Database;
      case 'llm': return Brain;
      case 'search': return SearchIcon;
      default: return Terminal;
    }
  }

  function fmtCost(cents: number): string {
    const dollars = cents / 100;
    if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
    return `$${dollars.toFixed(0)}`;
  }
  function fmtRelTs(ts: string): string {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  async function runNow() {
    const res = await fetch(`/api/agents/${data.agent.id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      addToast('success', `${data.agent.name} queued for execution.`);
    } else {
      const msg = await res.text().catch(() => '');
      addToast('error', msg || 'Failed to queue agent execution.');
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'runs', label: 'Runs' },
    { id: 'decisions', label: 'Decisions' },
    { id: 'tools', label: 'Tools' },
    { id: 'audit', label: 'Audit' },
    { id: 'settings', label: 'Settings' }
  ];

  const OUTCOME_FILTERS: { id: OutcomeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'auto-approved', label: 'Auto' },
    { id: 'hitl-approved', label: 'HITL Approved' },
    { id: 'hitl-rejected', label: 'HITL Rejected' },
    { id: 'awaiting-hitl', label: 'Awaiting HITL' }
  ];

  function runHash(id: number | string): string {
    return Number(id).toString(16).padStart(8, '0').slice(0, 8);
  }
</script>

<PageHeader
  title={data.agent.name}
  breadcrumbs={[{ label: 'Agent Fleet', href: '/agents' }, { label: data.agent.name }]}
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-800">
      <DollarSign class="h-3.5 w-3.5" />
      {fmtCost(data.agent.costMonthlyEstimateCents)}/mo
      <span class="text-violet-400">·</span>
      ~{data.agent.fteEquivalent.toFixed(2)} FTE saved
    </span>
    <button class="btn-primary" on:click={runNow}>
      <Play class="h-4 w-4" />
      <span>Run Now</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="grid grid-cols-1 gap-6 xl:grid-cols-4">
  <!-- ============================================================== -->
  <!-- Main column                                                     -->
  <!-- ============================================================== -->
  <div class="space-y-6 xl:col-span-3">
    <!-- Header pill row -->
    <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
      <Bot class="h-5 w-5 text-grc-agent" />
      <span class="text-sm font-semibold text-slate-700">{data.agent.ownerTeam}</span>
      <AgentTypeBadge type={data.agent.type} />
      <StatusDot status={data.agent.status} />
      <span class="ml-auto font-mono text-xs text-slate-500">{data.agent.id}</span>
    </div>

    <!-- KPI strip (6) -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Kpi label="Runs (30d)" value={data.runs30d.toLocaleString()}>
        <Bot slot="icon" class="h-4 w-4 text-violet-600" />
      </Kpi>
      <Kpi label="Avg Confidence" value={(avgConfidence * 100).toFixed(1)} suffix="%">
        <Gauge slot="icon" class="h-4 w-4 text-slate-500" />
      </Kpi>
      <Kpi label="Cost (30d)" value={fmtCost(data.costCents30d)}>
        <DollarSign slot="icon" class="h-4 w-4 text-violet-600" />
      </Kpi>
      <Kpi label="FTE Hours (30d)" value={data.fteHours30d.toFixed(0)} suffix="hrs">
        <Clock slot="icon" class="h-4 w-4 text-violet-500" />
      </Kpi>
      <Kpi label="HITL Approval" value={(hitlApprovalRate * 100).toFixed(1)} suffix="%" hint="{hitlApproved}/{hitlReviewed}">
        <UserCheck slot="icon" class="h-4 w-4 text-violet-600" />
      </Kpi>
      <Kpi label="P95 Latency" value={String(p95Latency)} suffix="ms">
        <Clock slot="icon" class="h-4 w-4 text-slate-500" />
      </Kpi>
    </div>

    <!-- Tab bar -->
    <div class="card overflow-hidden">
      <div class="flex border-b border-slate-200">
        {#each TABS as t}
          <button
            type="button"
            class="relative px-4 py-3 text-sm font-medium transition-colors {activeTab === t.id
              ? 'text-grc-primary'
              : 'text-slate-500 hover:text-slate-800'}"
            on:click={() => (activeTab = t.id)}
          >
            {t.label}
            {#if activeTab === t.id}
              <span class="absolute inset-x-0 bottom-0 h-0.5 bg-grc-primary"></span>
            {/if}
          </button>
        {/each}
      </div>

      <!-- ---------- Runs tab ---------- -->
      {#if activeTab === 'runs'}
        <div class="p-4">
          <AgentRunLog runs={pagedRuns} />
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
            <div>
              Page {runsPage + 1} of {totalRunsPages} ·
              showing {pagedRuns.length} of {data.runs.length} runs
            </div>
            <div class="flex gap-2">
              <button class="btn-ghost px-2 py-1" disabled={runsPage === 0} on:click={() => (runsPage = Math.max(0, runsPage - 1))}>Prev</button>
              <button class="btn-ghost px-2 py-1" disabled={runsPage >= totalRunsPages - 1} on:click={() => (runsPage = Math.min(totalRunsPages - 1, runsPage + 1))}>Next</button>
            </div>
          </div>
        </div>

      <!-- ---------- Decisions tab ---------- -->
      {:else if activeTab === 'decisions'}
        <div class="border-b border-slate-100 px-4 py-3">
          <div class="flex flex-wrap items-center gap-1">
            <span class="mr-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Outcome:</span>
            {#each OUTCOME_FILTERS as f}
              <button
                type="button"
                class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {outcomeFilter === f.id
                  ? 'bg-grc-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                on:click={() => (outcomeFilter = f.id)}
              >
                {f.label}
              </button>
            {/each}
          </div>
        </div>
        <div>
          {#each visibleDecisions.slice(0, 50) as d (d.id)}
            <DecisionRow decision={d} />
          {:else}
            <div class="p-6 text-center text-sm text-slate-500">No decisions match this filter.</div>
          {/each}
        </div>

      <!-- ---------- Tools tab ---------- -->
      {:else if activeTab === 'tools'}
        <div class="p-4">
          {#if data.tools.length === 0}
            <div class="p-4 text-sm text-slate-500">No tools registered.</div>
          {:else}
            <ul class="divide-y divide-slate-100">
              {#each data.tools as t}
                {@const Icon = toolIcon(t.toolKind)}
                <li class="flex items-center gap-3 py-3">
                  <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Icon class="h-4 w-4" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-sm text-slate-800">{t.toolName}</span>
                      <span class="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700 ring-1 ring-inset ring-violet-200">{t.toolKind}</span>
                    </div>
                    <p class="text-xs text-slate-500">{t.description}</p>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

      <!-- ---------- Audit tab ---------- -->
      {:else if activeTab === 'audit'}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-sm">
            <thead class="thead">
              <tr>
                <th class="px-4 py-2 text-left">When</th>
                <th class="px-4 py-2 text-left">Run</th>
                <th class="px-4 py-2 text-left">Status</th>
                <th class="px-4 py-2 text-left">prev_hash</th>
                <th class="px-4 py-2 text-left">row_hash</th>
              </tr>
            </thead>
            <tbody>
              {#each data.runs.slice(0, 30) as r, i}
                {@const prev = i + 1 < data.runs.length ? runHash(data.runs[i + 1].id) : '00000000'}
                {@const curr = runHash(r.id)}
                <tr class="tr">
                  <td class="td font-mono text-xs text-slate-500">{r.startedAt.slice(0, 19)}</td>
                  <td class="td font-mono text-xs">#{r.id}</td>
                  <td class="td"><StatusDot status={r.status} withLabel /></td>
                  <td class="td"><span class="evidence-chip">{prev}</span></td>
                  <td class="td"><span class="evidence-chip"><FileCheck2 class="h-3 w-3 text-violet-600" />{curr}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

      <!-- ---------- Settings tab ---------- -->
      {:else if activeTab === 'settings'}
        <div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          <div>
            <label for="agent-schedule" class="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Schedule (cron)</label>
            <input id="agent-schedule" class="input font-mono" readonly value={data.agent.type === 'deterministic' ? '*/15 * * * *' : '0 * * * *'} />
          </div>
          <div>
            <label for="agent-cap" class="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cost cap (per month)</label>
            <input id="agent-cap" class="input font-mono" readonly value={fmtCost(data.agent.costMonthlyEstimateCents * 1.5)} />
          </div>
          <div class="md:col-span-2">
            <label for="agent-hitl" class="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">HITL rule</label>
            <input id="agent-hitl" class="input" readonly value="Require approval when confidence < 0.80 OR when output affects financial control" />
          </div>
          <div class="md:col-span-2 inline-flex items-center gap-2 text-xs text-slate-500">
            <SettingsIcon class="h-3.5 w-3.5" />
            HITL rules are configured by an admin in Settings → Agent Policy.
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- ============================================================== -->
  <!-- Right rail                                                      -->
  <!-- ============================================================== -->
  <aside class="space-y-4">
    <div class="card p-4">
      <div class="mb-2 flex items-center gap-2">
        <Sparkles class="h-3.5 w-3.5 text-violet-600" />
        <h3 class="section-title">What this agent does</h3>
      </div>
      <p class="text-sm leading-relaxed text-slate-700">{data.agent.description}</p>
    </div>

    <div class="card overflow-hidden">
      <div class="px-4 py-3">
        <h3 class="section-title">Recent Decisions</h3>
      </div>
      <div class="border-t border-slate-100">
        {#each data.decisions.slice(0, 5) as d (d.id)}
          <div class="border-t border-slate-100 px-4 py-2 first:border-t-0 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-slate-700">{d.decisionType}</span>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{(d.confidence * 100).toFixed(0)}%</span>
            </div>
            <div class="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span class="capitalize">{d.outcome.replace('-', ' ')}</span>
              <span>{fmtRelTs(d.decidedAt)}</span>
            </div>
          </div>
        {:else}
          <div class="px-4 py-3 text-sm text-slate-500">No decisions yet.</div>
        {/each}
      </div>
    </div>

    <div class="card p-4">
      <h3 class="section-title mb-2">Related Frameworks</h3>
      <div class="flex flex-wrap gap-1.5">
        {#each frameworks as f}
          <span class="tag-emerald">
            <ShieldCheck class="mr-1 h-3 w-3" />
            {f}
          </span>
        {/each}
      </div>
    </div>
  </aside>
</div>
