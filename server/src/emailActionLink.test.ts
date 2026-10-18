import { describe, expect, it } from 'vitest';
import { toMeldActionUrl } from './emailActionLink.js';

describe('toMeldActionUrl', () => {
  it('routes Firebase reset links through the Meld-branded action page', () => {
    const firebaseLink = 'https://meld-finance.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=one-time-code&apiKey=public-key&continueUrl=https%3A%2F%2Fmeld-app-sage.vercel.app%2Fsign-in%3Freset%3Dcomplete&lang=en';
    const result = new URL(toMeldActionUrl(firebaseLink, 'resetPassword', 'https://meld-app-sage.vercel.app'));

    expect(result.origin).toBe('https://meld-app-sage.vercel.app');
    expect(result.pathname).toBe('/auth/action');
    expect(result.searchParams.get('mode')).toBe('resetPassword');
    expect(result.searchParams.get('oobCode')).toBe('one-time-code');
    expect(result.searchParams.get('apiKey')).toBe('public-key');
    expect(result.searchParams.get('continueUrl')).toBe('https://meld-app-sage.vercel.app/sign-in?reset=complete');
    expect(result.searchParams.get('lang')).toBe('en');
  });

  it('supports verification links without changing their action code', () => {
    const result = new URL(toMeldActionUrl(
      'https://meld-finance.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=verify-code&apiKey=public-key',
      'verifyEmail',
      'https://meld-app-sage.vercel.app',
    ));

    expect(result.searchParams.get('mode')).toBe('verifyEmail');
    expect(result.searchParams.get('oobCode')).toBe('verify-code');
  });

  it('rejects missing codes and mismatched action modes', () => {
    expect(() => toMeldActionUrl('https://firebase.test/?mode=resetPassword&apiKey=key', 'resetPassword', 'https://meld.test')).toThrow();
    expect(() => toMeldActionUrl('https://firebase.test/?mode=verifyEmail&oobCode=code&apiKey=key', 'resetPassword', 'https://meld.test')).toThrow();
  });
});
