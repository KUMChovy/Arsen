BEGIN;

CREATE TABLE arsen_admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL CHECK (length(trim(actor_id)) > 0),
  action text NOT NULL CHECK (action IN ('invitation.requested')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (action, target_id)
);

COMMIT;
