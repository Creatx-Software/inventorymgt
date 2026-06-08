// @ts-nocheck
exports.up = async (knex) => {
  await knex.schema.createTable('activities', (t) => {
    t.increments('id').primary();
    t.date('date').notNullable();
    t.string('sub_category', 100).nullable();
    t.string('ip_address', 100).nullable();
    t.string('device', 255).nullable();
    t.string('sn_call_number', 100).nullable();
    t.string('raised_by', 150).nullable();
    t.text('description').nullable();
    t.string('email_attachment_name', 255).nullable();
    t.specificType('email_attachment_data', 'LONGBLOB').nullable();
    t.integer('created_by_user_id').unsigned().notNullable()
      .references('id').inTable('users');
    t.timestamps(true, true);
    t.index(['date']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('activities');
};
