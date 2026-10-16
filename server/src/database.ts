import { Pool, type PoolClient } from 'pg';
import { config, hasDatabaseConfig } from './config.js';
import { HttpError } from './errors.js';

export type MeldUser = {
  id: string;
  fullName: string;
  email: string;
  emailVerified: boolean;
};

type ProfileRow = {
  firebase_uid: string;
  full_name: string;
  email: string;
  email_verified_at: Date | string | null;
};

let pool: Pool | undefined;

export function getPool() {
  if (!hasDatabaseConfig()) {
    throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Supabase Postgres is not configured for this Meld environment.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: config.SUPABASE_DATABASE_URL,
      // Keep one client connection per warm serverless instance; Supavisor
      // transaction pooling multiplexes the short-lived Vercel requests.
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      ssl: { rejectUnauthorized: true },
      application_name: 'meld-api',
    });
  }
  return pool;
}

function mapProfile(row: ProfileRow): MeldUser {
  return {
    id: row.firebase_uid,
    fullName: row.full_name,
    email: row.email,
    emailVerified: Boolean(row.email_verified_at),
  };
}

export async function upsertVerifiedProfile(input: { uid: string; email: string; fullName: string }) {
  try {
    const result = await getPool().query<ProfileRow>(
      `INSERT INTO meld_user_profiles (firebase_uid, email, full_name, email_verified_at)
       VALUES ($1, lower($2), $3, now())
       ON CONFLICT (firebase_uid) DO UPDATE
       SET email = EXCLUDED.email,
           full_name = EXCLUDED.full_name,
           email_verified_at = COALESCE(meld_user_profiles.email_verified_at, EXCLUDED.email_verified_at),
           updated_at = now()
       RETURNING firebase_uid, full_name, email, email_verified_at`,
      [input.uid, input.email, input.fullName],
    );
    return mapProfile(result.rows[0]);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new HttpError(409, 'PROFILE_CONFLICT', 'This email is already connected to a Meld profile. Contact support if you think this is an error.');
    }
    throw error;
  }
}

export async function databaseHealth() {
  if (!hasDatabaseConfig()) return 'not_configured' as const;
  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    await client.query('SELECT 1');
    return 'connected' as const;
  } catch {
    return 'unavailable' as const;
  } finally {
    client?.release();
  }
}

export async function closeDatabase() {
  if (!pool) return;
  const currentPool = pool;
  pool = undefined;
  await currentPool.end();
}
