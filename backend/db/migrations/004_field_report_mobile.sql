BEGIN;

ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS evidence_type TEXT;
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS field_reports_tenant_workspace_client_unique
  ON field_reports (tenant_id, workspace_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_field_reports_tenant_workspace_updated_at
  ON field_reports (tenant_id, workspace_id, updated_at DESC);

COMMIT;
