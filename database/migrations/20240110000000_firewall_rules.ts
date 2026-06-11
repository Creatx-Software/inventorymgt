// @ts-nocheck
const FIREWALL_PERMISSIONS = [
  'firewalls_view',
  'firewalls_create',
  'firewalls_edit',
  'firewalls_delete',
];

exports.up = async (knex) => {
  await knex.schema.createTable('firewall_rules', (t) => {
    t.increments('id').primary();
    t.string('application_name', 255).notNullable();

    t.json('sources').nullable();
    t.json('source_nats').nullable();
    t.json('destinations').nullable();
    t.json('destination_nats').nullable();

    t.string('ports', 255).nullable();
    t.enum('protocol', ['TCP', 'UDP', 'TCP/UDP']).notNullable().defaultTo('TCP');
    t.enum('direction', ['Bi-Directional', 'Uni-Directional']).notNullable().defaultTo('Uni-Directional');
    t.enum('rule_type', ['Temp', 'Permanent']).notNullable().defaultTo('Permanent');

    t.date('expire_date').nullable();
    t.string('days_window', 100).nullable();
    t.string('time_window', 100).nullable();

    t.string('sn_call_number', 100).nullable();
    t.integer('engineer_requested_employee_id').unsigned().nullable()
      .references('id').inTable('employees');
    t.date('request_date').nullable();
    t.text('description').nullable();

    t.timestamp('deleted_at').nullable();
    t.timestamps(true, true);

    t.index('application_name');
    t.index('expire_date');
    t.index('rule_type');
  });

  const roles = await knex('roles')
    .whereIn('name', ['superadmin', 'admin', 'user'])
    .select('id', 'name');

  for (const role of roles) {
    const perms = role.name === 'user'
      ? ['firewalls_view']
      : FIREWALL_PERMISSIONS;
    for (const permission of perms) {
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
  await knex('role_permissions').whereIn('permission', FIREWALL_PERMISSIONS).delete();
  await knex.schema.dropTableIfExists('firewall_rules');
};
