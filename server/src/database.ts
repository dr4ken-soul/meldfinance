import { Pool, type PoolClient } from 'pg';
import { config, hasDatabaseConfig } from './config.js';
import { HttpError } from './errors.js';
import { SUPABASE_DATABASE_ROOT_CA } from './supabase-ca.js';

export type MeldUser = {
  id: string;
  fullName: string;
  email: string;
  emailVerified: boolean;
};

export type MeldAuthEventType =
  | 'account_created'
  | 'email_verified'
  | 'verified_session_observed'
  | 'sign_in_succeeded'
  | 'sign_out'
  | 'profile_updated';

export type MeldAuthEventSource = 'firebase_admin' | 'verified_client' | 'meld_api';

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
      // Verify both the Supabase certificate chain and pooler hostname.
      // The public Supabase root CA is bundled in this server-only module so
      // Vercel has it at runtime without an extra secret or filesystem asset.
      ssl: { ca: SUPABASE_DATABASE_ROOT_CA, rejectUnauthorized: true },
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

export async function recordAuthEvent(input: {
  uid: string;
  eventType: MeldAuthEventType;
  source: MeldAuthEventSource;
  eventKey: string;
  occurredAt?: string;
}) {
  await getPool().query(
    `INSERT INTO meld_auth_events (firebase_uid, event_type, event_source, event_key, occurred_at)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))
     ON CONFLICT (firebase_uid, event_key) DO NOTHING`,
    [input.uid, input.eventType, input.source, input.eventKey, input.occurredAt ?? null],
  );
}

export async function updateVerifiedProfileName(input: { uid: string; fullName: string; eventKey: string }) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<ProfileRow>(
      `UPDATE meld_user_profiles
       SET full_name = $2, updated_at = now()
       WHERE firebase_uid = $1
       RETURNING firebase_uid, full_name, email, email_verified_at`,
      [input.uid, input.fullName],
    );
    if (!result.rows[0]) throw new HttpError(404, 'PROFILE_NOT_FOUND', 'Meld could not find the profile connected to this sign-in.');
    await client.query(
      `INSERT INTO meld_auth_events (firebase_uid, event_type, event_source, event_key)
       VALUES ($1, 'profile_updated', 'meld_api', $2)
       ON CONFLICT (firebase_uid, event_key) DO NOTHING`,
      [input.uid, input.eventKey],
    );
    await client.query('COMMIT');
    return mapProfile(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseHealth() {
  if (!hasDatabaseConfig()) return 'not_configured' as const;
  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    await client.query('SELECT 1');
    return 'connected' as const;
  } catch (error) {
    // Keep credentials and connection strings out of logs; these fields are
    // sufficient to distinguish TLS, DNS, timeout, and authentication errors.
    const details = typeof error === 'object' && error !== null ? error as { name?: unknown; code?: unknown } : {};
    console.warn('Meld Supabase health check failed', {
      name: typeof details.name === 'string' ? details.name : 'UnknownError',
      code: typeof details.code === 'string' ? details.code : 'UNKNOWN',
    });
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
