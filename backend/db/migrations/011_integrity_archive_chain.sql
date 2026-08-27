BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrity_archive_single_successor
  ON integrity_event_archive_outbox (
    network,
    contract_id,
    COALESCE(previous_chain_hash, '')
  );

COMMIT;
