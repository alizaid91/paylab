import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const databaseUrl = (process.env.DATABASE_URL ?? '').replace(
  /([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/i,
  '$1verify-full'
);

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl
  },
  strict: true,
  verbose: true
});
