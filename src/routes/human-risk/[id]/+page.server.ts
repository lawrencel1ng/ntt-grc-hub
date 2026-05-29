// =====================================================================
//  /human-risk/[id] — Per-user risk profile (KnowBe4 Virtual Risk Officer).
//  Risk score drivers, 12-month trend, phishing history, training status
//  and the role-based boosters that move the score.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  getHumanRiskUser, getHumanRiskUsers, getHumanRiskSummary
} from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const user = await getHumanRiskUser(params.id);
  if (!user) throw error(404, 'User risk profile not found');

  const [summary, peers] = await Promise.all([
    getHumanRiskSummary(user.tenantId),
    getHumanRiskUsers(user.tenantId)
  ]);

  // Department peers for the comparison context (exclude the user).
  const deptPeers = peers.filter((u) => u.department === user.department && u.id !== user.id);
  const deptAvg = deptPeers.length
    ? Math.round(deptPeers.reduce((s, u) => s + u.riskScore, 0) / deptPeers.length)
    : user.riskScore;
  const rank = peers.findIndex((u) => u.id === user.id) + 1;

  return { user, summary, deptAvg, rank, sampleSize: peers.length };
};
