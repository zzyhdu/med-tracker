import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const [, , rawEmail, password] = process.argv;
const email = String(rawEmail || '').trim().toLowerCase();

if (!email || !password) {
  console.error('Usage: npm run create-user -- user@example.com strong-password');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
const passwordHash = await bcrypt.hash(password, rounds);

try {
  const { rows } = await pool.query(
    `
      insert into users (email, password_hash)
      values ($1, $2)
      on conflict (email) do update set
        password_hash = excluded.password_hash,
        updated_at = now()
      returning id, email
    `,
    [email, passwordHash],
  );

  console.log(`User ready: ${rows[0].email} (${rows[0].id})`);
} finally {
  await pool.end();
}
