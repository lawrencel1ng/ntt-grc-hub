<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Kpi from '$lib/components/Kpi.svelte';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import { addToast } from '$lib/stores/toast';
  import { getConnectorSpecs, type ConnectorCategory } from '$lib/data/workflows';
  import type { Connector } from '$lib/data/types';
  import {
    Cloud, KeyRound, ListChecks, MessageSquare, Building2, ShieldCheck, ScrollText, Webhook,
    Plug, MoreHorizontal, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Container,
    Github, Gitlab, Cog, Slack, MessageCircle, Bell, PhoneCall, Mail, FileText,
    Briefcase, Inbox, BarChart3, Database, ShieldAlert, Bug, Activity, GraduationCap
  } from 'lucide-svelte';

  export let data;

  // Local mutable copy so sync/reconnect actions produce visible changes immediately.
  let connectors: Connector[] = data.connectors.map((c) => ({ ...c }));
  let syncing = false;
  let openMenu: string | null = null;

  async function patchConnector(id: string, action: 'sync' | 'reconnect'): Promise<{ lastSyncAt: string; status: string } | null> {
    try {
      const res = await fetch(`/api/connectors/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  async function syncAll() {
    if (syncing) return;
    syncing = true;
    addToast('info', `Syncing ${connectors.length} connectors…`);
    const targets = connectors.filter((c) => c.status !== 'disconnected');
    await Promise.all(targets.map((c) => patchConnector(c.id, 'sync')));
    const now = new Date().toISOString();
    connectors = connectors.map((c) =>
      c.status === 'disconnected' ? c : { ...c, lastSyncAt: now }
    );
    syncing = false;
    addToast('success', `Synced ${targets.length} connectors · ${connectors.length - targets.length} skipped (disconnected).`);
  }

  async function syncOne(c: Connector) {
    openMenu = null;
    if (c.status === 'disconnected') {
      addToast('error', `${c.name} is disconnected — reauth required before sync.`);
      return;
    }
    const result = await patchConnector(c.id, 'sync');
    const now = result?.lastSyncAt ?? new Date().toISOString();
    connectors = connectors.map((x) => (x.id === c.id ? { ...x, lastSyncAt: now } : x));
    addToast('success', `${c.name} synced.`);
  }

  async function reconnect(c: Connector) {
    openMenu = null;
    const result = await patchConnector(c.id, 'reconnect');
    const now = result?.lastSyncAt ?? new Date().toISOString();
    connectors = connectors.map((x) =>
      x.id === c.id ? { ...x, status: 'connected', lastSyncAt: now } : x
    );
    addToast('success', `${c.name} reconnected.`);
  }

  // ---------- Catalog lookup ----------
  const SPECS = getConnectorSpecs();
  const KIND_TO_CAT: Record<string, ConnectorCategory> = Object.fromEntries(
    SPECS.map((s) => [s.kind, s.category])
  );

  const CATEGORIES: ConnectorCategory[] = [
    'Cloud', 'Identity', 'ITSM/DevOps', 'Comms', 'SaaS', 'Security/Obs', 'GRC/Audit', 'Custom'
  ];

  function categoryIcon(c: ConnectorCategory) {
    switch (c) {
      case 'Cloud': return Cloud;
      case 'Identity': return KeyRound;
      case 'ITSM/DevOps': return ListChecks;
      case 'Comms': return MessageSquare;
      case 'SaaS': return Building2;
      case 'Security/Obs': return ShieldCheck;
      case 'GRC/Audit': return ScrollText;
      case 'Custom': return Webhook;
    }
  }

  // Lucide best-fit per connector kind. Fallback to Plug for unknowns.
  function connectorIcon(kind: string) {
    switch (kind) {
      // Cloud
      case 'aws': case 'azure': case 'gcp': case 'oci': case 'alibaba': case 'ntt-cloud': return Cloud;
      // Identity
      case 'okta': case 'entra': case 'ping': case 'auth0': case 'onelogin': return KeyRound;
      // ITSM / DevOps
      case 'jira': case 'servicenow': return ListChecks;
      case 'github': return Github;
      case 'gitlab': return Gitlab;
      case 'bitbucket': return Github;
      case 'jenkins': case 'circleci': return Cog;
      // Comms
      case 'slack': return Slack;
      case 'teams': return MessageCircle;
      case 'pagerduty': return Bell;
      case 'opsgenie': return PhoneCall;
      // SaaS
      case 'm365': return Mail;
      case 'google-workspace': return Mail;
      case 'salesforce': return Briefcase;
      case 'box': case 'dropbox': return Inbox;
      case 'workday': return FileText;
      // Security / Obs
      case 'datadog': return BarChart3;
      case 'splunk': return Database;
      case 'crowdstrike': return ShieldAlert;
      case 'wiz': return ShieldCheck;
      case 'snyk': case 'tenable': case 'qualys': return Bug;
      case 'knowbe4': return GraduationCap;
      // GRC / Audit
      case 'servicenow-irm': case 'archer': case 'onetrust': return ScrollText;
      // Custom
      case 'webhook': return Webhook;
      case 'rest-api': return Activity;
      case 'jdbc': return Database;
      default: return Plug;
    }
  }

  function statusChip(s: Connector['status']): { cls: string; icon: typeof CheckCircle2; label: string } {
    if (s === 'connected') return { cls: 'bg-violet-50 text-violet-700 ring-violet-200', icon: CheckCircle2, label: 'Connected' };
    if (s === 'degraded')  return { cls: 'bg-amber-50 text-amber-700 ring-amber-200',       icon: AlertTriangle, label: 'Degraded' };
    return                         { cls: 'bg-rose-50 text-rose-700 ring-rose-200',         icon: XCircle,       label: 'Disconnected' };
  }

  function fmtRelTs(ts: string | undefined): string {
    if (!ts) return '—';
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60)    return `${Math.floor(diff)}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // ---------- KPI roll-ups ----------
  $: total = connectors.length;
  $: connected = connectors.filter((c) => c.status === 'connected').length;
  $: degraded = connectors.filter((c) => c.status === 'degraded').length;
  $: disconnected = connectors.filter((c) => c.status === 'disconnected').length;
  $: mostRecentSync = (() => {
    const ts = connectors
      .map((c) => c.lastSyncAt)
      .filter((x): x is string => !!x)
      .sort((a, b) => (a < b ? 1 : -1))[0];
    return ts ?? '';
  })();

  // ---------- Group connectors by category ----------
  $: grouped = (() => {
    const out = new Map<ConnectorCategory, Connector[]>();
    for (const cat of CATEGORIES) out.set(cat, []);
    for (const c of connectors) {
      const cat = KIND_TO_CAT[c.kind] ?? 'Custom';
      out.get(cat)!.push(c);
    }
    return out;
  })();
</script>

<svelte:window on:click={() => (openMenu = null)} />

<PageHeader
  title="Connectors"
  subtitle="40+ integrations across Cloud, Identity, ITSM, Comms, SaaS, Security and Custom"
>
  <svelte:fragment slot="actions">
    <button class="btn-secondary" on:click={syncAll} disabled={syncing}>
      <RefreshCw class="h-4 w-4 {syncing ? 'animate-spin' : ''}" />
      {syncing ? 'Syncing…' : 'Sync All'}
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-6">
  <!-- KPI strip -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi label="Total Connected" value={`${connected}/${total}`} delta={4} hint="active integrations">
      <Container slot="icon" class="h-4 w-4 text-violet-600" />
    </Kpi>
    <Kpi label="Degraded" value={String(degraded)} delta={0} tone="bad" hint="elevated error rate">
      <AlertTriangle slot="icon" class="h-4 w-4 text-amber-500" />
    </Kpi>
    <Kpi label="Disconnected" value={String(disconnected)} delta={-1} tone="bad" hint="needs reauth">
      <XCircle slot="icon" class="h-4 w-4 text-rose-500" />
    </Kpi>
    <Kpi label="Last Sync" value={fmtRelTs(mostRecentSync)} hint="any connector">
      <RefreshCw slot="icon" class="h-4 w-4 text-slate-500" />
    </Kpi>
  </div>

  <!-- Grouped grid -->
  {#each CATEGORIES as cat}
    {@const items = grouped.get(cat) ?? []}
    {#if items.length > 0}
      {@const CatIcon = categoryIcon(cat)}
      <section>
        <div class="mb-3 flex items-baseline gap-2">
          <CatIcon class="h-4 w-4 text-grc-primary" />
          <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-600">{cat}</h2>
          <span class="text-xs text-slate-400">· {items.length} connector{items.length === 1 ? '' : 's'}</span>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {#each items as c (c.id)}
            {@const Icon = connectorIcon(c.kind)}
            {@const chip = statusChip(c.status)}
            <div class="card card-hover p-4">
              <div class="flex items-start gap-3">
                <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Icon class="h-5 w-5" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <h3 class="truncate text-sm font-semibold text-slate-800">{c.name}</h3>
                    <div class="relative flex-shrink-0">
                      <button
                        class="btn-ghost p-1"
                        title="More"
                        on:click|stopPropagation={() => (openMenu = openMenu === c.id ? null : c.id)}
                      >
                        <MoreHorizontal class="h-4 w-4" />
                      </button>
                      {#if openMenu === c.id}
                        <div class="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
                          <button class="block w-full px-3 py-1.5 text-left hover:bg-slate-50" on:click={() => syncOne(c)}>Sync now</button>
                          <button class="block w-full px-3 py-1.5 text-left hover:bg-slate-50" on:click={() => reconnect(c)}>Reconnect</button>
                        </div>
                      {/if}
                    </div>
                  </div>
                  <div class="mt-1 flex items-center gap-2">
                    <StatusDot status={c.status} withLabel={false} />
                    <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset {chip.cls}">
                      <chip.icon class="h-3 w-3" />
                      {chip.label}
                    </span>
                  </div>
                </div>
              </div>
              <div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                <span>Last sync <span class="font-medium text-slate-700">{fmtRelTs(c.lastSyncAt)}</span></span>
                <span class="font-mono">{(c.recordsIngested24h ?? 0).toLocaleString()} rec/24h</span>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/each}
</div>
