import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { NextFunction, Request, Response } from 'express';
import { config, hasFirebaseAdminConfig } from './config.js';
import { recordAuthEvent, upsertVerifiedProfile, type MeldAuthEventType, type MeldUser } from './database.js';
import { HttpError } from './errors.js';

export type AuthenticatedRequest = Request & { meldIdentity?: DecodedIdToken; meldUser?: MeldUser };

function getFirebaseAuth() {
  if (!hasFirebaseAdminConfig()) {
    throw new HttpError(503, 'FIREBASE_NOT_CONFIGURED', 'Firebase server verification is not configured for this Meld environment.');
  }
  try {
    const app = getApps().find((candidate) => candidate.name === '[DEFAULT]') ?? initializeApp({
      credential: cert({
        projectId: config.FIREBASE_PROJECT_ID,
        clientEmail: config.FIREBASE_CLIENT_EMAIL,
        privateKey: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      projectId: config.FIREBASE_PROJECT_ID,
    });
    return getAuth(app);
  } catch {
    throw new HttpError(503, 'FIREBASE_NOT_CONFIGURED', 'Firebase server credentials could not be initialized. Check the server environment settings.');
  }
}

export function firebaseAdminReady() {
  return hasFirebaseAdminConfig();
}

async function verifyFirebaseIdentity(request: Request) {
  const authorization = request.header('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
  try {
    return await getFirebaseAuth().verifyIdToken(token, true);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, 'INVALID_ID_TOKEN', 'Your sign-in has expired. Sign in again to continue.');
  }
}

export async function requireFirebaseIdentity(request: Request, _response: Response, next: NextFunction) {
  try {
    (request as AuthenticatedRequest).meldIdentity = await verifyFirebaseIdentity(request);
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireVerifiedFirebaseUser(request: Request, _response: Response, next: NextFunction) {
  try {
    const identity = await verifyFirebaseIdentity(request);
    if (!identity.email || !identity.email_verified) {
      throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email using the link we sent before continuing.');
    }
    (request as AuthenticatedRequest).meldIdentity = identity;
    next();
  } catch (error) {
    next(error);
  }
}

export async function getVerifiedMeldUser(request: Request) {
  const identity = (request as AuthenticatedRequest).meldIdentity;
  if (!identity?.uid || !identity.email || !identity.email_verified) {
    throw new HttpError(401, 'AUTH_REQUIRED', 'Sign in and verify your email to continue.');
  }
  const firebaseUser = await getFirebaseAuth().getUser(identity.uid);
  const fullName = typeof firebaseUser.displayName === 'string' && firebaseUser.displayName.trim()
    ? firebaseUser.displayName.trim()
    : typeof identity.name === 'string' && identity.name.trim()
      ? identity.name.trim()
    : identity.email.split('@')[0];
  const user = await upsertVerifiedProfile({ uid: identity.uid, email: identity.email, fullName });
  (request as AuthenticatedRequest).meldUser = user;

  await recordFirebaseAccountCreated(identity.uid, firebaseUser.metadata.creationTime);
  await recordEventWithoutBlockingAccess({
    uid: identity.uid,
    eventType: 'verified_session_observed',
    source: 'meld_api',
    eventKey: 'first-verified-session-observed',
  });
  return user;
}

export async function recordFirebaseAccountCreated(uid: string, creationTime?: string) {
  const resolvedCreationTime = creationTime ?? (await getFirebaseAuth().getUser(uid)).metadata.creationTime;
  await recordEventWithoutBlockingAccess({
    uid,
    eventType: 'account_created',
    source: 'firebase_admin',
    eventKey: 'firebase-account-created',
    occurredAt: resolvedCreationTime,
  });
}

export async function recordVerifiedClientEvent(input: { uid: string; eventType: Extract<MeldAuthEventType, 'email_verified' | 'sign_in_succeeded' | 'sign_out'>; eventId: string }) {
  await recordAuthEvent({
    uid: input.uid,
    eventType: input.eventType,
    source: 'verified_client',
    eventKey: input.eventType === 'email_verified'
      ? 'email-verified:first-observed'
      : `${input.eventType}:${input.eventId}`,
  });
}

export async function updateFirebaseDisplayName(uid: string, fullName: string) {
  await getFirebaseAuth().updateUser(uid, { displayName: fullName });
}

async function recordEventWithoutBlockingAccess(input: {
  uid: string;
  eventType: MeldAuthEventType;
  source: 'meld_api' | 'firebase_admin';
  eventKey: string;
  occurredAt?: string;
}) {
  try {
    await recordAuthEvent(input);
  } catch (error) {
    const details = typeof error === 'object' && error !== null ? error as { name?: unknown; code?: unknown } : {};
    console.warn('Meld authentication activity could not be recorded', {
      eventType: input.eventType,
      name: typeof details.name === 'string' ? details.name : 'UnknownError',
      code: typeof details.code === 'string' ? details.code : 'UNKNOWN',
    });
  }
}
