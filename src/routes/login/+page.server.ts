import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';

/**
 * Demo login: accepts any credentials and redirects to the cockpit.
 * Real OIDC/SAML wiring goes here in a production deploy.
 */
export const actions: Actions = {
  default: async () => {
    throw redirect(303, '/');
  }
};
