BEGIN;

CREATE TABLE IF NOT EXISTS report_integrity_outbox (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  report_key TEXT NOT NULL CHECK (length(report_key) = 64),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitting', 'confirmed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (report_id) REFERENCES field_reports(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, workspace_id, report_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_report_integrity_outbox_ready
  ON report_integrity_outbox (status, available_at, created_at);

CREATE TABLE IF NOT EXISTS report_integrity_anchors (
  id TEXT PRIMARY KEY,
  outbox_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  network TEXT NOT NULL,
  contract_id TEXT,
  report_key TEXT NOT NULL CHECK (length(report_key) = 64),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitting', 'confirmed', 'failed')),
  transaction_hash TEXT,
  ledger_sequence INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (outbox_id) REFERENCES report_integrity_outbox(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (report_id) REFERENCES field_reports(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, workspace_id, report_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_report_integrity_anchors_report
  ON report_integrity_anchors (tenant_id, workspace_id, report_id, revision DESC);

ALTER TABLE report_integrity_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_integrity_anchors ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_integrity_outbox_tenant_isolation
  ON report_integrity_outbox FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY report_integrity_anchors_tenant_isolation
  ON report_integrity_anchors FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
