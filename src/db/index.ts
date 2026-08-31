import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = (): Pool => {
  if (!global._postgresPool) {
    const port = process.env.SQL_PORT
      ? parseInt(process.env.SQL_PORT)
      : process.env.PGPORT
      ? parseInt(process.env.PGPORT)
      : 5432;
    const host = process.env.SQL_HOST || process.env.PGHOST || 'localhost';
    const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER || process.env.PGUSER;
    const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || process.env.PGPASSWORD;
    const database = process.env.SQL_DB_NAME || process.env.PGDATABASE;
    const ssl =
      process.env.SQL_SSL === 'true' || process.env.SQL_SSL === 'require' || process.env.PGSSLMODE === 'require'
        ? { rejectUnauthorized: false }
        : process.env.SQL_SSL === 'false' || process.env.PGSSLMODE === 'disable'
        ? false
        : undefined;

    if (process.env.DATABASE_URL) {
      global._postgresPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: ssl,
        max: process.env.SQL_POOL_MAX ? parseInt(process.env.SQL_POOL_MAX) : 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      global._postgresPool = new Pool({
        host,
        port,
        user,
        password,
        database,
        ssl,
        max: process.env.SQL_POOL_MAX ? parseInt(process.env.SQL_POOL_MAX) : 10,
        connectionTimeoutMillis: 15000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();

export const db = drizzle(pool, { schema });
