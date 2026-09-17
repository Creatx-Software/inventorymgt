// @ts-nocheck
export async function up(knex) {
  await knex.schema.createTable('employee_comments', (t) => {
    t.increments('id').primary();
    t.integer('employee_id').unsigned().notNullable().references('id').inTable('employees').onDelete('CASCADE');
    t.text('comment').notNullable();
    t.integer('created_by_user_id').unsigned().notNullable().references('id').inTable('users');
    t.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('employee_comments');
}
