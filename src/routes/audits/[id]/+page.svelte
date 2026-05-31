<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import EvidenceChip from '$lib/components/EvidenceChip.svelte';
  import AgentTypeBadge from '$lib/components/AgentTypeBadge.svelte';
  import { addToast } from '$lib/stores/toast';
  import { downloadCsv } from '$lib/utils/csv';
  import { enhance } from '$app/forms';
  import { Download, FileBarChart, FileText, Package, Zap, ClipboardCheck, Pencil, XCircle } from 'lucide-svelte';
  import type { EngagementType, AuditFinding } from '$lib/data/types';

  export let data;
  export let form: {
    findingUpdated?: boolean; findingId?: string; newStatus?: string; findingError?: string;
    findingCreated?: boolean;
    editSuccess?: boolean; editError?: string;
    auditClosed?: boolean; closeError?: string;
    wpCreated?: boolean; wpError?: string;
  } | null = null;

  // Optimistically update finding status in the local list on success
  $: if (form?.findingUpdated && form.findingId && form.newStatus) {
    data = {
      ...data,
      findings: data.findings.map((f) =>
        f.id === form!.findingId ? { ...f, status: form!.newStatus as AuditFinding['status'] } : f
      )
    };
    addToast('success', `Finding status updated to "${form.newStatus}".`);
  }
  $: if (form?.findingCreated) { addToast('success', 'Finding recorded.'); showNewFinding = false; }
  $: if (form?.findingError) addToast('error', form.findingError);
  $: if (form?.editSuccess) { addToast('success', 'Engagement updated.'); showEditForm = false; }
  $: if (form?.editError) addToast('error', form.editError);
  $: if (form?.auditClosed) addToast('success', 'Engagement closed.');
  $: if (form?.closeError) addToast('error', form.closeError);
  $: if (form?.wpCreated) { addToast('success', 'Workpaper added.'); showWpForm = false; wpTitle = ''; wpContent = ''; }
  $: if (form?.wpError) addToast('error', form.wpError);

  let showNewFinding = false;
  let showEditForm = false;
  let showWpForm = false;
  let wpTitle = '', wpContent = '';
  let nfTitle = '', nfDesc = '', nfSeverity = 'medium', nfDue = '';

  type Tab = 'findings' | 'workpapers' | 'pack';
  let tab: Tab = 'findings';
  const TABS: { id: Tab; label: string; icon: typeof Download }[] = [
    { id: 'findings',   label: 'Findings',     icon: FileBarChart },
    { id: 'workpapers', label: 'Workpapers',   icon: FileText },
    { id: 'pack',       label: 'Evidence Pack', icon: Package }
  ];

  function typeCls(t: EngagementType): string {
    switch (t) {
      case 'external':   return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'internal':   return 'bg-violet-50 text-violet-700 ring-violet-200';
      case 'regulatory': return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'customer':   return 'bg-violet-50 text-violet-700 ring-violet-200';
    }
  }
  function sevCls(s: string): string {
    if (s === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (s === 'high')     return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (s === 'medium')   return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  function statusCls(s: string): string {
    if (s === 'open')          return 'bg-rose-50 text-rose-700 ring-rose-200';
    if (s === 'closed')        return 'bg-violet-50 text-violet-700 ring-violet-200';
    if (s === 'accepted-risk') return 'bg-amber-50 text-amber-700 ring-amber-200';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
  }

  function exportFindings() {
    const headers = ['severity','title','description','status','due_at'];
    const rows: string[][] = data.findings.map((f) => [f.severity, f.title, f.description ?? '', f.status, f.dueAt ?? '']);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    downloadCsv(`audit-${data.audit.id}-findings-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    addToast('success', `Findings CSV exported (${rows.length} rows).`);
  }
  function escapeCsv(s: string): string {
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadPack() {
    const headers = ['id','title','kind','captured_at','hash'];
    const rows: string[][] = data.evidence.map((e) => [String(e.id), e.title, e.kind, e.capturedAt, e.rowHash ?? '']);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    downloadCsv(`audit-${data.audit.id}-evidence-pack-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    addToast('success', `Evidence pack downloaded — ${rows.length} items via Audit Companion.`);
  }

  import type { AuditWorkpaper } from '$lib/data/types';
  $: workpapers = data.workpapers as AuditWorkpaper[];

  function downloadWorkpaper(wp: AuditWorkpaper) {
    const blob = new Blob([wp.contentMd], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${wp.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${wp.createdAt.slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('success', `Downloaded "${wp.title}"`);
  }

  function fmtDate(iso?: string): string {
    return iso ? iso.slice(0, 10) : '—';
  }

  // Group findings by severity for narrative
  $: findingsBySev = (() => {
    const out: Record<string, AuditFinding[]> = { critical: [], high: [], medium: [], low: [] };
    for (const f of data.findings) {
      if (f.severity in out) out[f.severity].push(f);
    }
    return out;
  })();
  void findingsBySev;
</script>

<PageHeader
  title={data.audit.name}
  breadcrumbs={[{ label: 'Audits', href: '/audits' }, { label: data.audit.name }]}
>
  <svelte:fragment slot="actions">
    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset {typeCls(data.audit.type)}">{data.audit.type}</span>
    <button class="btn-secondary" on:click={() => (showEditForm = !showEditForm)}>
      <Pencil class="h-4 w-4" />
      <span>Edit</span>
    </button>
    {#if !data.audit.closedAt}
      <form method="POST" action="?/closeAudit" use:enhance>
        <button type="submit" class="btn-secondary py-1 text-xs text-rose-600 hover:text-rose-700"
          on:click={(e) => { if (!confirm('Close this engagement? This cannot be undone.')) e.preventDefault(); }}>
          <XCircle class="h-4 w-4" />
          Close Engagement
        </button>
      </form>
    {/if}
  </svelte:fragment>
</PageHeader>

{#if showEditForm}
  <div class="card p-5">
    <h3 class="mb-4 text-sm font-semibold text-grc-ink">Edit Engagement</h3>
    <form method="POST" action="?/updateAudit" use:enhance class="space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium text-slate-700">Name</span>
          <input name="name" class="input" value={data.audit.name} required maxlength="256" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700">Lead Auditor</span>
          <input name="leadAuditor" class="input" value={data.audit.leadAuditor} maxlength="256" />
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-medium text-slate-700">Scope</span>
          <textarea name="scope" class="input h-20 resize-none" maxlength="2048">{data.audit.scope ?? ''}</textarea>
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
  <!-- Metadata header card -->
  <div class="card p-5">
    <div class="flex items-start gap-3">
      <div class="rounded-lg bg-violet-50 p-2 text-violet-700"><ClipboardCheck class="h-5 w-5" /></div>
      <div class="flex-1">
        <div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
          <div>
            <div class="section-title text-xs">Lead Auditor</div>
            <div class="mt-1 font-medium text-slate-800">{data.audit.leadAuditor}</div>
          </div>
          <div>
            <div class="section-title text-xs">Opened</div>
            <div class="mt-1 font-mono text-slate-800">{fmtDate(data.audit.openedAt)}</div>
          </div>
          <div>
            <div class="section-title text-xs">Closed</div>
            <div class="mt-1 font-mono text-slate-800">{fmtDate(data.audit.closedAt)}</div>
          </div>
          <div>
            <div class="section-title text-xs">Framework</div>
            <div class="mt-1 font-medium text-slate-800">
              {#if data.audit.frameworkId}
                <a href="/frameworks/{data.audit.frameworkId}" class="text-grc-primary hover:underline">{data.audit.frameworkId}</a>
              {:else}
                —
              {/if}
            </div>
          </div>
        </div>
        {#if data.audit.scope}
          <div class="mt-3">
            <div class="section-title text-xs">Scope</div>
            <div class="mt-1 text-sm text-slate-700">{data.audit.scope}</div>
          </div>
        {/if}
      </div>
    </div>
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

    <!-- Findings -->
    {#if tab === 'findings'}
      <div class="flex items-center justify-end gap-2 border-b border-slate-100 px-5 py-3">
        <button class="btn-secondary py-1 text-xs" on:click={() => (showNewFinding = !showNewFinding)}>
          + Add Finding
        </button>
        <button class="btn-secondary py-1 text-xs" on:click={exportFindings}>
          <Download class="h-3 w-3" /> Export CSV
        </button>
      </div>
      {#if showNewFinding}
        <form method="POST" action="?/createFinding" use:enhance
          class="flex flex-wrap items-end gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
          <div class="flex-1 min-w-[200px]">
            <label for="nf-title" class="block text-[11px] text-slate-500 mb-0.5">Title *</label>
            <input id="nf-title" type="text" name="title" class="input py-1 text-xs w-full" placeholder="Finding title…" bind:value={nfTitle} maxlength="256" required />
          </div>
          <div>
            <label for="nf-severity" class="block text-[11px] text-slate-500 mb-0.5">Severity</label>
            <select id="nf-severity" name="severity" class="input py-1 text-xs" bind:value={nfSeverity}>
              <option value="critical">critical</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
              <option value="info">info</option>
            </select>
          </div>
          <div>
            <label for="nf-due" class="block text-[11px] text-slate-500 mb-0.5">Due date</label>
            <input id="nf-due" type="date" name="dueAt" class="input py-1 text-xs" bind:value={nfDue} />
          </div>
          <div class="w-full">
            <label for="nf-desc" class="block text-[11px] text-slate-500 mb-0.5">Description</label>
            <input id="nf-desc" type="text" name="description" class="input py-1 text-xs w-full" placeholder="Optional description…" bind:value={nfDesc} maxlength="2048" />
          </div>
          <button type="submit" class="btn-primary py-1 text-xs">Save Finding</button>
          <button type="button" class="btn-secondary py-1 text-xs" on:click={() => (showNewFinding = false)}>Cancel</button>
        </form>
      {/if}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-sm">
          <thead class="thead">
            <tr>
              <th class="px-4 py-2 text-left">Severity</th>
              <th class="px-4 py-2 text-left">Title</th>
              <th class="px-4 py-2 text-left">Description</th>
              <th class="px-4 py-2 text-left">Control</th>
              <th class="px-4 py-2 text-left">Due</th>
              <th class="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {#each data.findings as f (f.id)}
              <tr class="tr">
                <td class="td"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset {sevCls(f.severity)}">{f.severity}</span></td>
                <td class="td">{f.title}</td>
                <td class="td max-w-md truncate text-xs text-slate-500">{f.description}</td>
                <td class="td text-xs text-slate-500 font-mono">
                  {#if f.controlId}
                    <a href="/controls/{f.controlId}" class="hover:underline">{f.controlId.slice(0, 16)}…</a>
                  {:else}
                    —
                  {/if}
                </td>
                <td class="td font-mono text-xs text-slate-500">{fmtDate(f.dueAt)}</td>
                <td class="td">
                  <form method="POST" action="?/updateFindingStatus" use:enhance class="flex items-center gap-1">
                    <input type="hidden" name="findingId" value={f.id} />
                    <select name="status" class="input py-0.5 text-[11px]" value={f.status}>
                      <option value="open">open</option>
                      <option value="closed">closed</option>
                      <option value="accepted-risk">accepted-risk</option>
                    </select>
                    <button type="submit" class="btn-ghost p-1 text-[11px]">✓</button>
                  </form>
                </td>
              </tr>
            {:else}
              <tr><td colspan="6" class="px-4 py-6 text-center text-sm text-slate-500">No findings recorded.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Workpapers -->
    {:else if tab === 'workpapers'}
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <span class="text-xs text-slate-500">{workpapers.length} workpapers</span>
        {#if !data.audit.closedAt}
          <button class="btn-primary" on:click={() => (showWpForm = !showWpForm)}>
            <FileText class="h-4 w-4" />
            Add Workpaper
          </button>
        {/if}
      </div>
      {#if showWpForm}
        <div class="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <form method="POST" action="?/createWorkpaper" use:enhance class="space-y-3">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Title</span>
              <input name="title" type="text" bind:value={wpTitle} class="input" placeholder="Workpaper title…" required maxlength="256" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Content (Markdown)</span>
              <textarea name="contentMd" bind:value={wpContent} rows="6" class="input w-full resize-y font-mono text-xs"
                placeholder="## Objective&#10;&#10;## Procedure&#10;&#10;## Evidence&#10;&#10;## Conclusion" required maxlength="50000"></textarea>
            </label>
            <div class="flex gap-2">
              <button type="submit" class="btn-primary">Add Workpaper</button>
              <button type="button" class="btn-secondary" on:click={() => { showWpForm = false; wpTitle = ''; wpContent = ''; }}>Cancel</button>
            </div>
          </form>
        </div>
      {/if}
      <div class="divide-y divide-slate-100">
        {#each workpapers as wp (wp.id)}
          <div class="px-5 py-4">
            <div class="flex items-start justify-between">
              <div>
                <div class="font-semibold text-grc-ink">{wp.title}</div>
                <div class="mt-0.5 text-xs text-slate-500">{wp.createdAt.slice(0, 10)}</div>
              </div>
              <button class="btn-ghost p-1" on:click={() => downloadWorkpaper(wp)}>
                <Download class="h-4 w-4" />
              </button>
            </div>
            <p class="mt-2 text-sm text-slate-600 line-clamp-3">{wp.contentMd.replace(/^#+\s*/gm, '').slice(0, 200)}</p>
          </div>
        {:else}
          <div class="px-5 py-6 text-center text-sm text-slate-400">No workpapers on file for this engagement.</div>
        {/each}
      </div>

    <!-- Evidence Pack -->
    {:else if tab === 'pack'}
      <div class="space-y-4 p-5">
        <div class="flex items-start gap-3 rounded-xl bg-white px-5 py-4 ring-1 ring-inset ring-violet-200">
          <div class="rounded-md bg-violet-50 p-2 text-violet-700">
            <Zap class="h-5 w-5" />
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-slate-800">Generated by Audit Companion agent</span>
              <AgentTypeBadge type="intelligent" />
            </div>
            <div class="mt-1 text-xs text-violet-700">
              {data.evidence.length} evidence items assembled automatically via Audit Companion.
            </div>
          </div>
          <button class="btn-primary" on:click={downloadPack}>
            <Download class="h-4 w-4" />
            Download CSV
          </button>
        </div>

        <div>
          <h3 class="section-title mb-3">Evidence Items ({data.evidence.length})</h3>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {#each data.evidence as e (e.id)}
              <div class="rounded-lg bg-white ring-1 ring-inset ring-slate-200/70 p-3 text-xs">
                <div class="truncate font-medium text-slate-800">{e.title}</div>
                <div class="mt-1 flex items-center justify-between gap-2">
                  <span class="text-slate-500">{e.kind}</span>
                  <EvidenceChip hash={e.rowHash ?? ''} />
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
