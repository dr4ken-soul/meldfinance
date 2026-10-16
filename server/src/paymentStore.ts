import { getPool } from './database.js';
import { HttpError } from './errors.js';

export type PaymentStatus =
  | 'checkout_pending' | 'awaiting_payment' | 'checkout_failed' | 'payment_confirmed'
  | 'fulfillment_processing' | 'fulfillment_pending' | 'fulfilled' | 'failed'
  | 'refund_processing' | 'refund_pending' | 'refund_required' | 'refunded';

export type PaymentRow = {
  reference: string;
  firebase_uid: string;
  category: 'airtime' | 'data' | 'electricity' | 'tv';
  service_id: string;
  service_name: string;
  product_name: string;
  recipient_masked: string;
  amount_ngn: string;
  status: PaymentStatus;
  status_message: string;
  encrypted_details: string | null;
  details_iv: string | null;
  details_tag: string | null;
  flutterwave_transaction_id: string | null;
  flutterwave_refund_id: string | null;
  vtpass_request_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const publicColumns = `reference, firebase_uid, category, service_id, service_name, product_name,
  recipient_masked, amount_ngn, status, status_message, encrypted_details, details_iv, details_tag,
  flutterwave_transaction_id, flutterwave_refund_id, vtpass_request_id, created_at, updated_at`;

export async function createPayment(input: {
  reference: string; uid: string; category: PaymentRow['category']; serviceId: string;
  serviceName: string; productName: string; recipientMasked: string; amount: number;
  encrypted: { ciphertext: string; iv: string; tag: string };
}) {
  const result = await getPool().query<PaymentRow>(
    `INSERT INTO meld_bill_payments
      (reference, firebase_uid, category, service_id, service_name, product_name, recipient_masked,
       amount_ngn, status, encrypted_details, details_iv, details_tag)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'checkout_pending', $9, $10, $11)
     RETURNING ${publicColumns}`,
    [input.reference, input.uid, input.category, input.serviceId, input.serviceName, input.productName,
      input.recipientMasked, input.amount, input.encrypted.ciphertext, input.encrypted.iv, input.encrypted.tag],
  );
  return result.rows[0];
}

export async function getPaymentForUser(reference: string, uid: string) {
  const result = await getPool().query<PaymentRow>(
    `SELECT ${publicColumns} FROM meld_bill_payments WHERE reference = $1 AND firebase_uid = $2`, [reference, uid],
  );
  return result.rows[0] ?? null;
}

export async function getPaymentByReference(reference: string) {
  const result = await getPool().query<PaymentRow>(
    `SELECT ${publicColumns} FROM meld_bill_payments WHERE reference = $1`, [reference],
  );
  return result.rows[0] ?? null;
}

export async function listPayments(uid: string) {
  const result = await getPool().query<PaymentRow>(
    `SELECT ${publicColumns} FROM meld_bill_payments WHERE firebase_uid = $1 ORDER BY created_at DESC LIMIT 50`, [uid],
  );
  return result.rows;
}

export async function updatePayment(reference: string, uid: string | null, input: {
  status: PaymentStatus; message: string; transactionId?: string | null; requestId?: string | null;
  refundId?: string | null; clearDetails?: boolean;
}) {
  const result = await getPool().query<PaymentRow>(
    `UPDATE meld_bill_payments SET status = $3, status_message = $4,
       flutterwave_transaction_id = COALESCE($5, flutterwave_transaction_id),
       vtpass_request_id = COALESCE($6, vtpass_request_id),
       flutterwave_refund_id = COALESCE($7, flutterwave_refund_id),
       encrypted_details = CASE WHEN $8 THEN NULL ELSE encrypted_details END,
       details_iv = CASE WHEN $8 THEN NULL ELSE details_iv END,
       details_tag = CASE WHEN $8 THEN NULL ELSE details_tag END,
       updated_at = now()
     WHERE reference = $1 AND ($2::text IS NULL OR firebase_uid = $2)
     RETURNING ${publicColumns}`,
    [reference, uid, input.status, input.message.slice(0, 240), input.transactionId ?? null,
      input.requestId ?? null, input.refundId ?? null, input.clearDetails ?? false],
  );
  if (!result.rows[0]) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'This payment record could not be found.');
  return result.rows[0];
}

export async function claimFulfillment(reference: string, uid: string | null, requestId: string) {
  const result = await getPool().query<PaymentRow>(
    `UPDATE meld_bill_payments SET status = 'fulfillment_processing', vtpass_request_id = $3,
       status_message = 'Payment confirmed. Sending the biller request.', updated_at = now()
     WHERE reference = $1 AND ($2::text IS NULL OR firebase_uid = $2)
       AND status = 'payment_confirmed'
     RETURNING ${publicColumns}`,
    [reference, uid, requestId],
  );
  return result.rows[0] ?? null;
}

export async function claimRefund(reference: string) {
  const result = await getPool().query<PaymentRow>(
    `UPDATE meld_bill_payments SET status = 'refund_processing',
       status_message = 'Biller fulfilment failed. Returning the confirmed checkout payment.', updated_at = now()
     WHERE reference = $1 AND status = 'failed' RETURNING ${publicColumns}`,
    [reference],
  );
  return result.rows[0] ?? null;
}

export async function attachTransactionId(reference: string, transactionId: string) {
  await getPool().query(
    `UPDATE meld_bill_payments SET flutterwave_transaction_id = COALESCE(flutterwave_transaction_id, $2), updated_at = now()
     WHERE reference = $1`, [reference, transactionId],
  );
}
