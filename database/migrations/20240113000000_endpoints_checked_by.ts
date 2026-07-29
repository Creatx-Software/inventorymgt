// @ts-nocheck
export async function up(knex) {
  await knex.schema.alterTable('endpoints', (t) => {
    t.string('data_checked_by', 150).nullable().after('data_wiped_by');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('endpoints', (t) => {
    t.dropColumn('data_checked_by');
  });
}
