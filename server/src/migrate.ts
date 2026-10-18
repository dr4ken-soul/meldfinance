import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { getPool, closeDatabase } from './database.js';

const migrations = ['001_user_profiles', '002_bill_payments', '003_auth_activity'];

async function migrate() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS meld_schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const migrationName of migrations) {
      const applied = await client.query('SELECT 1 FROM meld_schema_migrations WHERE name = $1', [migrationName]);
      if (applied.rowCount) {
        console.info(`Migration ${migrationName} is already applied.`);
        continue;
      }

      const sql = await readFile(new URL(`../migrations/${migrationName}.sql`, import.meta.url), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO meld_schema_migrations (name) VALUES ($1)', [migrationName]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      console.info(`Applied migration ${migrationName}.`);
    }
  } finally {
    client.release();
    await closeDatabase();
  }
}

migrate().catch((error: unknown) => {
  console.error('Database migration failed.', { name: error instanceof Error ? error.name : 'UnknownError' });
  process.exitCode = 1;
});
