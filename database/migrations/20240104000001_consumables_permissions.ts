import type { Knex } from 'knex';

const CONSUMABLE_PERMISSIONS = [
  'consumables_view',
  'consumables_create',
  'consumables_edit',
  'consumables_delete',
];

export async function up(knex: Knex): Promise<void> {
  // Add consumables permissions to all system roles that already exist
  const roles = await knex('roles')
    .whereIn('name', ['superadmin', 'admin', 'user'])
    .select('id', 'name');

  for (const role of roles) {
    const permsToInsert = role.name === 'user'
      ? ['consumables_view']          // user → view only
      : CONSUMABLE_PERMISSIONS;       // superadmin + admin → full access

    for (const permission of permsToInsert) {
      // Use insertIgnore-style upsert to be idempotent
      const exists = await knex('role_permissions')
        .where({ role_id: role.id, permission })
        .first();
      if (!exists) {
        await knex('role_permissions').insert({ role_id: role.id, permission });
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex('role_permissions')
    .whereIn('permission', CONSUMABLE_PERMISSIONS)
    .delete();
}
