import type { Knex } from 'knex';

/**
 * Move PO/Invoice from `consumable_items` to `consumable_transactions`.
 *
 * Rationale: PO + Invoice describe a single purchase event, which belongs
 * to a stock-in transaction. Keeping them on the item row meant restocks
 * forced users to create duplicate item rows. Now each stock-in records
 * its own PO + Invoice; the item row is just the logical product.
 *
 * Migration steps:
 *   1. Add nullable `po_number`, `invoice_number` columns to consumable_transactions.
 *   2. For every existing item with a po/invoice on it, copy the values onto its
 *      EARLIEST stock_in transaction (or insert a synthetic one if none exists).
 *   3. Drop `po_number`, `invoice_number` from consumable_items.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Add columns to transactions
  await knex.schema.alterTable('consumable_transactions', (t: Knex.AlterTableBuilder) => {
    t.string('po_number', 100).nullable().after('reference_number');
    t.string('invoice_number', 100).nullable().after('po_number');
  });

  // 2. Backfill: for each item that has po/invoice, copy onto its earliest stock_in
  const items = await knex('consumable_items')
    .whereRaw('(po_number IS NOT NULL OR invoice_number IS NOT NULL)')
    .select('id', 'po_number', 'invoice_number', 'current_stock', 'created_at');

  for (const item of items) {
    const earliest = await knex('consumable_transactions')
      .where({ consumable_item_id: item.id, transaction_type: 'stock_in' })
      .orderBy('id', 'asc')
      .first();

    if (earliest) {
      // Only set if not already set (preserves anything migrated by hand)
      await knex('consumable_transactions')
        .where({ id: earliest.id })
        .update({
          po_number: earliest.po_number ?? item.po_number,
          invoice_number: earliest.invoice_number ?? item.invoice_number,
        });
    } else if (item.current_stock > 0) {
      // No stock-in transaction exists but item has stock — synthesize one
      await knex('consumable_transactions').insert({
        consumable_item_id: item.id,
        transaction_type: 'stock_in',
        quantity: item.current_stock,
        employee_id: null,
        performed_by_user_id: 1, // assume admin (id 1); FK is allowed since admin always exists
        transaction_date: item.created_at,
        po_number: item.po_number,
        invoice_number: item.invoice_number,
        notes: 'Backfilled from item PO/Invoice on migration',
      });
    }
    // If item has no stock and no transactions, just drop the values (nothing to attach to)
  }

  // 3. Drop the old columns
  await knex.schema.alterTable('consumable_items', (t: Knex.AlterTableBuilder) => {
    t.dropColumn('po_number');
    t.dropColumn('invoice_number');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Re-add the columns to consumable_items
  await knex.schema.alterTable('consumable_items', (t: Knex.AlterTableBuilder) => {
    t.string('po_number', 100).nullable();
    t.string('invoice_number', 100).nullable();
  });

  // Best-effort restore: copy from earliest stock_in back to item
  const items = await knex('consumable_items').select('id');
  for (const item of items) {
    const earliest = await knex('consumable_transactions')
      .where({ consumable_item_id: item.id, transaction_type: 'stock_in' })
      .orderBy('id', 'asc')
      .first();
    if (earliest) {
      await knex('consumable_items').where({ id: item.id }).update({
        po_number: earliest.po_number ?? null,
        invoice_number: earliest.invoice_number ?? null,
      });
    }
  }

  // Drop new columns from transactions
  await knex.schema.alterTable('consumable_transactions', (t: Knex.AlterTableBuilder) => {
    t.dropColumn('po_number');
    t.dropColumn('invoice_number');
  });
}
