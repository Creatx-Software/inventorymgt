// @ts-nocheck
export async function up(knex) {
  const exists = await knex('asset_statuses').where({ name: 'To be Disposed' }).first();
  if (!exists) {
    await knex('asset_statuses').insert({ name: 'To be Disposed', color: '#9CA3AF' });
  }
}

export async function down(knex) {
  await knex('asset_statuses').where({ name: 'To be Disposed' }).delete();
}
