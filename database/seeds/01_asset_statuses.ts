import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('asset_statuses').del();
  await knex('asset_statuses').insert([
    { id: 1, name: 'In Use',       color: '#10b981' },
    { id: 2, name: 'In Stores',    color: '#3b82f6' },
    { id: 3, name: 'Under Repair', color: '#f59e0b' },
    { id: 4, name: 'Disposed',     color: '#6b7280' },
    { id: 5, name: 'Lost',         color: '#ef4444' },
    { id: 6, name: 'Returned',     color: '#8b5cf6' },
  ]);
}
