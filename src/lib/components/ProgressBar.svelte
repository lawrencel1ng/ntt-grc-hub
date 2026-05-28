<script lang="ts">
  export let value: number = 0;
  export let max: number = 100;
  export let color: string = 'bg-grc-primary';
  export let showValue = false;
  $: pct = Math.min(100, Math.max(0, (value / max) * 100));
</script>

<div class="flex items-center gap-2">
  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
    <div class="h-full {color} transition-all" style="width:{pct}%"></div>
  </div>
  {#if showValue}
    <span class="font-mono text-xs text-slate-500">{Math.round(pct)}%</span>
  {/if}
</div>
