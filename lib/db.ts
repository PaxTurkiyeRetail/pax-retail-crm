import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL');
}

export const db =
  global.__pgPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = db;
}
