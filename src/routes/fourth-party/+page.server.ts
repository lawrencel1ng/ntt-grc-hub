// =====================================================================
//  /fourth-party — Concentration map. Builds a Sankey across
//  Vendor → 4th-party → Cloud/Region capped to ~60 nodes so the
//  hero supply-chain story stays legible. Maybank fallback in MSSP mode.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getVendors, getFourthParties, getConcentrations } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import type { Vendor, FourthParty } from '$lib/data/types';

const TOTAL_NODE_BUDGET = 60;
const CRIT_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

interface SankeyNode { id: string; name: string; column: 0 | 1 | 2; }
interface SankeyLink { source: string; target: string; value: number; color?: string; }

function destinationKey(fp: FourthParty): string {
  // Bucket 4th parties by region (cloud providers get cloud_<region>).
  return fp.type === 'cloud' ? `cloud-${fp.region}` : `region-${fp.region}`;
}
function destinationName(fp: FourthParty): string {
  return fp.type === 'cloud' ? `Cloud · ${fp.region}` : `Region · ${fp.region}`;
}

function buildSankey(vendors: Vendor[], fourthParties: FourthParty[]) {
  // Score every 4th-party association by criticality + tier so we can
  // pick the most material slice when budget caps node count.
  type Triple = { vendor: Vendor; fp: FourthParty; destKey: string; destName: string; weight: number };
  const triples: Triple[] = [];
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  for (const fp of fourthParties) {
    const v = vendorById.get(fp.vendorId);
    if (!v) continue;
    const vTier = 6 - Number(v.tier); // Tier 1 → 5
    const fpCrit = CRIT_RANK[fp.criticality] ?? 1;
    triples.push({ vendor: v, fp, destKey: destinationKey(fp), destName: destinationName(fp), weight: vTier * fpCrit });
  }
  triples.sort((a, b) => b.weight - a.weight);

  // Greedy fill node budget while preserving connectivity.
  const vendorIds = new Set<string>();
  const fpIds = new Set<string>();
  const destKeys = new Set<string>();
  const picked: Triple[] = [];
  for (const t of triples) {
    const projected = vendorIds.size + fpIds.size + destKeys.size
      + (vendorIds.has(t.vendor.id) ? 0 : 1)
      + (fpIds.has(t.fp.id) ? 0 : 1)
      + (destKeys.has(t.destKey) ? 0 : 1);
    if (projected > TOTAL_NODE_BUDGET) continue;
    vendorIds.add(t.vendor.id);
    fpIds.add(t.fp.id);
    destKeys.add(t.destKey);
    picked.push(t);
  }

  // Aggregate concentrations per destination to choose link colours.
  const destVendorCount = new Map<string, Set<string>>();
  for (const t of picked) {
    if (!destVendorCount.has(t.destKey)) destVendorCount.set(t.destKey, new Set());
    destVendorCount.get(t.destKey)!.add(t.vendor.id);
  }
  const totalVendorsInPick = vendorIds.size || 1;

  function linkColor(destKey: string): string {
    const share = (destVendorCount.get(destKey)?.size ?? 0) / totalVendorsInPick;
    if (share >= 0.4) return '#e11d48'; // rose
    if (share >= 0.2) return '#f59e0b'; // amber
    return '#8b5cf6';                   // violet
  }

  const nodes: SankeyNode[] = [];
  for (const id of vendorIds) {
    const v = vendorById.get(id)!;
    nodes.push({ id: `vendor-${id}`, name: v.name.split(' — ')[0], column: 0 });
  }
  for (const fpId of fpIds) {
    const t = picked.find((p) => p.fp.id === fpId)!;
    nodes.push({ id: `fp-${fpId}`, name: t.fp.name.split(' (')[0], column: 1 });
  }
  for (const dk of destKeys) {
    const t = picked.find((p) => p.destKey === dk)!;
    nodes.push({ id: `dest-${dk}`, name: t.destName, column: 2 });
  }

  // One link per triple — first leg vendor→fp, second leg fp→dest.
  const links: SankeyLink[] = [];
  for (const t of picked) {
    const color = linkColor(t.destKey);
    links.push({ source: `vendor-${t.vendor.id}`, target: `fp-${t.fp.id}`, value: 1, color });
    links.push({ source: `fp-${t.fp.id}`, target: `dest-${t.destKey}`, value: 1, color });
  }

  return { nodes, links };
}

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const effective = tenantId === ALL_TENANTS_ID ? 't_maybank' : tenantId;
  const [vendors, fourthParties, concentrations] = await Promise.all([
    getVendors(effective),
    getFourthParties(effective),
    getConcentrations(effective)
  ]);
  const sankey = buildSankey(vendors, fourthParties);

  return {
    vendors,
    fourthParties,
    concentrations,
    sankey,
    isAll: tenantId === ALL_TENANTS_ID,
    effectiveTenantId: effective
  };
};
