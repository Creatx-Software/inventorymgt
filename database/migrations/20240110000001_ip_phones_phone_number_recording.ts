// @ts-nocheck
exports.up = async (knex) => {
  await knex.schema.alterTable('ip_phones', (t) => {
    t.string('phone_number', 50).nullable();
    t.boolean('is_recording_enabled').defaultTo(false).notNullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('ip_phones', (t) => {
    t.dropColumn('phone_number');
    t.dropColumn('is_recording_enabled');
  });
};
