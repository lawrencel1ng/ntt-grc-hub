<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { commandPaletteOpen, closeCommandPalette, toggleCommandPalette } from '$lib/stores/commandPalette';
  import { navSections } from './NavConfig';
  import { Search } from 'lucide-svelte';

  interface PaletteItem {
    label: string;
    href: string;
    section: string;
    icon: typeof navSections[number]['items'][number]['icon'];
  }

  const items: PaletteItem[] = navSections.flatMap((sec) =>
    sec.items.map((it) => ({ label: it.label, href: it.href, section: sec.title, icon: it.icon }))
  );

  let query = '';
  let activeIdx = 0;

  $: filtered = query
    ? items.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()) || p.section.toLowerCase().includes(query.toLowerCase()))
    : items;

  $: if (filtered.length) {
    activeIdx = Math.min(activeIdx, filtered.length - 1);
  }

  function close() {
    closeCommandPalette();
    query = '';
    activeIdx = 0;
  }

  function navigate(href: string) {
    goto(href);
    close();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length) activeIdx = (activeIdx + 1) % filtered.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length) activeIdx = (activeIdx - 1 + filtered.length) % filtered.length;
    } else if (e.key === 'Enter') {
      if (filtered[activeIdx]) navigate(filtered[activeIdx].href);
    }
  }

  function onQueryChange() {
    activeIdx = 0;
  }

  function globalKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleCommandPalette();
      query = '';
      activeIdx = 0;
    }
  }
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
          placeholder="Go to page…"
          class="flex-1 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
          bind:value={query}
          on:input={onQueryChange}
          on:keydown={onKeydown}
          autofocus
        />
        <kbd class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-400">esc</kbd>
      </div>

      <ul class="max-h-80 overflow-y-auto py-1">
        {#if filtered.length === 0}
          <li class="px-4 py-8 text-center text-sm text-slate-400">No pages match "{query}"</li>
        {:else}
          {#each filtered as page, i}
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors
                  {i === activeIdx ? 'bg-grc-primary text-white' : 'text-slate-700 hover:bg-slate-50'}"
                on:click={() => navigate(page.href)}
                on:mouseenter={() => (activeIdx = i)}
              >
                <span class="{i === activeIdx ? 'text-white' : 'text-slate-400'}">
                  <svelte:component this={page.icon} class="h-4 w-4" />
                </span>
                <span class="text-sm font-medium">{page.label}</span>
                <span class="ml-auto truncate font-mono text-xs {i === activeIdx ? 'text-white/70' : 'text-slate-400'}">{page.section}</span>
              </button>
            </li>
          {/each}
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
