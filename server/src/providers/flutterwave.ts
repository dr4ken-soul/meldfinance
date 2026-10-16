import { config } from '../config.js';
import { HttpError } from '../errors.js';

const FLUTTERWAVE_API = 'https://api.flutterwave.com/v3';
type FlutterwaveResponse = { status?: string; message?: string; data?: Record<string, unknown> };

async function request(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(`${FLUTTERWAVE_API}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.FLUTTERWAVE_SECRET_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new HttpError(502, 'FLUTTERWAVE_UNAVAILABLE', 'The test checkout service could not be reached. No payment result has been assumed.');
  }
  const payload = await response.json().catch(() => null) as FlutterwaveResponse | null;
  if (!response.ok || payload?.status !== 'success' || !payload.data) {
    throw new HttpError(502, 'FLUTTERWAVE_REQUEST_FAILED', 'The test checkout service could not complete the request.');
  }
  return payload.data;
}

export async function createCheckout(input: {
  reference: string; amount: number; email: string; name: string; phone: string;
}) {
  const redirect = new URL('/app/pay', config.WEB_ORIGIN);
  redirect.searchParams.set('checkout', 'return');
  const data = await request('payments', 'POST', {
    tx_ref: input.reference,
    amount: input.amount,
    currency: 'NGN',
    redirect_url: redirect.toString(),
    customer: { email: input.email, name: input.name, phonenumber: input.phone },
    customizations: { title: 'Meld bill payment', description: 'Sandbox demonstration. No live funds are used.' },
    configurations: { session_duration: 10, max_retry_attempt: 3 },
  });
  const link = data.link;
  if (typeof link !== 'string' || new URL(link).origin !== 'https://checkout.flutterwave.com') {
    throw new HttpError(502, 'INVALID_CHECKOUT_LINK', 'The test checkout service returned an invalid payment link.');
  }
  return link;
}

export function verifyTransaction(transactionId: string) {
  return request(`transactions/${encodeURIComponent(transactionId)}/verify`, 'GET');
}

export function initiateRefund(transactionId: string, amount: number) {
  return request(`transactions/${encodeURIComponent(transactionId)}/refund`, 'POST', {
    amount,
    comments: 'Meld sandbox biller fulfilment failed; return sandbox checkout funds.',
  });
}
