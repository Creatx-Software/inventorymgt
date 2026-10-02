// @ts-nocheck
export async function up(knex) {
  await knex.schema.alterTable('employees', (t) => {
    t.integer('secondary_location_id').unsigned().nullable()
      .references('id').inTable('locations').onDelete('SET NULL')
      .after('location_id');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('employees', (t) => {
    t.dropColumn('secondary_location_id');
  });
}
