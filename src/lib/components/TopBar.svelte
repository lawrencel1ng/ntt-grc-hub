<script lang="ts">
  import TenantSwitcher from './TenantSwitcher.svelte';
  import type { TenantSummary } from '$lib/stores/tenant';
  import { Search, Bot, Bell, Settings } from 'lucide-svelte';
  export let tenants: TenantSummary[] = [];
  export let liveAgents = 0;
</script>

<header class="flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-6">
  <TenantSwitcher {tenants} />
  <div class="relative ml-2 flex-1 max-w-xl">
    <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input class="input pl-9" placeholder="Search risks, controls, evidence, agents…  (⌘K)" />
  </div>
  <div class="flex items-center gap-3">
    <div class="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
      <span class="h-1.5 w-1.5 rounded-full bg-violet-500"></span>
      <Bot class="h-3.5 w-3.5 text-slate-500" />
      <span>{liveAgents} agents live</span>
    </div>
    <button class="btn-ghost p-2"><Bell class="h-4 w-4" /></button>
    <button class="btn-ghost p-2"><Settings class="h-4 w-4" /></button>
    <div class="ml-1 flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm">
      <div class="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-center font-mono text-xs leading-6 text-white">LK</div>
      <span class="hidden text-slate-700 sm:inline">Lawrence Khoo</span>
    </div>
    <form method="POST" action="/logout">
      <button type="submit" class="text-xs text-slate-500 hover:text-slate-900 transition-colors">Log out</button>
    </form>
  </div>
</header>
