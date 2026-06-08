// @ts-nocheck
exports.up = async (knex) => {
  await knex.schema.alterTable('activities', (t) => {
    t.dropColumn('raised_by');
    t.integer('raised_by_employee_id').unsigned().nullable()
      .references('id').inTable('employees').onDelete('SET NULL');
    t.index(['raised_by_employee_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('activities', (t) => {
    t.dropColumn('raised_by_employee_id');
    t.string('raised_by', 150).nullable();
  });
};
