BEGIN;

CREATE TABLE IF NOT EXISTS field_report_topic_categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

INSERT INTO field_report_topic_categories (id, tenant_id, name, sort_order)
SELECT 'topic-' || seed.slug, tenant.id, seed.name, seed.sort_order
FROM tenants tenant
CROSS JOIN (VALUES
  ('public-services', 'Public Services', 10),
  ('infrastructure', 'Infrastructure', 20),
  ('health', 'Health', 30),
  ('education', 'Education', 40),
  ('livelihood-employment', 'Livelihood & Employment', 50),
  ('agriculture', 'Agriculture', 60),
  ('public-safety', 'Public Safety', 70),
  ('environment', 'Environment', 80),
  ('transportation', 'Transportation', 90),
  ('governance', 'Governance', 100),
  ('social-welfare', 'Social Welfare', 110),
  ('other', 'Other', 120)
) AS seed(slug, name, sort_order)
ON CONFLICT (tenant_id, name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  status = 'active';

COMMIT;
