BEGIN;

CREATE TABLE arsen_profiles (
  user_id text PRIMARY KEY CHECK (length(trim(user_id)) > 0),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE arsen_invitations (
  id uuid PRIMARY KEY,
  email text NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  token_sha256 text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by text REFERENCES arsen_profiles(user_id),
  CHECK ((accepted_at IS NULL) = (accepted_by IS NULL))
);

CREATE TABLE arsen_devices (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES arsen_profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX arsen_devices_user_id_idx ON arsen_devices(user_id);

COMMIT;
