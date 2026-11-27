// @ts-nocheck
export async function up(knex) {
  await knex.schema.alterTable('servers', (t) => {
    t.boolean('is_decommissioned').notNullable().defaultTo(false);
  });
  await knex.schema.alterTable('network_devices', (t) => {
    t.boolean('is_decommissioned').notNullable().defaultTo(false);
  });
}

export async function down(knex) {
  await knex.schema.alterTable('servers', (t) => {
    t.dropColumn('is_decommissioned');
  });
  await knex.schema.alterTable('network_devices', (t) => {
    t.dropColumn('is_decommissioned');
  });
}
