// @ts-nocheck
exports.up = async (knex) => {
  await knex.schema.alterTable('network_incidents', (t) => {
    t.date('date').nullable().after('id');
    t.string('sn_call_number', 100).nullable();
    t.integer('raised_by_employee_id').unsigned().nullable()
      .references('id').inTable('employees').onDelete('SET NULL');
    t.string('email_attachment_name', 255).nullable();
    t.specificType('email_attachment_data', 'LONGBLOB').nullable();
    t.index(['date']);
    t.index(['raised_by_employee_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('network_incidents', (t) => {
    t.dropColumn('date');
    t.dropColumn('sn_call_number');
    t.dropColumn('raised_by_employee_id');
    t.dropColumn('email_attachment_name');
    t.dropColumn('email_attachment_data');
  });
};
