<script lang="ts">
  export let value: number = 0; // 0-100
  export let width: string = 'w-28';

  $: pct = Math.max(0, Math.min(100, value));
  $: color = pct < 60 ? 'bg-rose-500' : pct < 80 ? 'bg-amber-500' : 'bg-emerald-500';
  $: textCls = pct < 60 ? 'text-rose-700' : pct < 80 ? 'text-amber-700' : 'text-emerald-700';
</script>

<div class="inline-flex items-center gap-2">
  <div class="{width} h-1.5 overflow-hidden rounded-full bg-slate-100">
    <div class="h-full {color} transition-all" style="width:{pct}%"></div>
  </div>
  <span class="font-mono text-xs font-medium {textCls}">{Math.round(pct)}%</span>
</div>
