<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { enhance } from '$app/forms';
  import { addToast } from '$lib/stores/toast';
  import { ListChecks, ClipboardCheck, Link as LinkIcon, User as UserIcon, Pencil } from 'lucide-svelte';
  import type { IssueSource, RiskSeverity, IssueStatus, ActionStatus } from '$lib/data/types';

  $: if (form?.statusUpdated) addToast('success', `Status updated to "${form.newStatus}".`);
  $: if (form?.statusError) addToast('error', form.statusError);
  $: if (form?.actionAdded) { addToast('success', 'Action added.'); newActionDesc = ''; newActionDue = ''; }
  $: if (form?.actionUpdated && form.actionId && form.status) {
    data = { ...data, actions: data.actions.map((a) => a.id === form!.actionId ? { ...a, status: form!.status as typeof a.status } : a) };
    addToast('success', `Action marked ${form.status}.`);
  }
  $: if (form?.actionError) addToast('error', form.actionError);
  $: if (form?.editSuccess) { addToast('success', 'Issue updated.'); showEditForm = false; }
  $: if (form?.editError) addToast('error', form.editError);

  export let data;
  export let form: {
    statusUpdated?: boolean; newStatus?: string; statusError?: string;
    actionAdded?: boolean; actionUpdated?: boolean; actionId?: string; status?: string; actionError?: string;
    editSuccess?: boolean; editError?: string;
  } | null = null;

  let showEditForm = false;

  let newActionDesc = '';
  let newActionDue = '';

  function sevCls(s: RiskSeverity): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'low')      return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function statusCls(s: IssueStatus): string {
    switch (s) {
      case 'open':          return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'in-progress':   return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'resolved':      return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'accepted-risk': return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }
  function actionCls(s: ActionStatus): string {
    switch (s) {
      case 'not-started': return 'bg-slate-100 text-slate-700 ring-slate-200';
      case 'in-progress': return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'done':        return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }
  function sourceCls(s: IssueSource): string {
    switch (s) {
      case 'audit':          return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'risk-treatment': return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'incident':       return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'control-test':   return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'regulatory':     return 'bg-amber-50 text-amber-700 ring-amber-200';
    }
  }

  // Synthesise source link href + label
  function sourceHref(s: IssueSource, _sid: string): string | null {
    switch (s) {
      case 'audit':          return `/audits`;
      case 'risk-treatment': return `/risk`;
      case 'incident':       return `/issues`;
      case 'control-test':   return `/controls`;
      case 'regulatory':     return `/regwatch`;
      default:               return null;
    }
  }

  $: description = data.issue.description
    ?? `Issue raised from ${data.issue.source} workflow (${data.issue.sourceId}). Validate scope, capture evidence, and complete the action plan below.`;

  // Mini timeline derived from real timestamps + status.
  $: timeline = (() => {
    const out: { ts: string; event: string; status: 'done' | 'pending' }[] = [];
    out.push({ ts: data.issue.createdAt ?? '', event: 'Issue created and assigned to owner', status: 'done' });
    if (data.issue.status === 'in-progress' || data.issue.status === 'resolved') {
      out.push({ ts: '', event: 'Investigation in progress', status: 'done' });
    } else {
      out.push({ ts: '', event: 'Investigation in progress', status: 'pending' });
    }
    if (data.issue.status === 'resolved') {
      out.push({ ts: '', event: 'Resolved with evidence sealed', status: 'done' });
    } else {
      out.push({ ts: data.issue.dueAt ?? '', event: 'Target resolution', status: 'pending' });
    }
    return out;
  })();

  function fmtRel(iso?: string): string {
    if (!iso) return '—';
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const ad = Math.abs(diff);
    if (ad < 3600) return `${Math.floor(ad / 60)}m ${diff > 0 ? '' : 'ago'}`;
    if (ad < 86400) return `${Math.floor(ad / 3600)}h ${diff > 0 ? '' : 'ago'}`;
    return `${Math.floor(ad / 86400)}d ${diff > 0 ? '' : 'ago'}`;
  }

  $: linkedFindingId = data.issue.source === 'audit' ? data.issue.sourceId : null;
</script>

<PageHeader
  title={data.issue.id.split('_').pop() ?? data.issue.id}
  breadcrumbs={[{ label: 'Issues', href: '/issues' }, { label: data.issue.id }]}
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset {sevCls(data.issue.severity)}">{data.issue.severity}</span>
    <form method="POST" action="?/updateStatus" use:enhance class="flex items-center gap-1.5">
      <select name="status" class="input py-1 text-xs" value={form?.newStatus ?? data.issue.status}>
        <option value="open">open</option>
        <option value="in-progress">in-progress</option>
        <option value="resolved">resolved</option>
        <option value="accepted-risk">accepted-risk</option>
      </select>
      <button type="submit" class="btn-secondary py-1 text-xs">Update</button>
    </form>
    <button class="btn-secondary" on:click={() => (showEditForm = !showEditForm)}>
      <Pencil class="h-4 w-4" />
      <span>Edit</span>
    </button>
  </svelte:fragment>
</PageHeader>

{#if showEditForm}
  <div class="card p-5">
    <h3 class="mb-4 text-sm font-semibold text-grc-ink">Edit Issue</h3>
    <form method="POST" action="?/updateIssue" use:enhance class="space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium text-slate-700">Title</span>
          <input name="title" class="input" value={data.issue.title} required maxlength="256" />
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium text-slate-700">Description</span>
          <textarea name="description" class="input h-20 resize-none" maxlength="2048">{data.issue.description ?? ''}</textarea>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Severity</span>
          <select name="severity" class="input" value={data.issue.severity}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Due Date</span>
          <input name="dueAt" type="date" class="input" value={data.issue.dueAt ? data.issue.dueAt.slice(0, 10) : ''} />
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
      <div class="rounded-lg bg-rose-50 p-2 text-rose-700"><ListChecks class="h-5 w-5" /></div>
      <div class="flex-1">
        <h2 class="text-lg font-semibold text-grc-ink">{data.issue.title}</h2>
        <div class="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sourceCls(data.issue.source)}">{data.issue.source}</span>
          {#if sourceHref(data.issue.source, data.issue.sourceId)}
            <a class="flex items-center gap-1 text-grc-primary hover:underline" href={sourceHref(data.issue.source, data.issue.sourceId)!}>
              <LinkIcon class="h-3 w-3" /> Source: {data.issue.sourceId}
            </a>
          {/if}
          <div class="flex items-center gap-1 text-slate-500">
            <UserIcon class="h-3 w-3" /> {data.issue.ownerEmail ?? '—'}
          </div>
          <div class="text-slate-500">Due: <span class="font-mono">{data.issue.dueAt?.slice(0, 10) ?? '—'}</span> ({fmtRel(data.issue.dueAt)})</div>
        </div>
        <p class="mt-3 text-sm text-slate-700">{description}</p>
      </div>
    </div>
  </div>

  <!-- Actions table -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="section-title">Actions</h2>
      <span class="text-xs text-slate-400">{data.actions.length} action{data.actions.length === 1 ? '' : 's'}</span>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100 text-sm">
        <thead class="thead">
          <tr>
            <th class="px-4 py-2 text-left">Description</th>
            <th class="px-4 py-2 text-left">Owner</th>
            <th class="px-4 py-2 text-left">Due</th>
            <th class="px-4 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each data.actions as a (a.id)}
            <tr class="tr">
              <td class="td">{a.description}</td>
              <td class="td text-xs text-slate-500">{data.issue.ownerEmail ?? '—'}</td>
              <td class="td font-mono text-xs text-slate-500">{a.dueAt?.slice(0, 10) ?? '—'}</td>
              <td class="td">
                <form method="POST" action="?/updateActionStatus" use:enhance class="flex items-center gap-1">
                  <input type="hidden" name="actionId" value={a.id} />
                  <select name="status" class="input py-0.5 text-[11px]" value={a.status}>
                    <option value="not-started">not-started</option>
                    <option value="in-progress">in-progress</option>
                    <option value="done">done</option>
                  </select>
                  <button type="submit" class="btn-ghost p-1 text-[11px]">✓</button>
                </form>
              </td>
            </tr>
          {:else}
            <tr><td colspan="4" class="px-4 py-6 text-center text-sm text-slate-500">No actions recorded.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <!-- Add action form -->
    <form method="POST" action="?/addAction" use:enhance class="flex flex-wrap items-end gap-2 border-t border-slate-100 px-5 py-3">
      <div class="flex-1 min-w-[200px]">
        <label for="action-desc" class="block text-[11px] text-slate-500 mb-0.5">Description</label>
        <input id="action-desc" type="text" name="description" class="input py-1 text-xs w-full" placeholder="Describe the action…" bind:value={newActionDesc} maxlength="2048" required />
      </div>
      <div>
        <label for="action-due" class="block text-[11px] text-slate-500 mb-0.5">Due date</label>
        <input id="action-due" type="date" name="dueAt" class="input py-1 text-xs" bind:value={newActionDue} />
      </div>
      <button type="submit" class="btn-primary py-1 text-xs whitespace-nowrap">+ Add Action</button>
    </form>
  </div>

  <!-- Mini Timeline -->
  <div class="card p-5">
    <h2 class="section-title mb-3">Timeline</h2>
    <ol class="relative ml-3 border-l-2 border-slate-200">
      {#each timeline as t, i (i)}
        <li class="relative ml-6 py-2">
          <span class="absolute -left-[33px] top-3 inline-flex h-3 w-3 rounded-full {t.status === 'done' ? 'bg-violet-500' : 'bg-slate-300'} ring-2 ring-white"></span>
          <div class="font-mono text-[11px] text-slate-500">{t.ts ? t.ts.replace('T', ' ').slice(0, 19) : 'pending'}</div>
          <div class="mt-0.5 text-sm font-medium text-grc-ink">{t.event}</div>
        </li>
      {/each}
    </ol>
  </div>

  <!-- Related items -->
  {#if linkedFindingId}
    <div class="card p-5">
      <h2 class="section-title mb-3">Related Items</h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <a href="/audits" class="card-hover flex items-center gap-3 rounded-lg px-3 py-3 ring-1 ring-inset ring-slate-200/70">
          <div class="rounded-lg bg-blue-50 p-2 text-blue-700"><ClipboardCheck class="h-4 w-4" /></div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-500">Audit Finding</div>
            <div class="text-sm font-mono">{linkedFindingId}</div>
          </div>
        </a>
      </div>
    </div>
  {/if}
</div>
