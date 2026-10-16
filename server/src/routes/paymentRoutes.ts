import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getVerifiedMeldUser, requireVerifiedFirebaseUser } from '../auth.js';
import { config, hasFlutterwaveSandboxConfig, hasPaymentEncryptionConfig, hasPaymentProviderConfig, hasVtpassConfig } from '../config.js';
import { HttpError } from '../errors.js';
import { decryptPaymentDetails, encryptPaymentDetails } from '../paymentEncryption.js';
import { attachTransactionId, claimFulfillment, claimRefund, createPayment, getPaymentByReference, getPaymentForUser, listPayments, updatePayment, type PaymentRow } from '../paymentStore.js';
import { createCheckout, initiateRefund, verifyTransaction } from '../providers/flutterwave.js';
import { getVariations, purchaseBill, requeryBill, verifyBiller } from '../providers/vtpass.js';

export const paymentRoutes = Router();

const networks = {
  airtime: [
    { id: 'mtn', name: 'MTN' }, { id: 'airtel', name: 'Airtel' }, { id: 'glo', name: 'Glo' },
  ],
  data: [
    { id: 'mtn-data', name: 'MTN' }, { id: 'airtel-data', name: 'Airtel' }, { id: 'glo-data', name: 'Glo' },
  ],
  electricity: [
    { id: 'ikeja-electric', name: 'Ikeja Electric' }, { id: 'eko-electric', name: 'Eko Electric' },
    { id: 'abuja-electric', name: 'Abuja Electric' }, { id: 'ibadan-electric', name: 'Ibadan Electric' },
    { id: 'portharcourt-electric', name: 'Port Harcourt Electric' },
  ],
  tv: [
    { id: 'dstv', name: 'DStv' }, { id: 'gotv', name: 'GOtv' }, { id: 'startimes', name: 'StarTimes' },
  ],
} as const;

type Category = keyof typeof networks;
type PaymentDetails = { billersCode: string; phone: string; email: string; type?: string; variationCode?: string };
const bodySchema = z.object({
  serviceId: z.string().min(2).max(60),
  billersCode: z.string().trim().min(5).max(32),
  phone: z.string().trim().regex(/^\+?[\d\s()-]{10,18}$/),
  type: z.enum(['prepaid', 'postpaid']).optional(),
  variationCode: z.string().trim().min(1).max(80).optional(),
  amount: z.coerce.number().positive().max(500_000).optional(),
});

function requireVtpass() {
  if (!hasVtpassConfig()) throw new HttpError(503, 'VTPASS_NOT_CONFIGURED', 'Add the VTPass sandbox API key, public key and secret key to enable biller checks.');
}

function requirePayments() {
  if (!hasPaymentProviderConfig()) {
    throw new HttpError(503, 'PAYMENTS_NOT_CONFIGURED', 'Add VTPass sandbox keys, a Flutterwave test secret key and the payment-data encryption key before making a sandbox payment.');
  }
}

function categoryForService(serviceId: string): { category: Category; name: string } {
  for (const [category, options] of Object.entries(networks) as [Category, readonly { id: string; name: string }[]][]) {
    const selected = options.find((option) => option.id === serviceId);
    if (selected) return { category, name: selected.name };
  }
  throw new HttpError(400, 'UNSUPPORTED_BILLER', 'Choose a biller from the available Meld list.');
}

function getVerifiedBody(body: unknown) {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, 'INVALID_PAYMENT_DETAILS', 'Check the biller, account number, phone number and amount, then try again.');
  const input = parsed.data;
  const service = categoryForService(input.serviceId);
  if ((service.category === 'data' || service.category === 'tv') && !input.variationCode) {
    throw new HttpError(400, 'PLAN_REQUIRED', 'Select a data bundle or TV package before continuing.');
  }
  if (service.category === 'electricity' && !input.type) {
    throw new HttpError(400, 'METER_TYPE_REQUIRED', 'Select prepaid or postpaid before continuing.');
  }
  if ((service.category === 'airtime' || service.category === 'electricity') && (!input.amount || input.amount < 100)) {
    throw new HttpError(400, 'AMOUNT_REQUIRED', 'Enter an amount of at least ₦100.');
  }
  return { ...input, ...service };
}

function providerSucceeded(payload: Record<string, unknown>) {
  if (providerPending(payload)) return false;
  const content = payload.content as Record<string, unknown> | undefined;
  const transaction = content?.transactions as Record<string, unknown> | undefined;
  const status = String(transaction?.status ?? payload.response_description ?? '').toLowerCase();
  return String(payload.code ?? '') === '000' || ['delivered', 'successful', 'success'].includes(status);
}

function providerPending(payload: Record<string, unknown>) {
  const content = payload.content as Record<string, unknown> | undefined;
  const transaction = content?.transactions as Record<string, unknown> | undefined;
  const status = String(transaction?.status ?? payload.response_description ?? '').toLowerCase();
  return payload.code === '099' || ['pending', 'processing', 'in progress', 'queued'].some((part) => status.includes(part));
}

function safePayment(row: PaymentRow) {
  return {
    reference: row.reference,
    category: row.category,
    serviceName: row.service_name,
    productName: row.product_name,
    recipient: row.recipient_masked,
    amount: Number(row.amount_ngn),
    currency: 'NGN',
    status: row.status,
    statusMessage: row.status_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function randomProviderRequestId() {
  return `${Date.now()}${randomBytes(4).readUInt32BE(0).toString().padStart(10, '0')}`;
}

function isSameSecret(a: string | undefined, b: string) {
  if (!a) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function priceFor(input: ReturnType<typeof getVerifiedBody>) {
  if (input.category === 'airtime' || input.category === 'electricity') return input.amount!;
  const response = await getVariations(input.serviceId);
  const content = response.content as { variations?: Array<Record<string, unknown>> } | undefined;
  const variation = content?.variations?.find((item) => String(item.variation_code) === input.variationCode);
  if (!variation) throw new HttpError(400, 'PLAN_UNAVAILABLE', 'That plan is no longer available. Refresh the plans and choose another.');
  const amount = Number(variation.variation_amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 500_000) {
    throw new HttpError(400, 'INVALID_PLAN_PRICE', 'The biller returned an invalid plan price. No checkout was created.');
  }
  return amount;
}

async function refundConfirmedPayment(row: PaymentRow, uid: string | null) {
  const claimed = await claimRefund(row.reference);
  if (!claimed) return (uid ? await getPaymentForUser(row.reference, uid) : await getPaymentByReference(row.reference)) ?? row;
  if (!claimed.flutterwave_transaction_id) {
    return updatePayment(row.reference, uid, { status: 'refund_required', message: 'Checkout funds were confirmed, but the refund reference is missing. Contact Meld support.', clearDetails: true });
  }
  try {
    const refund = await initiateRefund(claimed.flutterwave_transaction_id, Number(claimed.amount_ngn));
    const refundId = typeof refund.id === 'number' || typeof refund.id === 'string' ? String(refund.id) : null;
    const refundStatus = String(refund.status ?? '').toLowerCase();
    const complete = ['completed', 'successful', 'success'].includes(refundStatus);
    return updatePayment(row.reference, uid, {
      status: complete || refundStatus.startsWith('completed') ? 'refunded' : 'refund_pending',
      message: complete ? 'The biller could not complete the bill. The sandbox checkout refund is confirmed.' : 'The biller could not complete the bill. A sandbox checkout refund has been requested and is being processed.',
      refundId,
      clearDetails: true,
    });
  } catch {
    return updatePayment(row.reference, uid, { status: 'refund_required', message: 'The biller did not complete the bill. Refund resolution is required; do not submit this payment again.', clearDetails: true });
  }
}

async function reconcileVtpass(row: PaymentRow, uid: string | null) {
  if (!row.vtpass_request_id) return row;
  const response = await requeryBill(row.vtpass_request_id);
  if (providerSucceeded(response)) {
    return updatePayment(row.reference, uid, { status: 'fulfilled', message: 'The biller confirmed the payment.', clearDetails: true });
  }
  if (providerPending(response)) {
    return updatePayment(row.reference, uid, { status: 'fulfillment_pending', message: 'The biller is still processing this payment. Meld will not submit it again while the result is pending.' });
  }
  const failed = await updatePayment(row.reference, uid, { status: 'failed', message: 'The biller confirmed that this payment did not complete.', clearDetails: true });
  return refundConfirmedPayment(failed, uid);
}

async function verifyAndFulfil(reference: string, transactionId: string, uid: string | null) {
  const row = uid ? await getPaymentForUser(reference, uid) : await getPaymentByReference(reference);
  if (!row) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'This payment record could not be found.');
  if (row.status === 'fulfilled' || row.status.startsWith('refund_') || row.status === 'refunded' || row.status === 'refund_required' || row.status === 'checkout_failed') return row;
  if (row.status === 'fulfillment_pending' || row.status === 'fulfillment_processing') {
    return row.status === 'fulfillment_pending' ? reconcileVtpass(row, uid) : row;
  }
  if (!hasFlutterwaveSandboxConfig()) throw new HttpError(503, 'FLUTTERWAVE_NOT_CONFIGURED', 'Flutterwave test checkout is not configured.');

  const verified = await verifyTransaction(transactionId);
  const verifiedReference = String(verified.tx_ref ?? '');
  const gatewayStatus = String(verified.status ?? '').toLowerCase();
  const amount = Number(verified.amount);
  const currency = String(verified.currency ?? '');
  if (verifiedReference !== row.reference || gatewayStatus !== 'successful' || currency !== 'NGN') {
    const updated = await updatePayment(reference, uid, { status: 'checkout_failed', message: 'Checkout did not confirm a matching successful NGN payment.', transactionId, clearDetails: true });
    return updated;
  }
  await attachTransactionId(reference, transactionId);
  if (!Number.isFinite(amount) || Math.abs(amount - Number(row.amount_ngn)) > 0.009) {
    const marked = await updatePayment(reference, uid, { status: 'failed', message: 'Checkout amount did not match the bill amount. Meld did not send the biller request.', transactionId, clearDetails: true });
    return refundConfirmedPayment(marked, uid);
  }

  const confirmed = await updatePayment(reference, uid, { status: 'payment_confirmed', message: 'Checkout payment confirmed. Preparing the biller request.', transactionId });
  const requestId = randomProviderRequestId();
  const claimed = await claimFulfillment(reference, uid, requestId);
  if (!claimed) return uid ? (await getPaymentForUser(reference, uid)) ?? confirmed : (await getPaymentByReference(reference)) ?? confirmed;

  try {
    if (!claimed.encrypted_details || !claimed.details_iv || !claimed.details_tag) {
      throw new Error('Missing encrypted fulfilment data.');
    }
    const details = decryptPaymentDetails<PaymentDetails>({
      ciphertext: claimed.encrypted_details, iv: claimed.details_iv, tag: claimed.details_tag,
    });
    const purchase: Record<string, unknown> = {
      request_id: requestId,
      serviceID: claimed.service_id,
      billersCode: details.billersCode,
      amount: Number(claimed.amount_ngn),
      phone: details.phone,
      email: details.email,
    };
    if (details.variationCode) purchase.variation_code = details.variationCode;
    if (details.type) purchase.variation_code = details.type;
    const result = await purchaseBill(purchase);
    if (providerSucceeded(result)) {
      return updatePayment(reference, uid, { status: 'fulfilled', message: 'The biller confirmed the payment.', transactionId, requestId, clearDetails: true });
    }
    if (providerPending(result)) {
      return updatePayment(reference, uid, { status: 'fulfillment_pending', message: 'The biller is still processing this payment. Meld will check the request status before any further action.', transactionId, requestId, clearDetails: true });
    }
    const failed = await updatePayment(reference, uid, { status: 'failed', message: 'The biller confirmed that this payment did not complete.', transactionId, requestId, clearDetails: true });
    return refundConfirmedPayment(failed, uid);
  } catch (error) {
    if (error instanceof HttpError && error.code !== 'VTPASS_UNAVAILABLE') throw error;
    return updatePayment(reference, uid, {
      status: 'fulfillment_pending',
      message: 'The biller response was not conclusive. Check this payment’s status before trying again.',
      transactionId, requestId, clearDetails: true,
    });
  }
}

paymentRoutes.get('/catalog', requireVerifiedFirebaseUser, (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json({ categories: networks, readiness: { vtpass: hasVtpassConfig(), checkout: hasFlutterwaveSandboxConfig(), secureStorage: hasPaymentEncryptionConfig(), payments: hasPaymentProviderConfig() } });
});

paymentRoutes.get('/variations', requireVerifiedFirebaseUser, async (request, response) => {
  requireVtpass();
  const serviceId = String(request.query.serviceId ?? '');
  const selected = categoryForService(serviceId);
  if (selected.category !== 'data' && selected.category !== 'tv') {
    throw new HttpError(400, 'VARIATIONS_NOT_SUPPORTED', 'This service uses a direct amount rather than a plan list.');
  }
  const result = await getVariations(serviceId);
  const content = result.content as { variations?: Array<Record<string, unknown>> } | undefined;
  const variations = (content?.variations ?? []).map((item) => ({
    code: String(item.variation_code ?? ''),
    name: String(item.name ?? 'Plan'),
    amount: Number(item.variation_amount),
    fixedPrice: String(item.fixedPrice ?? '').toLowerCase() === 'yes',
  })).filter((item) => item.code && Number.isFinite(item.amount) && item.amount > 0);
  response.setHeader('Cache-Control', 'no-store');
  response.json({ serviceId, variations });
});

paymentRoutes.post('/verify-biller', requireVerifiedFirebaseUser, async (request: Request, response: Response) => {
  requireVtpass();
  const parsed = z.object({ serviceId: z.string(), billersCode: z.string().trim().min(5).max(32), type: z.enum(['prepaid', 'postpaid']).optional() }).safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'INVALID_BILLER_DETAILS', 'Enter a valid meter or smart-card number.');
  const selected = categoryForService(parsed.data.serviceId);
  if (selected.category !== 'electricity' && selected.category !== 'tv') {
    throw new HttpError(400, 'VERIFICATION_NOT_REQUIRED', 'This service does not use biller account verification.');
  }
  if (selected.category === 'electricity' && !parsed.data.type) throw new HttpError(400, 'METER_TYPE_REQUIRED', 'Select prepaid or postpaid.');
  const result = await verifyBiller({ serviceId: parsed.data.serviceId, billersCode: parsed.data.billersCode, type: parsed.data.type });
  const content = result.content as Record<string, unknown> | undefined;
  if (String(result.code ?? '') !== '000' || content?.WrongBillersCode === true) {
    throw new HttpError(422, 'BILLER_NOT_VERIFIED', 'The biller could not verify those details. Check the number and try again.');
  }
  response.setHeader('Cache-Control', 'no-store');
  response.json({ verified: true, customerName: String(content?.Customer_Name ?? content?.customer_name ?? 'Account verified'), serviceName: selected.name });
});

paymentRoutes.post('/', requireVerifiedFirebaseUser, async (request: Request, response: Response) => {
  requirePayments();
  const user = await getVerifiedMeldUser(request);
  const input = getVerifiedBody(request.body);
  const amount = await priceFor(input);
  if (!Number.isFinite(amount) || amount < 100 || amount > 500_000) throw new HttpError(400, 'INVALID_AMOUNT', 'The selected bill amount is outside Meld’s sandbox limits.');
  if (input.category === 'electricity' || input.category === 'tv') {
    const verification = await verifyBiller({ serviceId: input.serviceId, billersCode: input.billersCode, type: input.type });
    const verifiedContent = verification.content as Record<string, unknown> | undefined;
    if (String(verification.code ?? '') !== '000' || verifiedContent?.WrongBillersCode === true) {
      throw new HttpError(422, 'BILLER_NOT_VERIFIED', 'The biller could not verify those details. No checkout was created.');
    }
  }
  if (input.category === 'tv') {
    const catalog = await getVariations(input.serviceId);
    const items = (catalog.content as { variations?: Array<Record<string, unknown>> } | undefined)?.variations ?? [];
    if (!items.some((item) => String(item.variation_code) === input.variationCode)) throw new HttpError(400, 'PLAN_UNAVAILABLE', 'That TV package is no longer available. Refresh the options and try again.');
  }
  const variationCode = input.category === 'electricity' ? input.type : input.variationCode;
  const details: PaymentDetails = {
    billersCode: input.billersCode,
    phone: input.phone.replace(/[\s()-]/g, ''),
    email: user.email,
    ...(input.type ? { type: input.type } : {}),
    ...(variationCode ? { variationCode } : {}),
  };
  const reference = `meld-${randomBytes(16).toString('hex')}`;
  const recipientMasked = input.billersCode.length > 4 ? `•••• ${input.billersCode.slice(-4)}` : input.billersCode;
  const productName = input.category === 'airtime' ? 'Airtime top-up'
    : input.category === 'data' ? 'Mobile data bundle'
      : input.category === 'electricity' ? `Electricity (${input.type})`
        : input.variationCode!;
  await createPayment({
    reference, uid: user.id, category: input.category, serviceId: input.serviceId, serviceName: input.name,
    productName, recipientMasked, amount,
    encrypted: encryptPaymentDetails(details),
  });
  try {
    const checkoutUrl = await createCheckout({ reference, amount, email: user.email, name: user.fullName, phone: details.phone });
    const awaiting = await updatePayment(reference, user.id, { status: 'awaiting_payment', message: 'Waiting for sandbox checkout confirmation.' });
    response.status(201).json({ checkoutUrl, payment: safePayment(awaiting) });
  } catch (error) {
    await updatePayment(reference, user.id, { status: 'checkout_failed', message: 'Sandbox checkout could not be started. No biller request was sent.', clearDetails: true });
    throw error;
  }
});

paymentRoutes.get('/', requireVerifiedFirebaseUser, async (request: Request, response: Response) => {
  const user = await getVerifiedMeldUser(request);
  const rows = await listPayments(user.id);
  response.setHeader('Cache-Control', 'no-store');
  response.json({ payments: rows.map(safePayment) });
});

paymentRoutes.get('/:reference', requireVerifiedFirebaseUser, async (request: Request, response: Response) => {
  const user = await getVerifiedMeldUser(request);
  const parsedReference = z.string().min(10).max(100).safeParse(request.params.reference);
  if (!parsedReference.success) throw new HttpError(400, 'INVALID_PAYMENT_REFERENCE', 'The payment reference is invalid.');
  const row = await getPaymentForUser(parsedReference.data, user.id);
  if (!row) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'This payment record could not be found.');
  const latest = row.status === 'fulfillment_pending' ? await reconcileVtpass(row, user.id) : row;
  response.setHeader('Cache-Control', 'no-store');
  response.json({ payment: safePayment(latest) });
});

paymentRoutes.post('/confirm', requireVerifiedFirebaseUser, async (request: Request, response: Response) => {
  const user = await getVerifiedMeldUser(request);
  const parsed = z.object({ reference: z.string().min(10).max(100), transactionId: z.string().regex(/^\d{1,30}$/) }).safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'INVALID_CHECKOUT_RETURN', 'The checkout return was incomplete. Open Activity to check the payment record.');
  const row = await verifyAndFulfil(parsed.data.reference, parsed.data.transactionId, user.id);
  response.setHeader('Cache-Control', 'no-store');
  response.json({ payment: safePayment(row) });
});

paymentRoutes.post('/flutterwave-webhook', async (request: Request, response: Response) => {
  if (!config.FLUTTERWAVE_WEBHOOK_HASH || !isSameSecret(request.header('verif-hash'), config.FLUTTERWAVE_WEBHOOK_HASH)) {
    throw new HttpError(401, 'INVALID_WEBHOOK', 'The checkout notification could not be verified.');
  }
  const data = request.body?.data as Record<string, unknown> | undefined;
  const transactionId = String(data?.id ?? '');
  const reference = String(data?.tx_ref ?? '');
  if (!/^\d{1,30}$/.test(transactionId) || !reference) {
    response.status(200).json({ received: true, ignored: true });
    return;
  }
  await verifyAndFulfil(reference, transactionId, null);
  response.status(200).json({ received: true });
});
