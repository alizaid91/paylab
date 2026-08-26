import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';

const databaseUrl = env.DATABASE_URL.replace(
  /([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/i,
  '$1verify-full'
);

export const pool = new Pool({
  connectionString: databaseUrl,
  max: env.DB_POOL_MAX
});

export const db = drizzle(pool, { schema });

export async function checkDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}
