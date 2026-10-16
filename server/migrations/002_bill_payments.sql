CREATE TABLE IF NOT EXISTS meld_bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  firebase_uid text NOT NULL REFERENCES meld_user_profiles(firebase_uid) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('airtime', 'data', 'electricity', 'tv')),
  service_id text NOT NULL,
  service_name text NOT NULL,
  product_name text NOT NULL,
  recipient_masked text NOT NULL,
  amount_ngn numeric(12, 2) NOT NULL CHECK (amount_ngn > 0),
  status text NOT NULL CHECK (status IN (
    'checkout_pending', 'awaiting_payment', 'checkout_failed', 'payment_confirmed',
    'fulfillment_processing', 'fulfillment_pending', 'fulfilled', 'failed',
    'refund_processing', 'refund_pending', 'refund_required', 'refunded'
  )),
  status_message text NOT NULL DEFAULT '',
  encrypted_details text,
  details_iv text,
  details_tag text,
  flutterwave_transaction_id text,
  flutterwave_refund_id text,
  vtpass_request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((encrypted_details IS NULL AND details_iv IS NULL AND details_tag IS NULL)
      OR (encrypted_details IS NOT NULL AND details_iv IS NOT NULL AND details_tag IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS meld_bill_payments_user_created_idx
  ON meld_bill_payments (firebase_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS meld_bill_payments_status_idx
  ON meld_bill_payments (status, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS meld_bill_payments_vtpass_request_unique
  ON meld_bill_payments (vtpass_request_id) WHERE vtpass_request_id IS NOT NULL;

ALTER TABLE meld_bill_payments ENABLE ROW LEVEL SECURITY;
