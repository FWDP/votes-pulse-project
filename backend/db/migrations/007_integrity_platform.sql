BEGIN;

ALTER TABLE report_integrity_anchors
  ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;
ALTER TABLE report_integrity_anchors
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT;
ALTER TABLE report_integrity_anchors
  ADD COLUMN IF NOT EXISTS reconciliation_error TEXT;

DO $$ BEGIN
  ALTER TABLE report_integrity_anchors
    ADD CONSTRAINT report_integrity_anchors_reconciliation_status
    CHECK (reconciliation_status IS NULL OR reconciliation_status IN ('verified', 'missing', 'mismatch', 'error'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_report_integrity_reconciliation
  ON report_integrity_anchors (last_reconciled_at NULLS FIRST, confirmed_at)
  WHERE status = 'confirmed';

CREATE TABLE IF NOT EXISTS integrity_artifact_anchors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN (
    'survey-schema', 'survey-batch', 'dataset-snapshot', 'social-batch',
    'analytics-snapshot', 'ai-attestation', 'configuration-approval',
    'export-manifest', 'admin-audit', 'release-approval'
  )),
  external_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  report_key TEXT NOT NULL CHECK (length(report_key) = 64),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  previous_hash TEXT CHECK (previous_hash IS NULL OR length(previous_hash) = 64),
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitting', 'confirmed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  transaction_hash TEXT,
  ledger_sequence INTEGER,
  confirmed_at TIMESTAMPTZ,
  ttl_extended_at TIMESTAMPTZ,
  last_reconciled_at TIMESTAMPTZ,
  reconciliation_status TEXT CHECK (reconciliation_status IS NULL OR reconciliation_status IN ('verified', 'missing', 'mismatch', 'error')),
  reconciliation_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  UNIQUE (tenant_id, workspace_id, artifact_type, external_id, revision),
  UNIQUE (report_key, revision)
);

CREATE INDEX IF NOT EXISTS idx_integrity_artifact_ready
  ON integrity_artifact_anchors (status, available_at, created_at);
CREATE INDEX IF NOT EXISTS idx_integrity_artifact_lookup
  ON integrity_artifact_anchors (tenant_id, workspace_id, artifact_type, external_id, revision DESC);
CREATE INDEX IF NOT EXISTS idx_integrity_artifact_reconciliation
  ON integrity_artifact_anchors (last_reconciled_at NULLS FIRST, confirmed_at)
  WHERE status = 'confirmed';

CREATE TABLE IF NOT EXISTS integrity_incidents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  code TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrity_incident_open
  ON integrity_incidents (tenant_id, workspace_id, code, subject_type, subject_id)
  WHERE resolved_at IS NULL;

ALTER TABLE integrity_artifact_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY integrity_artifact_anchors_tenant_isolation
  ON integrity_artifact_anchors FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY integrity_incidents_tenant_isolation
  ON integrity_incidents FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
