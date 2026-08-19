// @ts-nocheck
export async function up(knex) {
  await knex.schema.alterTable('firewall_rules', (t) => {
    t.enum('protocol', ['TCP', 'UDP', 'TCP/UDP']).nullable().defaultTo(null).alter();
    t.enum('direction', ['Bi-Directional', 'Uni-Directional']).nullable().defaultTo(null).alter();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('firewall_rules', (t) => {
    t.enum('protocol', ['TCP', 'UDP', 'TCP/UDP']).notNullable().defaultTo('TCP').alter();
    t.enum('direction', ['Bi-Directional', 'Uni-Directional']).notNullable().defaultTo('Uni-Directional').alter();
  });
}
