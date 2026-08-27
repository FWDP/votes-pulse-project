BEGIN;

ALTER TABLE report_integrity_outbox
  ADD COLUMN IF NOT EXISTS anchor_type TEXT NOT NULL DEFAULT 'report';
ALTER TABLE report_integrity_outbox
  ADD COLUMN IF NOT EXISTS previous_hash TEXT;
ALTER TABLE report_integrity_outbox
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE report_integrity_anchors
  ADD COLUMN IF NOT EXISTS anchor_type TEXT NOT NULL DEFAULT 'report';
ALTER TABLE report_integrity_anchors
  ADD COLUMN IF NOT EXISTS previous_hash TEXT;
ALTER TABLE report_integrity_anchors
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE report_integrity_anchors
  ADD COLUMN IF NOT EXISTS ttl_extended_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE report_integrity_outbox
    ADD CONSTRAINT report_integrity_outbox_anchor_type
    CHECK (anchor_type IN ('report', 'review-attestation'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE report_integrity_anchors
    ADD CONSTRAINT report_integrity_anchors_anchor_type
    CHECK (anchor_type IN ('report', 'review-attestation'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE report_integrity_outbox
    ADD CONSTRAINT report_integrity_outbox_previous_hash
    CHECK (previous_hash IS NULL OR length(previous_hash) = 64);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE report_integrity_anchors
    ADD CONSTRAINT report_integrity_anchors_previous_hash
    CHECK (previous_hash IS NULL OR length(previous_hash) = 64);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_report_integrity_anchors_ttl
  ON report_integrity_anchors (ttl_extended_at NULLS FIRST, confirmed_at)
  WHERE status = 'confirmed';

COMMIT;
