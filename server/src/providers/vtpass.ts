import { config } from '../config.js';
import { HttpError } from '../errors.js';

const VTPASS_SANDBOX = 'https://sandbox.vtpass.com/api';
type ProviderPayload = Record<string, unknown>;

async function request(path: string, method: 'GET' | 'POST', body?: ProviderPayload) {
  const headers = new Headers({ Accept: 'application/json' });
  if (method === 'GET') {
    headers.set('api-key', config.VTPASS_API_KEY);
    headers.set('public-key', config.VTPASS_PUBLIC_KEY);
  } else {
    headers.set('api-key', config.VTPASS_API_KEY);
    headers.set('secret-key', config.VTPASS_SECRET_KEY);
    headers.set('Content-Type', 'application/json');
  }
  let response: Response;
  try {
    response = await fetch(`${VTPASS_SANDBOX}/${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new HttpError(502, 'VTPASS_UNAVAILABLE', 'The biller service could not be reached. Your payment status has not been guessed.');
  }
  const payload = await response.json().catch(() => null) as ProviderPayload | null;
  if (!response.ok || !payload) {
    throw new HttpError(502, 'VTPASS_UNAVAILABLE', 'The biller service did not return a usable response. Check the payment status before trying again.');
  }
  return payload;
}

export function getVariations(serviceId: string) {
  return request(`service-variations?serviceID=${encodeURIComponent(serviceId)}`, 'GET');
}

export function verifyBiller(input: { serviceId: string; billersCode: string; type?: string }) {
  return request('merchant-verify', 'POST', {
    serviceID: input.serviceId,
    billersCode: input.billersCode,
    ...(input.type ? { type: input.type } : {}),
  });
}

export function purchaseBill(input: ProviderPayload) {
  return request('pay', 'POST', input);
}

export function requeryBill(requestId: string) {
  return request('requery', 'POST', { request_id: requestId });
}
