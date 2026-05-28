import type { Role } from '$lib/data/types';

declare global {
  namespace App {
    interface Locals {
      user?: {
        id: string;
        email: string;
        name: string;
        role: Role;
        tenantId: string;
      };
      tenantId?: string;
    }
    interface PageData {}
    interface Error {}
    interface Platform {}
  }
}

export {};
