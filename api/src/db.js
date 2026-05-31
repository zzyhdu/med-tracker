import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const useConnectionString = Boolean(process.env.DATABASE_URL);

export const pool = new Pool({
  ...(useConnectionString
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
      }),
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL client error', error);
});
