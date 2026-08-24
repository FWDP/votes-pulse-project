BEGIN;

-- Brands / companies table for PULSE
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  search_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMIT;
