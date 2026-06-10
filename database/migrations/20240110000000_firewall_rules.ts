import type { Knex } from 'knex';

const FIREWALL_PERMISSIONS = [
  'firewalls_view',
  'firewalls_create',
  'firewalls_edit',
  'firewalls_delete',
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('firewall_rules', (t: Knex.CreateTableBuilder) => {
    t.increments('id').primary();
    t.string('application_name', 255).notNullable();

    // IP sets stored as JSON arrays of strings
    t.json('sources').nullable();           // array of source IPs
    t.json('source_nats').nullable();       // array of source NAT IPs (optional)
    t.json('destinations').nullable();      // array of destination IPs
    t.json('destination_nats').nullable();  // array of destination NAT IPs (optional)

    t.string('ports', 255).nullable();      // comma-separated, e.g. "443" or "8091,8092,8093"
    t.enum('protocol', ['TCP', 'UDP', 'TCP/UDP']).notNullable().defaultTo('TCP');
    t.enum('direction', ['Bi-Directional', 'Uni-Directional']).notNullable().defaultTo('Uni-Directional');
    t.enum('rule_type', ['Temp', 'Permanent']).notNullable().defaultTo('Permanent');

    t.date('expire_date').nullable();       // only for Temp rules
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

  // Grant permissions to system roles
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
}

export async function down(knex: Knex): Promise<void> {
  await knex('role_permissions').whereIn('permission', FIREWALL_PERMISSIONS).delete();
  await knex.schema.dropTableIfExists('firewall_rules');
}
