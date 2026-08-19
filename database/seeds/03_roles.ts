// @ts-nocheck

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
  'consumables',
  'notes',
  'activities',
  'firewalls',
];

const VIEW_ONLY_RESOURCES = new Set(['dashboard', 'audit_logs']);
// notes: no edit action
const NOTES_ACTIONS = ['view', 'create', 'delete'];
const ACTIONS = ['view', 'create', 'edit', 'delete'];

function buildPermissions(resources, includeAllActions) {
  const perms = [];
  for (const resource of resources) {
    if (VIEW_ONLY_RESOURCES.has(resource)) {
      perms.push(`${resource}_view`);
    } else if (resource === 'notes') {
      if (includeAllActions) {
        for (const action of NOTES_ACTIONS) perms.push(`${resource}_${action}`);
      } else {
        perms.push(`${resource}_view`);
      }
    } else if (includeAllActions) {
      for (const action of ACTIONS) perms.push(`${resource}_${action}`);
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

async function upsertRole(knex, name, description) {
  const existing = await knex('roles').where({ name }).first();
  if (existing) return existing.id;
  const [id] = await knex('roles').insert({ name, description, is_system: true });
  return id;
}

async function upsertPermissions(knex, roleId, permissions) {
  for (const permission of permissions) {
    const exists = await knex('role_permissions').where({ role_id: roleId, permission }).first();
    if (!exists) {
      await knex('role_permissions').insert({ role_id: roleId, permission });
    }
  }
}

export async function seed(knex) {
  const superadminId = await upsertRole(knex, 'superadmin', 'Full access to everything including role management');
  const adminId      = await upsertRole(knex, 'admin',      'Full access except role management');
  const userId       = await upsertRole(knex, 'user',       'View-only access across all resources');

  await upsertPermissions(knex, superadminId, SUPERADMIN_PERMISSIONS);
  await upsertPermissions(knex, adminId,      ADMIN_PERMISSIONS);
  await upsertPermissions(knex, userId,       USER_PERMISSIONS);

  // Assign superadmin role to first user if not yet assigned
  const firstUser = await knex('users').orderBy('id', 'asc').first();
  if (firstUser && !firstUser.role_id) {
    await knex('users').where({ id: firstUser.id }).update({ role_id: superadminId });
    console.log(`Assigned superadmin role to user: ${firstUser.username}`);
  }

  console.log('Roles seed complete (new permissions upserted).');
}
