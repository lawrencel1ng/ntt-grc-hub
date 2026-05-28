<script lang="ts">
  import { TrendingUp, TrendingDown, Minus } from 'lucide-svelte';
  export let label: string;
  export let value: string;
  export let delta: number | null = null;
  export let suffix: string = '';
  export let hint: string = '';
  export let tone: 'default' | 'good' | 'bad' = 'default';

  $: trendColor = delta === null
    ? 'text-slate-400'
    : delta > 0
      ? tone === 'bad' ? 'text-rose-600' : 'text-emerald-600'
      : delta < 0
        ? tone === 'bad' ? 'text-emerald-600' : 'text-rose-600'
        : 'text-slate-400';
</script>

<div class="card card-hover p-4">
  <div class="flex items-center justify-between">
    <div class="section-title">{label}</div>
    <slot name="icon" />
  </div>
  <div class="mt-2 flex items-baseline gap-1">
    <div class="kpi-num">{value}</div>
    {#if suffix}<span class="text-sm text-slate-500">{suffix}</span>{/if}
  </div>
  {#if delta !== null}
    <div class="mt-1.5 flex items-center gap-1 text-xs {trendColor}">
      {#if delta > 0}
        <TrendingUp class="h-3 w-3" />
      {:else if delta < 0}
        <TrendingDown class="h-3 w-3" />
      {:else}
        <Minus class="h-3 w-3" />
      {/if}
      <span class="font-medium">{delta > 0 ? '+' : ''}{delta}%</span>
      {#if hint}<span class="text-slate-400">· {hint}</span>{/if}
    </div>
  {:else if hint}
    <div class="mt-1.5 text-xs text-slate-400">{hint}</div>
  {/if}
</div>
