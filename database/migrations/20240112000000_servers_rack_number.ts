// @ts-nocheck
export async function up(knex) {
  await knex.schema.alterTable('servers', (t) => {
    t.string('rack_number', 100).nullable().after('exception_memo_no');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('servers', (t) => {
    t.dropColumn('rack_number');
  });
}
