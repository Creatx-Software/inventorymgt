import type { Knex } from 'knex';

const statuses = [
  { id: 1, name: 'In Use',       color: '#10b981' },
  { id: 2, name: 'In Stores',    color: '#3b82f6' },
  { id: 3, name: 'Under Repair', color: '#f59e0b' },
  { id: 4, name: 'Disposed',     color: '#6b7280' },
  { id: 5, name: 'Lost',         color: '#ef4444' },
  { id: 6, name: 'Returned',     color: '#8b5cf6' },
];

export async function seed(knex: Knex): Promise<void> {
  for (const row of statuses) {
    const existing = await knex('asset_statuses').where({ id: row.id }).first();
    if (!existing) {
      await knex('asset_statuses').insert(row);
    }
  }
}
