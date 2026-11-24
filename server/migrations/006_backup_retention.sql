BEGIN;

ALTER TABLE arsen_backups DROP CONSTRAINT arsen_backups_base_backup_id_user_id_fkey;
ALTER TABLE arsen_backups ADD CONSTRAINT arsen_backups_base_owner_fkey
  FOREIGN KEY (base_backup_id, user_id) REFERENCES arsen_backups(id, user_id) ON DELETE SET NULL (base_backup_id);

CREATE TABLE arsen_backup_cleanup (
  backup_id uuid PRIMARY KEY,
  user_id text NOT NULL CHECK (length(trim(user_id)) > 0),
  not_before timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
