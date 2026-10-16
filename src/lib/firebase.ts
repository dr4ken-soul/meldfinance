import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const clientConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

let auth: Auth | null | undefined;

export function hasFirebaseClientConfig() {
  return Boolean(clientConfig.apiKey && clientConfig.authDomain && clientConfig.projectId && clientConfig.appId);
}

export function getFirebaseAuth() {
  if (auth !== undefined) return auth;
  if (!hasFirebaseClientConfig()) {
    auth = null;
    return auth;
  }

  const app = getApps().length ? getApp() : initializeApp(clientConfig);
  auth = getAuth(app);
  return auth;
}

export function requireFirebaseAuth() {
  const configured = getFirebaseAuth();
  if (!configured) throw new Error('Firebase Authentication is not configured for this Meld site yet.');
  return configured;
}
