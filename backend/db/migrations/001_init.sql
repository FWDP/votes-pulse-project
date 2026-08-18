-- Phase 4 initial schema: tenants, users, workspaces, memberships, sessions, field_reports
BEGIN;

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT,
  status TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique ON tenants (slug);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  job_title TEXT,
  status TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT,
  name TEXT,
  product TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_workspace_slug ON workspaces (tenant_id, slug);

-- Memberships
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT,
  status TEXT,
  workspace_ids JSONB,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_user_unique ON memberships (tenant_id, user_id);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Field reports
CREATE TABLE IF NOT EXISTS field_reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  title TEXT,
  observation TEXT,
  topic TEXT,
  region TEXT,
  province TEXT,
  district TEXT,
  location TEXT,
  locality_type TEXT,
  submitted_at DATE,
  submitted_by TEXT,
  created_by_user_id TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);
CREATE INDEX IF NOT EXISTS idx_field_reports_tenant_workspace_created_at ON field_reports (tenant_id, workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_field_reports_tenant_status ON field_reports (tenant_id, status);

-- Row level security for defense in depth.
ALTER TABLE field_reports ENABLE ROW LEVEL SECURITY;
-- Policy: application must set `app.current_tenant_id` GUC before queries.
CREATE POLICY tenant_isolation ON field_reports FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Optional: migration marker table
CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
