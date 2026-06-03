// @ts-nocheck
exports.up = async (knex) => {
  await knex.schema.createTable('notes', (t) => {
    t.increments('id').primary();
    t.date('date').notNullable();
    t.text('description').notNullable();
    t.integer('created_by_user_id').unsigned().notNullable()
      .references('id').inTable('users');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('notes');
};
