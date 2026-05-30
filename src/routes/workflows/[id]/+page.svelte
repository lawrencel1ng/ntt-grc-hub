<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import { addToast } from '$lib/stores/toast';
  import { enhance } from '$app/forms';
  import {
    Play, Bot, Plug, User as UserIcon, GitBranch, CheckCircle2, Workflow as WorkflowIcon, Clock
  } from 'lucide-svelte';
  import type { WorkflowExecutionStatus, WorkflowStepDef } from '$lib/data/types';

  export let data;
  export let form: { toggled?: boolean; enabled?: boolean; toggleError?: string } | null = null;

  $: if (form?.toggled) {
    data = { ...data, workflow: { ...data.workflow, enabled: form.enabled ?? data.workflow.enabled } };
    addToast('success', form.enabled ? 'Workflow enabled.' : 'Workflow paused.');
  }
  $: if (form?.toggleError) addToast('error', form.toggleError);

  let selectedStep: number | null = null;

  // ---------- KPIs ----------
  $: total30d = data.executions.length;
  $: successes = data.executions.filter((e) => e.status === 'success').length;
  $: successRate = total30d === 0 ? 0 : (successes / total30d) * 100;
  $: avgDurationMs = (() => {
    const durs = data.executions
      .filter((e) => e.endedAt)
      .map((e) => new Date(e.endedAt as string).getTime() - new Date(e.startedAt).getTime());
    if (!durs.length) return 0;
    return durs.reduce((s, d) => s + d, 0) / durs.length;
  })();
  $: lastRun = data.executions[0]?.startedAt ?? '';

  function fmtRelTs(ts: string): string {
    if (!ts) return '—';
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function fmtDuration(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  function stepIcon(kind: WorkflowStepDef['kind']) {
    switch (kind) {
      case 'agent':    return Bot;
      case 'api':      return Plug;
      case 'manual':   return UserIcon;
      case 'decision': return GitBranch;
    }
  }
  function stepColor(kind: WorkflowStepDef['kind']): string {
    switch (kind) {
      case 'agent':    return 'fill-violet-50 stroke-violet-400';
      case 'api':      return 'fill-blue-50 stroke-blue-400';
      case 'manual':   return 'fill-amber-50 stroke-amber-400';
      case 'decision': return 'fill-violet-50 stroke-violet-400';
    }
  }
  function stepBadge(kind: WorkflowStepDef['kind']): string {
    switch (kind) {
      case 'agent':    return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'api':      return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'manual':   return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'decision': return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }

  function execStatusCls(s: WorkflowExecutionStatus): string {
    switch (s) {
      case 'success': return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'running': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'failed':  return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'halted':  return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }

  // SVG diagram geometry — boxes are 180x80 with 60px gutters.
  const BOX_W = 180;
  const BOX_H = 80;
  const GAP = 60;
  $: stepCount = data.workflow.steps.length;
  $: svgWidth = stepCount * BOX_W + (stepCount - 1) * GAP + 40;
  const SVG_HEIGHT = 140;

  async function runNow() {
    try {
      const res = await fetch(`/api/workflows/${data.workflow.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        addToast('success', `${data.workflow.name} queued.`);
      } else {
        const msg = await res.text().catch(() => '');
        addToast('error', msg || 'Failed to queue workflow execution.');
      }
    } catch {
      addToast('error', 'Network error — check your connection and try again.');
    }
  }
</script>

<PageHeader
  title={data.workflow.name}
  breadcrumbs={[{ label: 'Workflows', href: '/workflows' }, { label: data.workflow.name }]}
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center gap-1.5 text-xs">
      <StatusDot status={data.workflow.enabled ? 'running' : 'paused'} withLabel />
    </span>
    <form method="POST" action="?/toggleEnabled" use:enhance>
      <input type="hidden" name="enabled" value={String(!data.workflow.enabled)} />
      <button type="submit" class="btn-secondary py-1 text-xs">
        {data.workflow.enabled ? 'Pause' : 'Enable'}
      </button>
    </form>
    <button class="btn-primary" on:click={runNow}>
      <Play class="h-4 w-4" />
      <span>Run Now</span>
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Executions (30d)" value={total30d.toLocaleString()}>
      <WorkflowIcon slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Success Rate" value={successRate.toFixed(1)} suffix="%">
      <CheckCircle2 slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Avg Duration" value={fmtDuration(avgDurationMs)}>
      <Clock slot="icon" class="h-4 w-4 text-slate-500" />
    </Kpi>
    <Kpi label="Last Run" value={fmtRelTs(lastRun)} hint={lastRun.slice(0, 19).replace('T', ' ')}>
      <Play slot="icon" class="h-4 w-4 text-slate-500" />
    </Kpi>
  </div>

  <!-- Visual stepper diagram -->
  <div class="card p-5">
    <div class="mb-3 flex items-baseline justify-between">
      <h2 class="section-title">Workflow Diagram</h2>
      <span class="text-xs text-slate-400">{stepCount} step{stepCount === 1 ? '' : 's'} · click to inspect</span>
    </div>
    <div class="overflow-x-auto">
      <svg viewBox="0 0 {svgWidth} {SVG_HEIGHT}" width={svgWidth} height={SVG_HEIGHT} class="block">
        {#each data.workflow.steps as step, i}
          {@const x = 20 + i * (BOX_W + GAP)}
          {@const y = (SVG_HEIGHT - BOX_H) / 2}
          {@const Icon = stepIcon(step.kind)}
          {@const isSelected = selectedStep === i}
          <!-- connector line to next step -->
          {#if i < stepCount - 1}
            <path
              d="M {x + BOX_W} {y + BOX_H / 2} C {x + BOX_W + GAP / 2} {y + BOX_H / 2}, {x + BOX_W + GAP / 2} {y + BOX_H / 2}, {x + BOX_W + GAP} {y + BOX_H / 2}"
              fill="none"
              stroke="#94a3b8"
              stroke-width="1.5"
              stroke-dasharray="4 4"
            />
            <polygon
              points="{x + BOX_W + GAP - 6},{y + BOX_H / 2 - 4} {x + BOX_W + GAP},{y + BOX_H / 2} {x + BOX_W + GAP - 6},{y + BOX_H / 2 + 4}"
              fill="#94a3b8"
            />
          {/if}
          <!-- step box -->
          <g style="cursor:pointer"
             on:click={() => (selectedStep = isSelected ? null : i)}
             on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectedStep = isSelected ? null : i; } }}
             role="button" tabindex="0">
            <rect
              x={x}
              y={y}
              width={BOX_W}
              height={BOX_H}
              rx="10"
              ry="10"
              class={stepColor(step.kind)}
              stroke-width={isSelected ? 2.5 : 1.5}
            />
            <foreignObject x={x + 10} y={y + 10} width={BOX_W - 20} height={BOX_H - 20}>
              <div xmlns="http://www.w3.org/1999/xhtml" class="flex h-full flex-col justify-between">
                <div class="flex items-center justify-between">
                  <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset {stepBadge(step.kind)}">
                    <svelte:component this={Icon} class="h-3 w-3" />
                    {step.kind}
                  </span>
                  <span class="text-[10px] text-slate-500">#{i + 1}</span>
                </div>
                <div class="text-xs font-semibold text-slate-800 line-clamp-2">{step.label}</div>
              </div>
            </foreignObject>
          </g>
        {/each}
      </svg>
    </div>
    {#if selectedStep !== null}
      {@const s = data.workflow.steps[selectedStep]}
      <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset {stepBadge(s.kind)}">{s.kind}</span>
          <span class="font-semibold text-slate-800">{s.label}</span>
          {#if s.requiresApproval}
            <span class="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Requires Approval</span>
          {/if}
        </div>
        {#if s.ref}
          <div class="mt-1 text-xs text-slate-500">Reference: <span class="font-mono">{s.ref}</span></div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Recent executions -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">Recent Executions</h2>
      <span class="text-xs text-slate-400">last 20</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Started</th>
            <th class="px-4 py-2 text-left">Trigger</th>
            <th class="px-4 py-2 text-left">Status</th>
            <th class="px-4 py-2 text-right">Duration</th>
          </tr>
        </thead>
        <tbody>
          {#each data.executions.slice(0, 20) as e (e.id)}
            {@const dur = e.endedAt ? new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime() : 0}
            <tr class="tr">
              <td class="td font-mono text-xs text-slate-500">{e.startedAt.replace('T', ' ').slice(0, 19)}</td>
              <td class="td">{e.trigger}</td>
              <td class="td">
                <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {execStatusCls(e.status)}">
                  {e.status}
                </span>
              </td>
              <td class="td text-right font-mono text-xs">{fmtDuration(dur)}</td>
            </tr>
          {:else}
            <tr><td colspan="4" class="px-4 py-6 text-center text-sm text-slate-500">No executions yet.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
