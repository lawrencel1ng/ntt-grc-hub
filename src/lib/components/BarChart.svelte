<script lang="ts">
  export let labels: string[] = [];
  export let series: { name: string; color: string; data: number[] }[] = [];
  export let height: number = 240;
  export let stacked: boolean = true;
  export let unit: string = '';

  $: totalsPerLabel = labels.map((_, i) =>
    series.reduce((s, srs) => s + (srs.data[i] ?? 0), 0)
  );
  $: maxVal = stacked
    ? Math.max(...totalsPerLabel, 1)
    : Math.max(...series.flatMap((s) => s.data), 1);
</script>

<div class="w-full">
  <div class="mb-3 flex flex-wrap items-center gap-3 text-xs">
    {#each series as s}
      <div class="flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-sm" style="background:{s.color}"></span>
        <span class="text-slate-600">{s.name}</span>
      </div>
    {/each}
  </div>
  <div class="flex items-end gap-2" style="height:{height}px">
    {#each labels as label, i}
      <div class="flex flex-1 flex-col items-stretch gap-0.5">
        <div class="relative flex flex-1 items-end justify-center" style="height:{height - 20}px">
          {#if stacked}
            <div class="flex w-full max-w-[36px] flex-col-reverse overflow-hidden rounded-sm" style="height:{(totalsPerLabel[i] / maxVal) * (height - 20)}px">
              {#each series as s}
                <div title="{s.name}: {s.data[i]}{unit}" style="background:{s.color}; height:{((s.data[i] ?? 0) / (totalsPerLabel[i] || 1)) * 100}%"></div>
              {/each}
            </div>
          {:else}
            <div class="flex w-full max-w-[36px] items-end gap-0.5">
              {#each series as s}
                <div class="flex-1 rounded-sm" title="{s.name}: {s.data[i]}{unit}" style="background:{s.color}; height:{((s.data[i] ?? 0) / maxVal) * (height - 20)}px"></div>
              {/each}
            </div>
          {/if}
        </div>
        <div class="text-center text-[10px] text-slate-500">{label}</div>
      </div>
    {/each}
  </div>
</div>
