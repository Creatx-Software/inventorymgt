// @ts-nocheck
export async function up(knex) {
  await knex.schema.alterTable('endpoints', (t) => {
    t.boolean('data_wiped').notNullable().defaultTo(false).after('eol_date');
    t.string('data_wiped_by', 150).nullable().after('data_wiped');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('endpoints', (t) => {
    t.dropColumn('data_wiped_by');
    t.dropColumn('data_wiped');
  });
}
