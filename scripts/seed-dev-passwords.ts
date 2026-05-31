import bcrypt from 'bcryptjs';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://localhost:5432/ntt_grc_hub';
const DEV_PASSWORD = 'Demo1234!';

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    const hash = await bcrypt.hash(DEV_PASSWORD, 12);
    const { rowCount } = await pool.query(
      `UPDATE platform.users
          SET password_hash = $1
        WHERE status = 'active'
          AND password_hash IS NULL`,
      [hash]
    );
    console.log(`✓ Set dev password on ${rowCount} active users`);
    console.log(`  Login: <any-active-email> / ${DEV_PASSWORD}`);
    console.log(`  e.g.  maybank.singapore.admin@example.sg / ${DEV_PASSWORD}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seeder failed:', err.message);
  process.exit(1);
});
