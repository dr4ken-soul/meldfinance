import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  SUPABASE_DATABASE_URL: z.string().default(''),
  FIREBASE_PROJECT_ID: z.string().default(''),
  FIREBASE_CLIENT_EMAIL: z.string().default(''),
  FIREBASE_PRIVATE_KEY: z.string().default(''),
  FLUTTERWAVE_SECRET_KEY: z.string().default(''),
  FLUTTERWAVE_WEBHOOK_HASH: z.string().default(''),
  VTPASS_API_KEY: z.string().default(''),
  VTPASS_PUBLIC_KEY: z.string().default(''),
  VTPASS_SECRET_KEY: z.string().default(''),
  PAYMENT_DATA_ENCRYPTION_KEY: z.string().default(''),
});

export const config = environmentSchema.parse(process.env);

export function hasDatabaseConfig() {
  return Boolean(config.SUPABASE_DATABASE_URL);
}

export function hasFirebaseAdminConfig() {
  return Boolean(config.FIREBASE_PROJECT_ID && config.FIREBASE_CLIENT_EMAIL && config.FIREBASE_PRIVATE_KEY);
}

export function hasVtpassConfig() {
  return Boolean(config.VTPASS_API_KEY && config.VTPASS_PUBLIC_KEY && config.VTPASS_SECRET_KEY);
}

export function hasFlutterwaveSandboxConfig() {
  return config.FLUTTERWAVE_SECRET_KEY.startsWith('FLWSECK_TEST-');
}

export function hasPaymentEncryptionConfig() {
  return /^[\da-f]{64}$/i.test(config.PAYMENT_DATA_ENCRYPTION_KEY);
}

export function hasPaymentProviderConfig() {
  return Boolean(
    hasFlutterwaveSandboxConfig() && hasVtpassConfig() && hasPaymentEncryptionConfig(),
  );
}
