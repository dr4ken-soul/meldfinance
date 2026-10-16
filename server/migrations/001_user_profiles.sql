CREATE TABLE IF NOT EXISTS meld_user_profiles (
  firebase_uid text PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL,
  email_verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS meld_user_profiles_email_lower_unique
  ON meld_user_profiles (lower(email));

ALTER TABLE meld_user_profiles ENABLE ROW LEVEL SECURITY;
