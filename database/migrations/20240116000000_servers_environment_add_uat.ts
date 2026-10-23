import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('servers', (t) => {
    t.enum('environment', ['Prod', 'FB', 'DR', 'UAT']).nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('servers', (t) => {
    t.enum('environment', ['Prod', 'FB', 'DR']).nullable().alter();
  });
}
