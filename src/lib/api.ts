import { getFirebaseAuth } from './firebase';

export type ApiFailure = {
  error?: { code?: string; message?: string };
  message?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const currentUser = getFirebaseAuth()?.currentUser;
    if (currentUser) headers.set('Authorization', `Bearer ${await currentUser.getIdToken()}`);

    response = await fetch(`/api${path}`, {
      ...init,
      credentials: 'omit',
      headers,
    });
  } catch {
    throw new ApiError('Meld could not reach its local service. Check that the API server is running.', 0, 'NETWORK_ERROR');
  }

  const payload = await response.json().catch(() => ({})) as ApiFailure & T;
  if (!response.ok) {
    throw new ApiError(
      payload.error?.message ?? payload.message ?? 'The request could not be completed.',
      response.status,
      payload.error?.code,
    );
  }
  return payload;
}
