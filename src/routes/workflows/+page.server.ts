// =====================================================================
//  /workflows — Workflow list. The mock backend scopes workflows to the
//  hero tenants; in MSSP-rollup mode we union the t_maybank + t_grab +
//  t_mindef workflows so the page never reads as empty.
// =====================================================================

import type { PageServerLoad } from './$types';
import { getWorkflows, getWorkflowExecutions } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';
import type { Workflow, WorkflowExecution } from '$lib/data/types';

const ROLLUP_TENANTS = ['t_maybank', 't_grab', 't_mindef', 't_singhealth'];

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const isAll = tenantId === ALL_TENANTS_ID;
  const tenants = isAll ? ROLLUP_TENANTS : [tenantId];

  const workflows: Workflow[] = [];
  const executions: WorkflowExecution[] = [];
  for (const tid of tenants) {
    workflows.push(...(await getWorkflows(tid)));
    executions.push(...(await getWorkflowExecutions(tid, 40)));
  }
  return { workflows, executions, isAll };
};
