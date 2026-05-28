<script lang="ts">
  export let items: { label: string; value: number; color: string }[] = [];
  export let size: number = 160;
  export let thickness: number = 22;
  export let centerLabel: string = '';
  export let centerValue: string = '';

  $: total = items.reduce((s, i) => s + i.value, 0) || 1;
  $: radius = (size - thickness) / 2;
  $: circumference = 2 * Math.PI * radius;

  function arcs(its: { label: string; value: number; color: string }[], circ: number, tot: number) {
    let offset = 0;
    return its.map((it) => {
      const portion = it.value / tot;
      const dash = portion * circ;
      const seg = { color: it.color, dash, gap: circ - dash, offset };
      offset -= dash;
      return seg;
    });
  }
  $: segments = arcs(items, circumference, total);
</script>

<div class="flex items-center gap-5">
  <svg width={size} height={size} viewBox="0 0 {size} {size}" class="-rotate-90">
    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" stroke-width={thickness} />
    {#each segments as seg}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={seg.color}
        stroke-width={thickness}
        stroke-dasharray="{seg.dash} {seg.gap}"
        stroke-dashoffset={seg.offset}
        stroke-linecap="butt"
      />
    {/each}
    {#if centerValue}
      <text x="50%" y="48%" text-anchor="middle" transform="rotate(90 {size/2} {size/2})" font-size="22" font-weight="700" fill="#0f172a">{centerValue}</text>
      <text x="50%" y="62%" text-anchor="middle" transform="rotate(90 {size/2} {size/2})" font-size="10" fill="#64748b">{centerLabel}</text>
    {/if}
  </svg>
  <div class="flex-1 space-y-1.5">
    {#each items as it}
      <div class="flex items-center justify-between gap-3 text-xs">
        <div class="flex min-w-0 items-center gap-2">
          <span class="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style="background:{it.color}"></span>
          <span class="truncate text-slate-700">{it.label}</span>
        </div>
        <span class="font-mono font-medium text-slate-600">{Math.round((it.value / total) * 100)}%</span>
      </div>
    {/each}
  </div>
</div>
