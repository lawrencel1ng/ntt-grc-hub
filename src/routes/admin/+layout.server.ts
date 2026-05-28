import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { can } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) throw error(401, 'Not authenticated');
  if (!can(user.role, 'admin-settings')) {
    throw error(403, 'You do not have permission to access admin pages.');
  }
  return { user };
};
