import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ip_phones', (t: Knex.AlterTableBuilder) => {
    t.string('mac_address', 50).nullable().after('serial_number');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ip_phones', (t: Knex.AlterTableBuilder) => {
    t.dropColumn('mac_address');
  });
}
