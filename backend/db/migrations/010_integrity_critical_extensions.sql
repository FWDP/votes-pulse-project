BEGIN;

ALTER TABLE integrity_artifact_anchors
  DROP CONSTRAINT IF EXISTS integrity_artifact_anchors_artifact_type_check;
ALTER TABLE integrity_artifact_anchors
  ADD CONSTRAINT integrity_artifact_anchors_artifact_type_check CHECK (artifact_type IN (
    'survey-schema', 'survey-batch', 'dataset-snapshot', 'social-batch',
    'analytics-snapshot', 'ai-attestation', 'configuration-approval',
    'export-manifest', 'admin-audit', 'release-approval',
    'publisher-attestation', 'release-gate'
  ));

ALTER TABLE integrity_artifact_anchors
  ADD COLUMN IF NOT EXISTS provenance JSONB;
ALTER TABLE integrity_artifact_anchors
  ADD COLUMN IF NOT EXISTS provenance_hash TEXT;

DO $$ BEGIN
  ALTER TABLE integrity_artifact_anchors
    ADD CONSTRAINT integrity_artifact_provenance_hash
    CHECK (provenance_hash IS NULL OR length(provenance_hash) = 64);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS integrity_merkle_manifests (
  artifact_anchor_id TEXT PRIMARY KEY REFERENCES integrity_artifact_anchors(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  algorithm TEXT NOT NULL DEFAULT 'sha256-domain-v1',
  root_hash TEXT NOT NULL CHECK (length(root_hash) = 64),
  leaf_hashes JSONB NOT NULL,
  leaf_count INTEGER NOT NULL CHECK (leaf_count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integrity_publisher_attestations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  subject_artifact_id TEXT NOT NULL REFERENCES integrity_artifact_anchors(id) ON DELETE CASCADE,
  attestation_artifact_id TEXT NOT NULL UNIQUE REFERENCES integrity_artifact_anchors(id) ON DELETE CASCADE,
  attestor_public_key TEXT NOT NULL,
  organization TEXT NOT NULL,
  statement_hash TEXT NOT NULL CHECK (length(statement_hash) = 64),
  signature TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_artifact_id, attestor_public_key)
);

CREATE TABLE IF NOT EXISTS integrity_release_gates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  external_id TEXT NOT NULL,
  subject_artifact_id TEXT NOT NULL REFERENCES integrity_artifact_anchors(id),
  required_approvals INTEGER NOT NULL CHECK (required_approvals > 0),
  allowed_approver_keys JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked')),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, workspace_id, external_id)
);

CREATE TABLE IF NOT EXISTS integrity_release_gate_approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  gate_id TEXT NOT NULL REFERENCES integrity_release_gates(id) ON DELETE CASCADE,
  attestation_id TEXT NOT NULL UNIQUE REFERENCES integrity_publisher_attestations(id) ON DELETE CASCADE,
  approver_public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gate_id, approver_public_key)
);

CREATE TABLE IF NOT EXISTS integrity_event_archive_outbox (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES integrity_contract_events(id) ON DELETE CASCADE,
  network TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  ledger_sequence INTEGER NOT NULL,
  payload JSONB NOT NULL,
  previous_chain_hash TEXT CHECK (previous_chain_hash IS NULL OR length(previous_chain_hash) = 64),
  chain_hash TEXT NOT NULL UNIQUE CHECK (length(chain_hash) = 64),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivering', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrity_archive_ready
  ON integrity_event_archive_outbox (status, available_at, ledger_sequence);
CREATE INDEX IF NOT EXISTS idx_integrity_attestation_subject
  ON integrity_publisher_attestations (subject_artifact_id, created_at);
CREATE INDEX IF NOT EXISTS idx_integrity_release_gate_status
  ON integrity_release_gates (tenant_id, workspace_id, status, created_at);

ALTER TABLE integrity_merkle_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_publisher_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_release_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_release_gate_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY integrity_merkle_manifests_tenant_isolation
  ON integrity_merkle_manifests FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY integrity_publisher_attestations_tenant_isolation
  ON integrity_publisher_attestations FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY integrity_release_gates_tenant_isolation
  ON integrity_release_gates FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY integrity_release_gate_approvals_tenant_isolation
  ON integrity_release_gate_approvals FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
