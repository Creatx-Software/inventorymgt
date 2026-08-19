// @ts-nocheck
export async function up(knex) {
  await knex.schema.createTable('app_settings', (t) => {
    t.string('key', 100).primary();
    t.text('value').nullable();
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('app_settings');
}
