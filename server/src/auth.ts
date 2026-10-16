import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { NextFunction, Request, Response } from 'express';
import { config, hasFirebaseAdminConfig } from './config.js';
import { upsertVerifiedProfile, type MeldUser } from './database.js';
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

export async function requireVerifiedFirebaseUser(request: Request, _response: Response, next: NextFunction) {
  try {
    const authorization = request.header('authorization');
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue.');

    let identity: DecodedIdToken;
    try {
      identity = await getFirebaseAuth().verifyIdToken(token, true);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(401, 'INVALID_ID_TOKEN', 'Your sign-in has expired. Sign in again to continue.');
    }
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
  const fullName = typeof identity.name === 'string' && identity.name.trim()
    ? identity.name.trim()
    : identity.email.split('@')[0];
  const user = await upsertVerifiedProfile({ uid: identity.uid, email: identity.email, fullName });
  (request as AuthenticatedRequest).meldUser = user;
  return user;
}
