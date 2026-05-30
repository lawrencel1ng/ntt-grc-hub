import type { PageServerLoad } from './$types';
import { getWorkflows, getWorkflowExecutions } from '$lib/server/data';
import { ALL_TENANTS_ID } from '$lib/stores/tenant';

export const load: PageServerLoad = async ({ locals }) => {
  const tenantId = locals.tenantId ?? ALL_TENANTS_ID;
  const isAll = tenantId === ALL_TENANTS_ID;
  const effective = isAll ? undefined : tenantId;
  const [workflows, executions] = await Promise.all([
    getWorkflows(effective),
    getWorkflowExecutions(effective, 40)
  ]);
  return { workflows, executions, isAll };
};
