<script lang="ts">
  import { page } from '$app/stores';
  import { navSections } from './NavConfig';
  import Logo from './Logo.svelte';
  import { sidebarOpen } from '$lib/stores/sidebar';
  import { ChevronLeft } from 'lucide-svelte';

  $: pathname = $page.url.pathname;
  function isActive(href: string, current: string) {
    if (href === '/') return current === '/';
    return current === href || current.startsWith(href + '/');
  }
</script>

<aside class="flex h-full flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white transition-all duration-200 {$sidebarOpen ? 'w-64' : 'w-16'}">
  <div class="flex h-16 items-center justify-between border-b border-white/10 px-4">
    {#if $sidebarOpen}
      <Logo variant="light" />
    {:else}
      <Logo variant="light" compact />
    {/if}
    <button class="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
            on:click={() => sidebarOpen.update((v) => !v)} aria-label="Toggle sidebar">
      <ChevronLeft class="h-4 w-4 transition-transform {!$sidebarOpen ? 'rotate-180' : ''}" />
    </button>
  </div>
  <nav class="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-2 py-4">
    {#each navSections as section}
      <div>
        {#if $sidebarOpen}
          <div class="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">{section.title}</div>
        {/if}
        <ul class="space-y-0.5">
          {#each section.items as item}
            {@const active = isActive(item.href, pathname)}
            <li>
              <a href={item.href}
                 class="group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all {active
                   ? 'bg-gradient-to-r from-violet-500/15 to-violet-500/5 font-semibold text-white shadow-sm ring-1 ring-inset ring-violet-400/30'
                   : 'font-medium text-white/65 hover:bg-white/10 hover:text-white'}"
                 title={!$sidebarOpen ? item.label : undefined}>
                {#if active}
                  <span class="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-grc-accent shadow-[0_0_8px_rgba(167,139,250,0.6)]" aria-hidden="true"></span>
                {/if}
                <svelte:component this={item.icon} class="h-4 w-4 flex-shrink-0 {active ? 'text-grc-accent' : 'text-white/60 group-hover:text-white/90'}" />
                {#if $sidebarOpen}
                  <span class="flex-1 truncate">{item.label}</span>
                  {#if item.badge}
                    <span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold {active ? 'bg-grc-accent text-slate-900' : 'bg-grc-accent/20 text-grc-accent'}">{item.badge}</span>
                  {/if}
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>
  <div class="border-t border-white/10 px-3 py-3 text-[11px] text-white/40">
    {#if $sidebarOpen}
      <div class="flex items-center justify-between">
        <span>v1.0.0-demo</span>
        <span class="rounded bg-violet-500/15 px-1.5 py-0.5 font-semibold text-violet-300">LIVE</span>
      </div>
      <div class="mt-1 text-white/30">© 2026 NTT Singapore. Demo build.</div>
    {:else}
      <span class="block text-center">v1</span>
    {/if}
  </div>
</aside>
