import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('pending_approvals', (t) => {
    t.increments('id').primary();
    t.string('asset_type', 50).notNullable();
    t.integer('asset_id').unsigned().notNullable();
    t.integer('changed_by_user_id').unsigned().notNullable()
      .references('id').inTable('users');
    t.json('before_data').notNullable();
    t.json('after_data').notNullable();
    t.enum('status', ['pending', 'approved', 'rejected']).notNullable().defaultTo('pending');
    t.integer('reviewed_by_user_id').unsigned().nullable()
      .references('id').inTable('users');
    t.timestamp('reviewed_at').nullable();
    t.text('notes').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['asset_type', 'asset_id', 'status']);
    t.index(['status', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pending_approvals');
}
