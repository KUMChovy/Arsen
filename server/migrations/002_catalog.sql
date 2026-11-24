BEGIN;

CREATE TABLE arsen_catalog_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  version bigint NOT NULL DEFAULT 0 CHECK (version BETWEEN 0 AND 9007199254740991)
);
INSERT INTO arsen_catalog_state (singleton) VALUES (true);

CREATE TABLE arsen_catalog_items (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{0,127}$'),
  draft jsonb NOT NULL CHECK (jsonb_typeof(draft) = 'object'),
  published jsonb CHECK (published IS NULL OR jsonb_typeof(published) = 'object'),
  archived boolean NOT NULL DEFAULT false CHECK (NOT archived OR published IS NOT NULL),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE arsen_catalog_changes (
  version bigint PRIMARY KEY CHECK (version BETWEEN 1 AND 9007199254740991),
  item_id text NOT NULL REFERENCES arsen_catalog_items(id),
  action text NOT NULL CHECK (action IN ('publish', 'archive')),
  actor_id text NOT NULL CHECK (length(trim(actor_id)) > 0),
  payload jsonb,
  CHECK ((action = 'publish' AND payload IS NOT NULL AND jsonb_typeof(payload) = 'object') OR (action = 'archive' AND payload IS NULL)),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
