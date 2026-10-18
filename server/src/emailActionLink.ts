export type FirebaseActionMode = 'resetPassword' | 'verifyEmail';

export function toMeldActionUrl(firebaseActionUrl: string, expectedMode: FirebaseActionMode, webOrigin: string) {
  const firebaseUrl = new URL(firebaseActionUrl);
  const mode = firebaseUrl.searchParams.get('mode');
  const actionCode = firebaseUrl.searchParams.get('oobCode');
  const apiKey = firebaseUrl.searchParams.get('apiKey');

  if (mode !== expectedMode || !actionCode || !apiKey) {
    throw new Error('Firebase returned an incomplete or unexpected account action link.');
  }

  const meldUrl = new URL('/auth/action', webOrigin);
  meldUrl.searchParams.set('mode', mode);
  meldUrl.searchParams.set('oobCode', actionCode);
  meldUrl.searchParams.set('apiKey', apiKey);

  for (const key of ['continueUrl', 'lang'] as const) {
    const value = firebaseUrl.searchParams.get(key);
    if (value) meldUrl.searchParams.set(key, value);
  }

  return meldUrl.toString();
}
