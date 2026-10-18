CREATE TABLE IF NOT EXISTS meld_auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'account_created', 'email_verified', 'verified_session_observed',
    'sign_in_succeeded', 'sign_out', 'profile_updated'
  )),
  event_source text NOT NULL CHECK (event_source IN ('firebase_admin', 'verified_client', 'meld_api')),
  event_key text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firebase_uid, event_key)
);

CREATE INDEX IF NOT EXISTS meld_auth_events_user_time_idx
  ON meld_auth_events (firebase_uid, occurred_at DESC);

ALTER TABLE meld_auth_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE meld_auth_events FROM PUBLIC, anon, authenticated;
