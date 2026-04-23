import type { Knex } from 'knex';

const RESOURCES = [
  'dashboard',
  'endpoints',
  'monitors',
  'mobile_devices',
  'ip_phones',
  'servers',
  'printers',
  'network_devices',
  'other_assets',
  'incidents',
  'employees',
  'departments',
  'locations',
  'vendors',
  'audit_logs',
];

const VIEW_ONLY_RESOURCES = new Set(['dashboard', 'audit_logs']);
const ACTIONS = ['view', 'create', 'edit', 'delete'] as const;

function buildPermissions(resources: string[], includeAllActions: boolean): string[] {
  const perms: string[] = [];
  for (const resource of resources) {
    if (VIEW_ONLY_RESOURCES.has(resource)) {
      perms.push(`${resource}_view`);
    } else if (includeAllActions) {
      for (const action of ACTIONS) {
        perms.push(`${resource}_${action}`);
      }
    } else {
      perms.push(`${resource}_view`);
    }
  }
  return perms;
}

const SUPERADMIN_PERMISSIONS: string[] = [
  ...buildPermissions(RESOURCES, true),
  'users_manage',
  'roles_manage',
];

const ADMIN_PERMISSIONS: string[] = [
  ...buildPermissions(RESOURCES, true),
  'users_manage',
  // roles_manage is excluded for admin
];

const USER_PERMISSIONS: string[] = buildPermissions(RESOURCES, false);

export async function seed(knex: Knex): Promise<void> {
  // Check if roles already seeded
  const existingRoles = await knex('roles').select('id').limit(1);
  if (existingRoles.length > 0) {
    console.log('Roles already seeded, skipping.');
    return;
  }

  // Insert the three system roles
  const [superadminId] = await knex('roles').insert({
    name: 'superadmin',
    description: 'Full access to everything including role management',
    is_system: true,
  });

  const [adminId] = await knex('roles').insert({
    name: 'admin',
    description: 'Full access except role management',
    is_system: true,
  });

  const [userId] = await knex('roles').insert({
    name: 'user',
    description: 'View-only access across all resources',
    is_system: true,
  });

  // Seed permissions for superadmin
  const superadminPerms = SUPERADMIN_PERMISSIONS.map((permission) => ({
    role_id: superadminId,
    permission,
  }));
  await knex('role_permissions').insert(superadminPerms);

  // Seed permissions for admin
  const adminPerms = ADMIN_PERMISSIONS.map((permission) => ({
    role_id: adminId,
    permission,
  }));
  await knex('role_permissions').insert(adminPerms);

  // Seed permissions for user
  const userPerms = USER_PERMISSIONS.map((permission) => ({
    role_id: userId,
    permission,
  }));
  await knex('role_permissions').insert(userPerms);

  // Update the first (admin) user to superadmin role
  const firstUser = await knex('users').orderBy('id', 'asc').first();
  if (firstUser) {
    await knex('users').where({ id: firstUser.id }).update({ role_id: superadminId });
    console.log(`Assigned superadmin role to user: ${firstUser.username}`);
  }

  console.log('Seeded roles: superadmin, admin, user');
}
