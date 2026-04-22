import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('consumable_items', (t) => {
    t.increments('id').primary();
    t.string('name', 255).notNullable();
    t.string('category', 100).nullable();
    t.text('description').nullable();
    t.integer('vendor_id').unsigned().nullable()
      .references('id').inTable('vendors');
    t.integer('location_id').unsigned().nullable()
      .references('id').inTable('locations');
    t.string('unit', 50).notNullable().defaultTo('each');
    t.integer('current_stock').notNullable().defaultTo(0);
    t.integer('minimum_stock').nullable();
    t.string('po_number', 100).nullable();
    t.string('invoice_number', 100).nullable();
    t.text('remarks').nullable();
    t.timestamp('deleted_at').nullable();
    t.timestamps(true, true);
    t.index(['name']);
    t.index(['category']);
  });

  await knex.schema.createTable('consumable_transactions', (t) => {
    t.increments('id').primary();
    t.integer('consumable_item_id').unsigned().notNullable()
      .references('id').inTable('consumable_items');
    t.enum('transaction_type', ['stock_in', 'assigned', 'returned']).notNullable();
    t.integer('quantity').unsigned().notNullable();
    t.integer('employee_id').unsigned().nullable()
      .references('id').inTable('employees');
    t.integer('performed_by_user_id').unsigned().notNullable()
      .references('id').inTable('users');
    t.date('transaction_date').notNullable();
    t.string('reference_number', 100).nullable();
    t.text('notes').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['consumable_item_id', 'transaction_type']);
    t.index(['employee_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('consumable_transactions');
  await knex.schema.dropTableIfExists('consumable_items');
}
