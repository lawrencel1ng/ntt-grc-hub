// =====================================================================
//  /workflows/[id] — Workflow detail with visual diagram. Tenant id is
//  encoded in the workflow id (wf_<tenant>_<n>), matching the dispatcher's
//  decoding convention.
// =====================================================================

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getWorkflow, getWorkflowExecutions } from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
  const workflow = await getWorkflow(params.id);
  if (!workflow) throw error(404, 'Workflow not found');

  const allExecs = await getWorkflowExecutions(workflow.tenantId, 100);
  const executions = allExecs.filter((x) => x.workflowId === workflow.id);
  return { workflow, executions };
};
