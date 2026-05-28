<script lang="ts">
  export let nodes: { id: string; name: string; column: 0 | 1 | 2 }[] = [];
  export let links: { source: string; target: string; value: number; color?: string }[] = [];
  export let width: number = 760;
  export let height: number = 420;
  export let nodeWidth: number = 14;
  export let nodePadding: number = 6;

  const padL = 8;
  const padR = 8;
  const padT = 8;
  const padB = 8;

  $: chartW = width - padL - padR;
  $: chartH = height - padT - padB;

  // group nodes by column
  $: columns = [0, 1, 2].map((c) => nodes.filter((n) => n.column === c));

  // compute incoming/outgoing totals per node
  function nodeValue(id: string): number {
    const out = links.filter((l) => l.source === id).reduce((s, l) => s + l.value, 0);
    const inn = links.filter((l) => l.target === id).reduce((s, l) => s + l.value, 0);
    return Math.max(out, inn);
  }

  // layout: for each column, compute total value and y-offsets
  $: layout = (() => {
    const xStep = columns.length > 1 ? chartW / (columns.length - 1) : 0;
    const positions = new Map<string, { x: number; y: number; h: number; col: number; value: number }>();

    columns.forEach((colNodes, ci) => {
      const values = colNodes.map((n) => nodeValue(n.id));
      const total = values.reduce((s, v) => s + v, 0) || 1;
      const availH = chartH - nodePadding * Math.max(colNodes.length - 1, 0);
      const scale = availH / total;
      let y = padT;
      const x = ci === 0 ? padL : ci === columns.length - 1 ? padL + chartW - nodeWidth : padL + ci * xStep - nodeWidth / 2;
      colNodes.forEach((n, i) => {
        const h = Math.max(2, values[i] * scale);
        positions.set(n.id, { x, y, h, col: ci, value: values[i] });
        y += h + nodePadding;
      });
    });

    return positions;
  })();

  // compute per-node "cursor" for stacking link endpoints in order encountered
  $: linkPaths = (() => {
    const srcCursor = new Map<string, number>();
    const tgtCursor = new Map<string, number>();
    nodes.forEach((n) => { srcCursor.set(n.id, 0); tgtCursor.set(n.id, 0); });

    return links.map((l) => {
      const sn = layout.get(l.source);
      const tn = layout.get(l.target);
      if (!sn || !tn) return null;

      const snVal = nodeValue(l.source) || 1;
      const tnVal = nodeValue(l.target) || 1;
      const srcH = (l.value / snVal) * sn.h;
      const tgtH = (l.value / tnVal) * tn.h;

      const sy = sn.y + (srcCursor.get(l.source) ?? 0) + srcH / 2;
      const ty = tn.y + (tgtCursor.get(l.target) ?? 0) + tgtH / 2;
      srcCursor.set(l.source, (srcCursor.get(l.source) ?? 0) + srcH);
      tgtCursor.set(l.target, (tgtCursor.get(l.target) ?? 0) + tgtH);

      const x0 = sn.x + nodeWidth;
      const x1 = tn.x;
      const mx = (x0 + x1) / 2;
      const d = `M ${x0.toFixed(1)} ${sy.toFixed(1)} C ${mx.toFixed(1)} ${sy.toFixed(1)}, ${mx.toFixed(1)} ${ty.toFixed(1)}, ${x1.toFixed(1)} ${ty.toFixed(1)}`;
      const w = Math.max(1, Math.min(srcH, tgtH));
      return { d, w, color: l.color ?? '#10b981', value: l.value, src: l.source, tgt: l.target };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  })();

  function nodeColor(col: number): string {
    return col === 0 ? '#0f766e' : col === 1 ? '#10b981' : '#a855f7';
  }
</script>

<svg viewBox="0 0 {width} {height}" class="w-full" role="img" aria-label="Sankey diagram">
  <!-- links -->
  {#each linkPaths as lp}
    <path
      d={lp.d}
      fill="none"
      stroke={lp.color}
      stroke-width={lp.w}
      stroke-opacity="0.35"
      stroke-linecap="butt"
    >
      <title>{lp.src} → {lp.tgt}: {lp.value}</title>
    </path>
  {/each}

  <!-- nodes -->
  {#each nodes as n}
    {@const pos = layout.get(n.id)}
    {#if pos}
      <rect
        x={pos.x}
        y={pos.y}
        width={nodeWidth}
        height={pos.h}
        fill={nodeColor(pos.col)}
        rx="2"
      >
        <title>{n.name}: {pos.value}</title>
      </rect>
      <text
        x={pos.col === 2 ? pos.x - 4 : pos.x + nodeWidth + 4}
        y={pos.y + pos.h / 2 + 3}
        text-anchor={pos.col === 2 ? 'end' : 'start'}
        font-size="10"
        fill="#334155"
      >{n.name}</text>
    {/if}
  {/each}
</svg>
