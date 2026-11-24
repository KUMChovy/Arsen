BEGIN;

ALTER TABLE arsen_backups ADD COLUMN manifest_size_bytes bigint CHECK (manifest_size_bytes BETWEEN 1 AND 4194304);

CREATE TABLE arsen_backup_components (
  backup_id uuid NOT NULL,
  user_id text NOT NULL,
  component_key text NOT NULL CHECK (component_key ~ '^[a-f0-9]{64}$'),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 9007199254740991),
  PRIMARY KEY (backup_id, component_key),
  FOREIGN KEY (backup_id, user_id) REFERENCES arsen_backups(id, user_id) ON DELETE CASCADE
);

COMMIT;
