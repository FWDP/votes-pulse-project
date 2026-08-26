BEGIN;

CREATE TABLE IF NOT EXISTS integrity_contract_events (
  id TEXT PRIMARY KEY,
  network TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  ledger_sequence INTEGER NOT NULL,
  ledger_closed_at TIMESTAMPTZ NOT NULL,
  transaction_hash TEXT NOT NULL,
  event_type TEXT NOT NULL,
  topics_xdr JSONB NOT NULL,
  value_xdr TEXT NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrity_contract_events_ledger
  ON integrity_contract_events (network, contract_id, ledger_sequence, id);

CREATE TABLE IF NOT EXISTS integrity_event_cursors (
  network TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  cursor TEXT NOT NULL,
  latest_ledger INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (network, contract_id)
);

COMMIT;
