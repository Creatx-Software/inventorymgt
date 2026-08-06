// @ts-nocheck
export async function seed(knex) {
  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
  const fullName = process.env.DEFAULT_ADMIN_NAME || 'Administrator';

  const existing = await knex('users').where({ username }).first();
  if (existing) {
    console.log(`Admin user "${username}" already exists, skipping.`);
    return;
  }

  // Pre-hashed bcrypt for 'ChangeMe123!' (10 rounds) — avoids bcryptjs import from ../database/
  const password_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
  await knex('users').insert({
    username,
    email,
    password_hash,
    full_name: fullName,
    is_active: true,
  });
  console.log(`Seeded admin user: ${username} / ChangeMe123!`);
}
