BEGIN;
CREATE TABLE arsen_account_deletions (
  user_id text PRIMARY KEY,
  requested_by text NOT NULL,
  issuer text NOT NULL,
  store_fingerprint text NOT NULL CHECK (store_fingerprint ~ '^[a-f0-9]{64}$'),
  phase text NOT NULL DEFAULT 'requested' CHECK (phase IN ('requested', 'waiting')),
  not_before timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE arsen_account_deletion_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL,
  target_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('requested', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
