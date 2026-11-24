BEGIN;

CREATE TABLE arsen_catalog_draft_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL CHECK (length(trim(actor_id)) > 0),
  action text NOT NULL CHECK (action IN ('draft.save', 'image.upload.requested')),
  target_id text NOT NULL CHECK (target_id ~ '^[a-z0-9][a-z0-9-]{0,127}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
