import { createHash, randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { generateFirebaseEmailVerificationLink, generateFirebasePasswordResetLink, getVerifiedMeldUser, recordFirebaseAccountCreated, recordVerifiedClientEvent, requireFirebaseIdentity, requireVerifiedFirebaseUser, updateFirebaseDisplayName, type AuthenticatedRequest } from '../auth.js';
import { updateVerifiedProfileName } from '../database.js';
import { HttpError } from '../errors.js';
import { config, hasMailjetConfig } from '../config.js';
import { sendMeldEmail } from '../mailjet.js';

export const authRoutes = Router();

const eventSchema = z.object({
  eventId: z.string().uuid(),
  type: z.enum(['account_created', 'email_verified', 'sign_in_succeeded', 'sign_out']),
});

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80).refine((value) => !/\p{Cc}/u.test(value)),
});

const passwordResetSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

const emailSendCooldowns = new Map<string, number>();

function reserveEmailSend(key: string) {
  const now = Date.now();
  const allowedAt = emailSendCooldowns.get(key);
  if (allowedAt && allowedAt > now) {
    throw new HttpError(429, 'EMAIL_RATE_LIMITED', 'Please wait a minute before requesting another email.');
  }
  if (emailSendCooldowns.size > 1_000) {
    for (const [candidate, expiry] of emailSendCooldowns) {
      if (expiry <= now) emailSendCooldowns.delete(candidate);
    }
  }
  emailSendCooldowns.set(key, now + 60_000);
}

function emailCooldownKey(kind: 'verification' | 'password-reset', email: string) {
  const digest = createHash('sha256').update(email).digest('hex');
  return `${kind}:${digest}`;
}

authRoutes.get('/me', requireVerifiedFirebaseUser, async (request: Request, response: Response) => {
  const user = await getVerifiedMeldUser(request);
  response.setHeader('Cache-Control', 'no-store');
  response.json({ user });
});

authRoutes.post('/verification-email', requireFirebaseIdentity, async (request: Request, response: Response) => {
  const identity = (request as AuthenticatedRequest).meldIdentity;
  if (!identity?.email) throw new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
  if (identity.email_verified) throw new HttpError(409, 'EMAIL_ALREADY_VERIFIED', 'This email address is already verified.');
  if (!hasMailjetConfig()) throw new HttpError(503, 'EMAIL_NOT_CONFIGURED', 'Meld email delivery is not configured for this environment yet.');

  const email = identity.email.toLowerCase();
  reserveEmailSend(emailCooldownKey('verification', email));
  const actionUrl = await generateFirebaseEmailVerificationLink(
    email,
    new URL('/sign-in?verified=1', config.WEB_ORIGIN).toString(),
  );
  await sendMeldEmail({ kind: 'verification', to: email, actionUrl });
  response.status(202).json({ sent: true });
});

authRoutes.post('/password-reset', async (request: Request, response: Response) => {
  const parsed = passwordResetSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'INVALID_EMAIL', 'Enter a valid email address to continue.');
  if (!hasMailjetConfig()) throw new HttpError(503, 'EMAIL_NOT_CONFIGURED', 'Meld email delivery is not configured for this environment yet.');

  const email = parsed.data.email;
  reserveEmailSend(emailCooldownKey('password-reset', email));
  try {
    const actionUrl = await generateFirebasePasswordResetLink(
      email,
      new URL('/sign-in?reset=complete', config.WEB_ORIGIN).toString(),
    );
    await sendMeldEmail({ kind: 'password_reset', to: email, actionUrl });
  } catch (error) {
    const details = typeof error === 'object' && error !== null ? error as { code?: unknown } : {};
    const code = typeof details.code === 'string' ? details.code : 'UNKNOWN';
    if (code !== 'auth/user-not-found') {
      console.warn('Meld password-reset email could not be delivered', { code });
    }
  }

  response.status(202).json({ accepted: true });
});

authRoutes.patch('/me', requireVerifiedFirebaseUser, async (request: Request, response: Response) => {
  const parsed = profileSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'INVALID_PROFILE_NAME', 'Enter a name between 2 and 80 characters.');
  const identity = (request as AuthenticatedRequest).meldIdentity;
  if (!identity?.uid) throw new HttpError(401, 'AUTH_REQUIRED', 'Sign in and verify your email to continue.');

  await updateFirebaseDisplayName(identity.uid, parsed.data.fullName);
  const user = await updateVerifiedProfileName({
    uid: identity.uid,
    fullName: parsed.data.fullName,
    eventKey: `profile-name:${randomUUID()}`,
  });
  response.setHeader('Cache-Control', 'no-store');
  response.json({ user });
});

authRoutes.post('/events', requireFirebaseIdentity, async (request: Request, response: Response) => {
  const parsed = eventSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'INVALID_AUTH_EVENT', 'The account activity could not be recorded.');
  const identity = (request as AuthenticatedRequest).meldIdentity;
  if (!identity?.uid) throw new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue.');

  if (parsed.data.type === 'account_created') {
    await recordFirebaseAccountCreated(identity.uid);
  } else {
    if (parsed.data.type === 'email_verified' && !identity.email_verified) {
      throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Firebase has not confirmed this email yet.');
    }
    await recordVerifiedClientEvent({ uid: identity.uid, eventType: parsed.data.type, eventId: parsed.data.eventId });
  }

  response.setHeader('Cache-Control', 'no-store');
  response.status(202).json({ recorded: true });
});
