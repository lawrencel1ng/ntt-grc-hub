<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { addToast } from '$lib/stores/toast';
  import { enhance } from '$app/forms';
  import { Plus, MoreHorizontal, Play as PlayIcon, Pause, AlertTriangle, Bot, Plug, User as UserIcon, GitBranch } from 'lucide-svelte';
  import type { WorkflowExecutionStatus, WorkflowStepDef } from '$lib/data/types';

  export let data;
  export let form;
  $: if (form?.workflowCreated) { addToast('success', `Workflow "${form.workflowName}" created.`); showForm = false; }
  $: if (form?.workflowError) addToast('error', form.workflowError);
  let showForm = false;

  type StatusFilter = 'all' | 'active' | 'paused' | 'failing';
  let statusFilter: StatusFilter = 'all';

  $: filtered = data.workflows.filter((w) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return w.enabled && w.lastExecutionStatus !== 'failed';
    if (statusFilter === 'paused') return !w.enabled;
    if (statusFilter === 'failing') return w.lastExecutionStatus === 'failed';
    return true;
  });

  function statusCls(s?: WorkflowExecutionStatus): string {
    switch (s) {
      case 'success':  return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'running':  return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'failed':   return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'halted':   return 'bg-amber-50 text-amber-700 ring-amber-200';
      default:         return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }

  function stepIcon(kind: WorkflowStepDef['kind']) {
    switch (kind) {
      case 'agent': return Bot;
      case 'api': return Plug;
      case 'manual': return UserIcon;
      case 'decision': return GitBranch;
    }
  }

  const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'paused', label: 'Paused' },
    { id: 'failing', label: 'Failing' }
  ];
</script>

<PageHeader title="Workflows" subtitle="Cross-agent orchestration — chain agents, APIs and humans into auditable pipelines.">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={() => (showForm = !showForm)}>
      <Plus class="h-4 w-4" />
      <span>New Workflow</span>
    </button>
  </svelte:fragment>
</PageHeader>

{#if showForm}
  <div class="card p-5">
    <h3 class="mb-3 text-sm font-semibold text-grc-ink">New workflow</h3>
    <form method="POST" action="?/createWorkflow" use:enhance class="flex flex-wrap items-end gap-3">
      <label class="block flex-1 min-w-[200px]">
        <span class="mb-1 block text-xs font-medium text-slate-700">Name</span>
        <input name="name" type="text" class="input" placeholder="Evidence collection — MAS TRM" required maxlength="256" />
      </label>
      <label class="block flex-1 min-w-[240px]">
        <span class="mb-1 block text-xs font-medium text-slate-700">Description (optional)</span>
        <input name="description" type="text" class="input" placeholder="Describe what this workflow does…" maxlength="2048" />
      </label>
      <div class="flex gap-2">
        <button type="submit" class="btn-primary">Create</button>
        <button type="button" class="btn-secondary" on:click={() => (showForm = false)}>Cancel</button>
      </div>
    </form>
  </div>
{/if}

<div class="space-y-6">
  <div class="card flex flex-wrap items-center gap-3 px-4 py-3">
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
    <span class="ml-auto text-xs text-slate-500">{filtered.length} of {data.workflows.length} workflows</span>
  </div>

  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Name</th>
            <th class="px-4 py-2 text-left">Trigger</th>
            <th class="px-4 py-2 text-left">Steps</th>
            <th class="px-4 py-2 text-left">Last Run</th>
            <th class="px-4 py-2 text-left">Success Rate (30d)</th>
            <th class="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as w (w.id)}
            <tr class="tr">
              <td class="td">
                <a href="/workflows/{w.id}" class="block">
                  <div class="font-semibold text-grc-primary hover:underline">{w.name}</div>
                  <div class="text-xs text-slate-500">{w.description}</div>
                </a>
              </td>
              <td class="td text-xs text-slate-500">
                {#if w.steps[0]?.kind === 'manual'}manual{:else}cron · event{/if}
              </td>
              <td class="td">
                <div class="flex items-center gap-1">
                  {#each w.steps as s}
                    {@const Icon = stepIcon(s.kind)}
                    <span class="inline-flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-slate-600" title={s.label}>
                      <Icon class="h-3 w-3" />
                    </span>
                  {/each}
                  <span class="ml-1 text-xs text-slate-500">{w.steps.length}</span>
                </div>
              </td>
              <td class="td">
                <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {statusCls(w.lastExecutionStatus)}">
                  {#if w.lastExecutionStatus === 'running'}
                    <PlayIcon class="h-3 w-3" />
                  {:else if w.lastExecutionStatus === 'failed'}
                    <AlertTriangle class="h-3 w-3" />
                  {:else if !w.enabled}
                    <Pause class="h-3 w-3" />
                  {/if}
                  {w.lastExecutionStatus ?? 'idle'}
                </span>
              </td>
              <td class="td">
                <div class="flex items-center gap-2">
                  <div class="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full bg-violet-500" style="width: {((w.successRate30d ?? 0) * 100).toFixed(0)}%"></div>
                  </div>
                  <span class="font-mono text-xs text-slate-600">{((w.successRate30d ?? 0) * 100).toFixed(1)}%</span>
                </div>
              </td>
              <td class="td text-right">
                <button class="btn-ghost p-1" title="More">
                  <MoreHorizontal class="h-4 w-4" />
                </button>
              </td>
            </tr>
          {:else}
            <tr><td colspan="6" class="px-4 py-6 text-center text-sm text-slate-500">No workflows defined.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
