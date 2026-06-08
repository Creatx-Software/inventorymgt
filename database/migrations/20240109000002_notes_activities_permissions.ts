// @ts-nocheck
const NOTES_PERMISSIONS      = ['notes_view', 'notes_create', 'notes_delete'];
const ACTIVITIES_PERMISSIONS = ['activities_view', 'activities_create', 'activities_edit', 'activities_delete'];
const ALL_NEW_PERMISSIONS    = [...NOTES_PERMISSIONS, ...ACTIVITIES_PERMISSIONS];

exports.up = async (knex) => {
  const roles = await knex('roles')
    .whereIn('name', ['superadmin', 'admin', 'user'])
    .select('id', 'name');

  for (const role of roles) {
    const permsToInsert = role.name === 'user'
      ? ['notes_view', 'activities_view']
      : ALL_NEW_PERMISSIONS;

    for (const permission of permsToInsert) {
      const exists = await knex('role_permissions')
        .where({ role_id: role.id, permission })
        .first();
      if (!exists) {
        await knex('role_permissions').insert({ role_id: role.id, permission });
      }
    }
  }
};

exports.down = async (knex) => {
  await knex('role_permissions')
    .whereIn('permission', ALL_NEW_PERMISSIONS)
    .delete();
};
