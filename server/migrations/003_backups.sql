BEGIN;

ALTER TABLE arsen_devices ADD CONSTRAINT arsen_devices_id_owner_unique UNIQUE (id, user_id);
ALTER TABLE arsen_profiles ADD COLUMN health_sync_consent boolean NOT NULL DEFAULT false;

CREATE TABLE arsen_backups (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES arsen_profiles(user_id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  base_backup_id uuid,
  contract_version bigint NOT NULL CHECK (contract_version BETWEEN 1 AND 9007199254740991),
  local_revision bigint NOT NULL CHECK (local_revision BETWEEN 0 AND 9007199254740991),
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 9007199254740991),
  includes_health boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  UNIQUE (id, user_id),
  UNIQUE (user_id, manifest_sha256),
  FOREIGN KEY (device_id, user_id) REFERENCES arsen_devices(id, user_id),
  FOREIGN KEY (base_backup_id, user_id) REFERENCES arsen_backups(id, user_id),
  CHECK ((status = 'confirmed') = (confirmed_at IS NOT NULL))
);

CREATE INDEX arsen_backups_user_confirmed_idx ON arsen_backups(user_id, confirmed_at DESC) WHERE status = 'confirmed';

COMMIT;
