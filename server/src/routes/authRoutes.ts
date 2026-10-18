import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getVerifiedMeldUser, recordFirebaseAccountCreated, recordVerifiedClientEvent, requireFirebaseIdentity, requireVerifiedFirebaseUser, updateFirebaseDisplayName, type AuthenticatedRequest } from '../auth.js';
import { updateVerifiedProfileName } from '../database.js';
import { HttpError } from '../errors.js';

export const authRoutes = Router();

const eventSchema = z.object({
  eventId: z.string().uuid(),
  type: z.enum(['account_created', 'email_verified', 'sign_in_succeeded', 'sign_out']),
});

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80).refine((value) => !/\p{Cc}/u.test(value)),
});

authRoutes.get('/me', requireVerifiedFirebaseUser, async (request: Request, response: Response) => {
  const user = await getVerifiedMeldUser(request);
  response.setHeader('Cache-Control', 'no-store');
  response.json({ user });
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
