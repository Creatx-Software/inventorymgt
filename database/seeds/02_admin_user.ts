import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();

export async function seed(knex: Knex): Promise<void> {
  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!';
  const fullName = process.env.DEFAULT_ADMIN_NAME || 'Administrator';

  const existing = await knex('users').where({ username }).first();
  if (existing) {
    console.log(`Admin user "${username}" already exists, skipping.`);
    return;
  }

  const password_hash = await bcrypt.hash(password, 10);
  await knex('users').insert({
    username,
    email,
    password_hash,
    full_name: fullName,
    is_active: true,
  });
  console.log(`Seeded admin user: ${username} / ${password}`);
}
