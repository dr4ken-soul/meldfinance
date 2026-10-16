import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from './config.js';
import { HttpError } from './errors.js';

function encryptionKey() {
  if (!/^[\da-f]{64}$/i.test(config.PAYMENT_DATA_ENCRYPTION_KEY)) {
    throw new HttpError(503, 'PAYMENT_ENCRYPTION_NOT_CONFIGURED', 'Secure payment details are not configured for this environment.');
  }
  return Buffer.from(config.PAYMENT_DATA_ENCRYPTION_KEY, 'hex');
}

export function encryptPaymentDetails(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export function decryptPaymentDetails<T>(input: { ciphertext: string; iv: string; tag: string }): T {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(input.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(input.tag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(input.ciphertext, 'base64')), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}
