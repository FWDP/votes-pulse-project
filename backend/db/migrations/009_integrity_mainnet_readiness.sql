BEGIN;

ALTER TABLE report_integrity_outbox
  ADD COLUMN IF NOT EXISTS submitted_transaction_hash TEXT;
ALTER TABLE report_integrity_outbox
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE integrity_artifact_anchors
  ADD COLUMN IF NOT EXISTS subject_hash TEXT;
ALTER TABLE integrity_artifact_anchors
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE integrity_artifact_anchors
    ADD CONSTRAINT integrity_artifact_subject_hash
    CHECK (subject_hash IS NULL OR length(subject_hash) = 64);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_report_integrity_submitted_transaction
  ON report_integrity_outbox (submitted_transaction_hash)
  WHERE submitted_transaction_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_artifact_integrity_submitted_transaction
  ON integrity_artifact_anchors (transaction_hash)
  WHERE transaction_hash IS NOT NULL AND status = 'submitting';

CREATE TABLE IF NOT EXISTS integrity_alert_outbox (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivering', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (incident_id) REFERENCES integrity_incidents(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE INDEX IF NOT EXISTS idx_integrity_alert_outbox_ready
  ON integrity_alert_outbox (status, available_at, created_at);

ALTER TABLE integrity_alert_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY integrity_alert_outbox_tenant_isolation
  ON integrity_alert_outbox FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
