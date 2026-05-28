declare global {
  namespace App {
    interface Locals {
      user?: { id: string; email: string; name: string; role: string; tenantId: string };
      tenantId?: string;
    }
    interface PageData {}
    interface Error {}
    interface Platform {}
  }
}
export {};
