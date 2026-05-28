// src/routes/forgot/+page.server.ts
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  return { email: url.searchParams.get('email') ?? '' };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '').trim();
    // Demo stub: always return success, never reveal whether the address exists.
    return { success: true, email };
  }
};
