<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { addToast } from '$lib/stores/toast';
  import { enhance } from '$app/forms';
  import { Siren, Clock, User, Bot, Monitor, Plus } from 'lucide-svelte';
  import type { IncidentSeverity, IncidentStatus } from '$lib/data/types';

  export let data;
  export let form: {
    statusUpdated?: boolean; newStatus?: string; statusError?: string;
    timelineAdded?: boolean; timelineError?: string;
    pmCreated?: boolean; pmError?: string;
  } | null = null;

  $: if (form?.statusUpdated) {
    addToast('success', `Status updated to "${form.newStatus}".`);
    data = { ...data, incident: { ...data.incident, status: form.newStatus as IncidentStatus } };
  }
  $: if (form?.statusError) addToast('error', form.statusError);
  $: if (form?.timelineAdded) { addToast('success', 'Timeline event added.'); showAddEvent = false; newEvent = ''; }
  $: if (form?.timelineError) addToast('error', form.timelineError);
  $: if (form?.pmCreated) { addToast('success', 'Postmortem filed.'); showPmForm = false; }
  $: if (form?.pmError) addToast('error', form.pmError);

  let showAddEvent = false;
  let newEvent = '';
  let showPmForm = false;

  function sevCls(s: IncidentSeverity): string {
    if (s === 'sev1') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'sev2') return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'sev3') return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function statCls(s: IncidentStatus): string {
    if (s === 'open')            return 'bg-rose-50 text-rose-700 ring-rose-200';
    if (s === 'contained')       return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'resolved')        return 'bg-violet-50 text-violet-700 ring-violet-200';
    if (s === 'postmortem-done') return 'bg-green-50 text-green-700 ring-green-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function sourceCls(s: string): string {
    if (s === 'agent')  return 'text-violet-600';
    if (s === 'system') return 'text-slate-400';
    return 'text-blue-600';
  }
  function sourceIcon(s: string) {
    if (s === 'agent')  return Bot;
    if (s === 'system') return Monitor;
    return User;
  }
  function fmtTs(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
</script>

<PageHeader
  title="{data.incident.code} — {data.incident.title}"
  breadcrumbs={[{ label: 'Issues & Incidents', href: '/issues' }, { label: data.incident.code }]}
>
  <svelte:fragment slot="actions">
    <form method="POST" action="?/updateStatus" use:enhance class="flex items-center gap-2">
      <select name="status" class="input py-1 text-sm" value={data.incident.status}>
        <option value="open">open</option>
        <option value="contained">contained</option>
        <option value="resolved">resolved</option>
        <option value="postmortem-done">postmortem-done</option>
      </select>
      <button type="submit" class="btn-primary">Update</button>
    </form>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- Meta strip -->
  <div class="card flex flex-wrap gap-6 px-5 py-4 text-sm">
    <div>
      <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Severity</div>
      <span class="mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset {sevCls(data.incident.severity)}">{data.incident.severity.toUpperCase()}</span>
    </div>
    <div>
      <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</div>
      <span class="mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset {statCls(data.incident.status)}">{data.incident.status}</span>
    </div>
    <div>
      <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Opened</div>
      <div class="mt-1 font-mono text-xs text-slate-700">{fmtTs(data.incident.openedAt)}</div>
    </div>
    {#if data.incident.containedAt}
      <div>
        <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Contained</div>
        <div class="mt-1 font-mono text-xs text-slate-700">{fmtTs(data.incident.containedAt)}</div>
      </div>
    {/if}
    {#if data.incident.resolvedAt}
      <div>
        <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Resolved</div>
        <div class="mt-1 font-mono text-xs text-slate-700">{fmtTs(data.incident.resolvedAt)}</div>
      </div>
    {/if}
  </div>

  <!-- Timeline -->
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <h2 class="text-sm font-semibold text-grc-ink">Timeline ({data.timeline.length} events)</h2>
      <button class="btn-ghost text-xs" on:click={() => (showAddEvent = !showAddEvent)}>
        <Plus class="h-3.5 w-3.5" />
        Add event
      </button>
    </div>

    {#if showAddEvent}
      <div class="border-b border-slate-100 bg-slate-50 px-5 py-4">
        <form method="POST" action="?/addTimelineEvent" use:enhance class="flex items-end gap-3">
          <label class="block flex-1">
            <span class="mb-1 block text-xs font-medium text-slate-700">Event</span>
            <input name="event" type="text" bind:value={newEvent} class="input" placeholder="Describe what happened…" required maxlength="1024" />
          </label>
          <button type="submit" class="btn-primary">Add</button>
          <button type="button" class="btn-secondary" on:click={() => { showAddEvent = false; newEvent = ''; }}>Cancel</button>
        </form>
      </div>
    {/if}

    {#if data.timeline.length === 0}
      <div class="px-5 py-8 text-center text-sm text-slate-400">No timeline events recorded yet.</div>
    {:else}
      <ol class="relative ml-8 space-y-0 py-4 pl-6">
        {#each data.timeline as ev (ev.id)}
          {@const Icon = sourceIcon(ev.source)}
          <li class="relative pb-5 last:pb-0">
            <span class="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2 ring-slate-200">
              <Icon class="h-3 w-3 {sourceCls(ev.source)}" />
            </span>
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm text-slate-800">{ev.event}</p>
                <div class="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                  <span>{ev.actor}</span>
                  <span>·</span>
                  <Clock class="inline h-3 w-3" />
                  <span class="font-mono">{fmtTs(ev.ts)}</span>
                </div>
              </div>
            </div>
          </li>
        {/each}
      </ol>
    {/if}
  </div>

  <!-- Postmortem -->
  {#if data.postmortem}
    <div class="card p-5">
      <h2 class="mb-4 flex items-center gap-2 text-sm font-semibold text-grc-ink">
        <Siren class="h-4 w-4 text-rose-500" />
        Postmortem
      </h2>
      <div class="space-y-4">
        <div>
          <h3 class="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Root Cause</h3>
          <div class="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">{data.postmortem.rootCauseMd}</div>
        </div>
        <div>
          <h3 class="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Corrective Actions</h3>
          <div class="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">{data.postmortem.correctiveActionsMd}</div>
        </div>
        {#if data.postmortem.signedOffAt}
          <div class="text-xs text-slate-500">
            Signed off: <span class="font-mono">{fmtTs(data.postmortem.signedOffAt)}</span>
          </div>
        {/if}
      </div>
    </div>
  {:else if data.incident.status === 'resolved' || data.incident.status === 'postmortem-done'}
    <div class="card overflow-hidden">
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-grc-ink">
          <Siren class="h-4 w-4 text-rose-500" />
          Postmortem
        </h2>
        <button class="btn-ghost text-xs" on:click={() => (showPmForm = !showPmForm)}>
          <Plus class="h-3.5 w-3.5" />
          Draft postmortem
        </button>
      </div>
      {#if showPmForm}
        <div class="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <form method="POST" action="?/createPostmortem" use:enhance class="space-y-3">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Root cause</span>
              <textarea name="rootCauseMd" rows="4" class="input resize-none font-mono text-xs"
                placeholder="## Root Cause&#10;&#10;Describe what went wrong and why…" required maxlength="10000"></textarea>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Corrective actions</span>
              <textarea name="correctiveActionsMd" rows="4" class="input resize-none font-mono text-xs"
                placeholder="## Actions&#10;&#10;1. …&#10;2. …" required maxlength="10000"></textarea>
            </label>
            <div class="flex gap-2">
              <button type="submit" class="btn-primary">File postmortem</button>
              <button type="button" class="btn-secondary" on:click={() => (showPmForm = false)}>Cancel</button>
            </div>
          </form>
        </div>
      {:else}
        <div class="px-5 py-6 text-center text-sm text-slate-400">No postmortem on file yet for this resolved incident.</div>
      {/if}
    </div>
  {/if}
</div>
