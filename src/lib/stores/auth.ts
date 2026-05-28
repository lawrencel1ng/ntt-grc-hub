import { writable } from 'svelte/store';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'risk-owner' | 'control-owner' | 'auditor' | 'agent-operator' | 'viewer';
}

export const user = writable<AppUser | null>(null);
