import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('roles', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable().unique();
    t.text('description').nullable();
    t.boolean('is_system').notNullable().defaultTo(false);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('role_permissions', (t) => {
    t.increments('id').primary();
    t.integer('role_id').unsigned().notNullable().references('id').inTable('roles').onDelete('CASCADE');
    t.string('permission', 100).notNullable();
    t.unique(['role_id', 'permission']);
  });

  await knex.schema.table('users', (t) => {
    t.integer('role_id').unsigned().nullable().references('id').inTable('roles');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('users', (t) => {
    t.dropColumn('role_id');
  });
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('roles');
}
