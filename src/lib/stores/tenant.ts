import { writable } from 'svelte/store';

export interface TenantSummary {
  id: string;
  name: string;
  industry: string;
  region: string;
  classified?: boolean;
  primaryFramework: string;
}

export const ALL_TENANTS_ID = '__all__';

export const currentTenantId = writable<string>(ALL_TENANTS_ID);
