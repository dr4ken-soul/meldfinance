import { apiRequest } from './api';

export type AuthActivity = 'account_created' | 'email_verified' | 'sign_in_succeeded' | 'sign_out';

export async function recordAuthActivity(type: AuthActivity) {
  try {
    await apiRequest<{ recorded: boolean }>('/auth/events', {
      method: 'POST',
      body: JSON.stringify({ eventId: crypto.randomUUID(), type }),
    });
  } catch {
    // Authentication must still complete if diagnostics are temporarily unavailable.
    // Never include email, tokens, passwords or other identity data in browser logs.
    console.warn('Meld could not save an account activity event.', { type });
  }
}
