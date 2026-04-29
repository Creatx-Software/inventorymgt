import type { Knex } from 'knex';

const ASSET_TABLES = [
  'endpoints',
  'monitors',
  'mobile_devices',
  'ip_phones',
  'servers',
  'printers',
  'network_devices',
  'other_assets',
];

export async function up(knex: Knex): Promise<void> {
  for (const table of ASSET_TABLES) {
    await knex.schema.alterTable(table, (t: Knex.AlterTableBuilder) => {
      t.string('sap_asset_code', 100).nullable().after('serial_number');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const table of ASSET_TABLES) {
    await knex.schema.alterTable(table, (t: Knex.AlterTableBuilder) => {
      t.dropColumn('sap_asset_code');
    });
  }
}
