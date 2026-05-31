<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { commandPaletteOpen, closeCommandPalette, toggleCommandPalette } from '$lib/stores/commandPalette';
  import { navSections } from './NavConfig';
  import { Search, ShieldAlert, Shield, ScrollText, Building2, AlertTriangle } from 'lucide-svelte';
  import type { SearchResult } from '../../routes/api/search/+server';

  interface NavItem {
    label: string;
    href: string;
    section: string;
    icon: typeof navSections[number]['items'][number]['icon'];
  }

  type AnyItem = { _type: 'nav'; item: NavItem } | { _type: 'result'; item: SearchResult };

  const navItems: NavItem[] = navSections.flatMap((sec) =>
    sec.items.map((it) => ({ label: it.label, href: it.href, section: sec.title, icon: it.icon }))
  );

  let query = '';
  let activeIdx = 0;
  let searchResults: SearchResult[] = [];
  let searching = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  $: filteredNav = query
    ? navItems.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()) || p.section.toLowerCase().includes(query.toLowerCase()))
    : navItems;

  $: allItems = [
    ...searchResults.map((r): AnyItem => ({ _type: 'result', item: r })),
    ...filteredNav.map((n): AnyItem => ({ _type: 'nav', item: n }))
  ];

  $: if (allItems.length) {
    activeIdx = Math.min(activeIdx, allItems.length - 1);
  }

  async function doSearch(q: string) {
    if (q.length < 2) { searchResults = []; return; }
    searching = true;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const body = await res.json() as { results: SearchResult[] };
        searchResults = body.results;
      }
    } catch { /* network error — show nav only */ }
    searching = false;
  }

  function onQueryChange() {
    activeIdx = 0;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doSearch(query), 200);
  }

  function close() {
    closeCommandPalette();
    query = '';
    activeIdx = 0;
    searchResults = [];
    if (debounceTimer) clearTimeout(debounceTimer);
  }

  function navigate(href: string) {
    goto(href);
    close();
  }

  function itemHref(it: AnyItem): string {
    return it._type === 'nav' ? it.item.href : it.item.href;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (allItems.length) activeIdx = (activeIdx + 1) % allItems.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (allItems.length) activeIdx = (activeIdx - 1 + allItems.length) % allItems.length;
    } else if (e.key === 'Enter') {
      if (allItems[activeIdx]) navigate(itemHref(allItems[activeIdx]));
    }
  }

  function globalKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleCommandPalette();
      query = '';
      activeIdx = 0;
      searchResults = [];
    }
  }

  const KIND_ICONS: Record<string, typeof ShieldAlert> = {
    risk: ShieldAlert,
    control: Shield,
    policy: ScrollText,
    vendor: Building2,
    issue: AlertTriangle
  };

  const KIND_LABELS: Record<string, string> = {
    risk: 'Risk',
    control: 'Control',
    policy: 'Policy',
    vendor: 'Vendor',
    issue: 'Issue'
  };
</script>

<svelte:window on:keydown={globalKeydown} />

{#if $commandPaletteOpen}
  <div
    class="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm"
    transition:fade={{ duration: 150 }}
    on:click={close}
    on:keydown={(e) => e.key === 'Escape' && close()}
    role="button"
    tabindex="-1"
    aria-label="Close command palette"
  ></div>

  <div
    class="fixed left-1/2 top-[20%] z-[10001] w-full max-w-xl -translate-x-1/2 px-4"
    transition:scale={{ duration: 180, start: 0.96 }}
  >
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div class="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <Search class="h-5 w-5 flex-shrink-0 text-slate-400" />
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          placeholder="Search risks, controls, policies, vendors…"
          class="flex-1 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
          bind:value={query}
          on:input={onQueryChange}
          on:keydown={onKeydown}
          autofocus
        />
        {#if searching}
          <span class="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-grc-primary"></span>
        {:else}
          <kbd class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-400">esc</kbd>
        {/if}
      </div>

      <ul class="max-h-80 overflow-y-auto py-1">
        {#if searchResults.length > 0}
          <li class="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Records</li>
          {#each searchResults as result, i}
            {@const idx = i}
            {@const active = activeIdx === idx}
            {@const Icon = KIND_ICONS[result.kind]}
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors
                  {active ? 'bg-grc-primary text-white' : 'text-slate-700 hover:bg-slate-50'}"
                on:click={() => navigate(result.href)}
                on:mouseenter={() => (activeIdx = idx)}
              >
                <span class="{active ? 'text-white' : 'text-slate-400'}">
                  <Icon class="h-4 w-4" />
                </span>
                <span class="flex-1 truncate">
                  {#if result.code}
                    <span class="mr-1.5 font-mono text-xs {active ? 'text-white/70' : 'text-slate-500'}">{result.code}</span>
                  {/if}
                  <span class="text-sm font-medium">{result.title}</span>
                </span>
                <span class="ml-auto shrink-0 font-mono text-xs {active ? 'text-white/70' : 'text-slate-400'}">{KIND_LABELS[result.kind]}</span>
              </button>
            </li>
          {/each}
          {#if filteredNav.length > 0}
            <li class="mt-1 px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pages</li>
          {/if}
        {:else if query.length >= 2 && !searching}
          <li class="px-4 py-4 text-center text-sm text-slate-400">No results for "{query}"</li>
        {/if}

        {#each filteredNav as page, i}
          {@const idx = searchResults.length + i}
          {@const active = activeIdx === idx}
          <li>
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors
                {active ? 'bg-grc-primary text-white' : 'text-slate-700 hover:bg-slate-50'}"
              on:click={() => navigate(page.href)}
              on:mouseenter={() => (activeIdx = idx)}
            >
              <span class="{active ? 'text-white' : 'text-slate-400'}">
                <svelte:component this={page.icon} class="h-4 w-4" />
              </span>
              <span class="text-sm font-medium">{page.label}</span>
              <span class="ml-auto truncate font-mono text-xs {active ? 'text-white/70' : 'text-slate-400'}">{page.section}</span>
            </button>
          </li>
        {/each}

        {#if allItems.length === 0 && query.length < 2}
          <!-- empty state when no query -->
        {:else if allItems.length === 0}
          <li class="px-4 py-8 text-center text-sm text-slate-400">No results for "{query}"</li>
        {/if}
      </ul>

      <div class="flex items-center gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
        <span><kbd class="font-mono">↑↓</kbd> navigate</span>
        <span><kbd class="font-mono">↵</kbd> open</span>
        <span><kbd class="font-mono">esc</kbd> close</span>
        <span class="ml-auto"><kbd class="font-mono">⌘K</kbd> toggle</span>
      </div>
    </div>
  </div>
{/if}
