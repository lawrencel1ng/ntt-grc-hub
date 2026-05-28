<script lang="ts">
  export let cells: { sev: number; lik: number; n: number }[] = [];
  export let onCellClick: ((sev: number, lik: number) => void) | null = null;
  export let width: number = 360;
  export let height: number = 320;

  const padL = 64;
  const padB = 44;
  const padT = 8;
  const padR = 8;

  // axis labels (1..5 → readable)
  const likLabels = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
  const sevLabels = ['Info', 'Low', 'Medium', 'High', 'Critical'];

  // 5×5 ramp; index by (sev-1)*5 + (lik-1)
  // violet (safe) → amber (caution) → rose (critical)
  const ramp = [
    ['#ede9fe', '#ede9fe', '#fef3c7', '#fde68a', '#fed7aa'],
    ['#ede9fe', '#fef3c7', '#fde68a', '#fed7aa', '#fdba74'],
    ['#fef3c7', '#fde68a', '#fed7aa', '#fdba74', '#fb923c'],
    ['#fde68a', '#fed7aa', '#fdba74', '#fb923c', '#f97316'],
    ['#fed7aa', '#fdba74', '#fb923c', '#f97316', '#e11d48']
  ];

  $: cellMap = new Map<string, number>(cells.map((c) => [`${c.sev}:${c.lik}`, c.n]));

  $: chartW = width - padL - padR;
  $: chartH = height - padT - padB;
  $: cellW = chartW / 5;
  $: cellH = chartH / 5;

  function cellColor(sev: number, lik: number): string {
    return ramp[sev - 1][lik - 1];
  }
  function cellCount(sev: number, lik: number): number {
    return cellMap.get(`${sev}:${lik}`) ?? 0;
  }
  function handleClick(sev: number, lik: number) {
    if (onCellClick) onCellClick(sev, lik);
  }
</script>

<svg viewBox="0 0 {width} {height}" class="w-full" role="img" aria-label="5x5 risk heatmap">
  <!-- Y axis (Severity, top=Critical) -->
  <text
    x="14"
    y={padT + chartH / 2}
    text-anchor="middle"
    font-size="10"
    font-weight="600"
    fill="#475569"
    transform="rotate(-90 14 {padT + chartH / 2})"
  >Severity</text>

  {#each sevLabels as label, idx}
    {@const sev = 5 - idx}
    <text
      x={padL - 6}
      y={padT + idx * cellH + cellH / 2 + 3}
      text-anchor="end"
      font-size="9"
      fill="#64748b"
    >{sevLabels[sev - 1]}</text>
  {/each}

  <!-- X axis (Likelihood, left=Rare → right=Almost Certain) -->
  <text
    x={padL + chartW / 2}
    y={height - 6}
    text-anchor="middle"
    font-size="10"
    font-weight="600"
    fill="#475569"
  >Likelihood</text>

  {#each likLabels as label, i}
    <text
      x={padL + i * cellW + cellW / 2}
      y={padT + chartH + 14}
      text-anchor="middle"
      font-size="9"
      fill="#64748b"
    >{label}</text>
  {/each}

  <!-- 5x5 cells (top-left = severity 5, likelihood 1) -->
  {#each Array(5) as _, row}
    {#each Array(5) as _, col}
      {@const sev = 5 - row}
      {@const lik = col + 1}
      {@const n = cellCount(sev, lik)}
      <g
        class="cursor-pointer"
        on:click={() => handleClick(sev, lik)}
        on:keydown={(e) => e.key === 'Enter' && handleClick(sev, lik)}
        role="button"
        tabindex="0"
        aria-label="Severity {sevLabels[sev - 1]}, likelihood {likLabels[lik - 1]}: {n}"
      >
        <rect
          x={padL + col * cellW + 1}
          y={padT + row * cellH + 1}
          width={cellW - 2}
          height={cellH - 2}
          rx="3"
          fill={cellColor(sev, lik)}
          stroke="#fff"
          stroke-width="1"
        />
        <text
          x={padL + col * cellW + cellW / 2}
          y={padT + row * cellH + cellH / 2 + 4}
          text-anchor="middle"
          font-size="13"
          font-weight="600"
          fill={n > 0 ? '#0f172a' : '#94a3b8'}
        >{n}</text>
      </g>
    {/each}
  {/each}
</svg>
