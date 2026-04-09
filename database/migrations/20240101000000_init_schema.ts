import type { Knex } from 'knex';

type T = Knex.CreateTableBuilder;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t: T) => {
    t.increments('id').primary();
    t.string('username', 100).notNullable().unique();
    t.string('email', 150).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.string('full_name', 150).notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('last_login_at').nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('departments', (t: T) => {
    t.increments('id').primary();
    t.string('name', 150).notNullable().unique();
    t.text('description').nullable();
    t.timestamp('deleted_at').nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('locations', (t: T) => {
    t.increments('id').primary();
    t.string('name', 150).notNullable().unique();
    t.enum('type', ['office', 'datacenter', 'other']).notNullable().defaultTo('office');
    t.string('country', 100).nullable();
    t.text('address').nullable();
    t.timestamp('deleted_at').nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('vendors', (t: T) => {
    t.increments('id').primary();
    t.string('name', 150).notNullable().unique();
    t.string('website', 255).nullable();
    t.string('support_contact', 255).nullable();
    t.timestamp('deleted_at').nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('asset_statuses', (t: T) => {
    t.increments('id').primary();
    t.string('name', 50).notNullable().unique();
    t.string('color', 20).notNullable().defaultTo('#6b7280');
  });

  await knex.schema.createTable('employees', (t: T) => {
    t.increments('id').primary();
    t.string('employee_code', 50).nullable().unique();
    t.string('full_name', 150).notNullable();
    t.string('email', 150).nullable();
    t.integer('department_id').unsigned().nullable().references('id').inTable('departments');
    t.integer('location_id').unsigned().nullable().references('id').inTable('locations');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.boolean('needs_review').notNullable().defaultTo(false);
    t.timestamp('deleted_at').nullable();
    t.timestamps(true, true);
    t.index('full_name');
  });

  await knex.schema.createTable('serial_registry', (t: T) => {
    t.increments('id').primary();
    t.string('serial_number', 255).notNullable().unique();
    t.enum('asset_type', [
      'endpoint', 'monitor', 'mobile_device', 'ip_phone',
      'server', 'printer', 'network_device', 'other_asset',
    ]).notNullable();
    t.integer('asset_id').unsigned().notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['asset_type', 'asset_id']);
  });

  const common = (t: T) => {
    t.increments('id').primary();
    t.string('serial_number', 255).notNullable().unique();
    t.string('asset_name', 255).nullable();
    t.integer('vendor_id').unsigned().nullable().references('id').inTable('vendors');
    t.string('model', 255).nullable();
    t.integer('location_id').unsigned().nullable().references('id').inTable('locations');
    t.integer('department_id').unsigned().nullable().references('id').inTable('departments');
    t.integer('employee_id').unsigned().nullable().references('id').inTable('employees');
    t.integer('status_id').unsigned().notNullable().references('id').inTable('asset_statuses');
    t.string('po_number', 100).nullable();
    t.string('invoice_number', 100).nullable();
    t.text('remarks').nullable();
    t.timestamp('deleted_at').nullable();
    t.timestamps(true, true);
  };

  await knex.schema.createTable('endpoints', (t: T) => {
    common(t);
    t.enum('endpoint_type', ['Laptop', 'Desktop', 'Scanner', 'Other']).notNullable().defaultTo('Laptop');
    t.string('host_name', 255).nullable();
    t.string('asset_code', 100).nullable();
    t.string('mac_address', 50).nullable();
    t.string('os_name_version', 255).nullable();
    t.string('ip_address', 50).nullable();
    t.boolean('is_under_warranty').notNullable().defaultTo(false);
    t.date('warranty_expiry_date').nullable();
    t.date('eol_date').nullable();
  });

  await knex.schema.createTable('monitors', (t: T) => {
    common(t);
    t.string('host_name', 255).nullable();
  });

  await knex.schema.createTable('mobile_devices', (t: T) => {
    common(t);
    t.string('eid', 100).nullable();
    t.string('mobile_number', 50).nullable();
    t.string('sim_number', 100).nullable();
    t.string('imei_number', 100).nullable();
    t.integer('production_year').nullable();
  });

  await knex.schema.createTable('ip_phones', (t: T) => {
    common(t);
  });

  await knex.schema.createTable('servers', (t: T) => {
    common(t);
    t.string('application_name', 255).nullable();
    t.string('can_id', 100).nullable();
    t.enum('application_tier', ['0', '1', '2', '3', '4']).nullable();
    t.enum('server_class', ['Physical', 'Virtual']).nullable();
    t.string('os_name_version', 255).nullable();
    t.enum('server_type', ['Web', 'App', 'DB', 'Other']).nullable();
    t.string('server_software', 255).nullable();
    t.string('managed_by', 100).nullable();
    t.string('ip_address', 50).nullable();
    t.string('host_name', 255).nullable();
    t.string('asset_code', 100).nullable();
    t.string('dc_location', 100).nullable();
    t.enum('environment', ['Prod', 'FB', 'DR']).nullable();
    t.boolean('is_under_warranty').notNullable().defaultTo(false);
    t.date('warranty_expiry_date').nullable();
    t.date('eol_date').nullable();
    t.boolean('hardening_status').notNullable().defaultTo(false);
    t.boolean('patching_status').notNullable().defaultTo(false);
    t.string('exception_memo_no', 100).nullable();
  });

  await knex.schema.createTable('printers', (t: T) => {
    common(t);
    t.string('device_name', 255).nullable();
    t.string('host_name', 255).nullable();
    t.string('ip_address', 50).nullable();
    t.string('managed_by', 100).nullable();
    t.date('eol_date').nullable();
  });

  await knex.schema.createTable('network_devices', (t: T) => {
    common(t);
    t.string('device_name', 255).nullable();
    t.string('host_name', 255).nullable();
    t.string('ip_address', 50).nullable();
    t.string('asset_code', 100).nullable();
    t.string('managed_by', 100).nullable();
    t.date('warranty_expiry_date').nullable();
    t.date('eol_date').nullable();
  });

  await knex.schema.createTable('other_assets', (t: T) => {
    common(t);
    t.string('host_name', 255).nullable();
  });

  await knex.schema.createTable('asset_assignments', (t: T) => {
    t.increments('id').primary();
    t.enum('asset_type', [
      'endpoint', 'monitor', 'mobile_device', 'ip_phone',
      'server', 'printer', 'network_device', 'other_asset',
    ]).notNullable();
    t.integer('asset_id').unsigned().notNullable();
    t.integer('employee_id').unsigned().notNullable().references('id').inTable('employees');
    t.date('assigned_date').notNullable();
    t.date('returned_date').nullable();
    t.integer('assigned_by_user_id').unsigned().nullable().references('id').inTable('users');
    t.text('notes').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['asset_type', 'asset_id']);
  });

  await knex.schema.createTable('network_incidents', (t: T) => {
    t.increments('id').primary();
    t.string('incident_code', 100).nullable();
    t.dateTime('start_datetime').notNullable();
    t.dateTime('end_datetime').nullable();
    t.string('application_impacted', 255).nullable();
    t.string('can_id', 100).nullable();
    t.text('problem_statement').nullable();
    t.text('impact_assessment').nullable();
    t.text('business_impact').nullable();
    t.text('observations').nullable();
    t.text('teams_involved').nullable();
    t.text('ips_impacted').nullable();
    t.timestamp('deleted_at').nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('incident_servers', (t: T) => {
    t.integer('incident_id').unsigned().notNullable().references('id').inTable('network_incidents').onDelete('CASCADE');
    t.integer('server_id').unsigned().notNullable().references('id').inTable('servers').onDelete('CASCADE');
    t.primary(['incident_id', 'server_id']);
  });

  await knex.schema.createTable('incident_network_devices', (t: T) => {
    t.integer('incident_id').unsigned().notNullable().references('id').inTable('network_incidents').onDelete('CASCADE');
    t.integer('network_device_id').unsigned().notNullable().references('id').inTable('network_devices').onDelete('CASCADE');
    t.primary(['incident_id', 'network_device_id']);
  });

  await knex.schema.createTable('audit_logs', (t: T) => {
    t.bigIncrements('id').primary();
    t.integer('user_id').unsigned().nullable().references('id').inTable('users');
    t.enum('action', ['CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'LOGIN', 'IMPORT', 'EXPORT']).notNullable();
    t.string('entity_type', 50).notNullable();
    t.integer('entity_id').nullable();
    t.json('changes').nullable();
    t.string('ip_address', 50).nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['entity_type', 'entity_id']);
    t.index('user_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'audit_logs', 'incident_network_devices', 'incident_servers', 'network_incidents',
    'asset_assignments', 'other_assets', 'network_devices', 'printers', 'servers',
    'ip_phones', 'mobile_devices', 'monitors', 'endpoints', 'serial_registry',
    'employees', 'asset_statuses', 'vendors', 'locations', 'departments', 'users',
  ];
  for (const tbl of tables) {
    await knex.schema.dropTableIfExists(tbl);
  }
}
