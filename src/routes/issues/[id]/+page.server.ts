// =====================================================================
//  /issues/[id] — Single issue detail with actions table, mini-timeline,
//  and related-item links (audit / risk / control).
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getIssue, getIssueActions } from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const issue = await getIssue(params.id);
  if (!issue) throw error(404, 'Issue not found');
  const actions = await getIssueActions(issue.id);
  return { issue, actions };
};
