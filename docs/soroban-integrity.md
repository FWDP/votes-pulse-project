# Soroban report-integrity implementation

PULSE uses Soroban as an asynchronous, privacy-preserving integrity rail for Field Reports. PostgreSQL remains the operational source of truth. The chain receives only an opaque random report key, revision number, schema version, and SHA-256 content digest.

## Implemented scope

- Rust/Wasm `ReportIntegrityRegistry` contract with authorized writes, immutable revision keys, persistent storage, TTL extension, events, and writer rotation.
- Chained review attestations that bind each review decision to the previous digest.
- Admin rotation, writer rotation, guarded Wasm upgrades, and explicit TTL maintenance.
- Deterministic `pulse-field-report-integrity/v1` manifest and SHA-256 hashing.
- Server-generated SHA-256 hashes for uploaded attachment bytes.
- PostgreSQL transactional outbox and anchor ledger.
- Background worker with atomic job claims, stale-job recovery, exponential retry, and terminal failure state.
- Tenant-scoped integrity lookup, manual retry, and queue-health APIs.
- Dashboard and mobile integrity status; confirmed dashboard entries link to Stellar Expert.
- Dedicated Stellar Testnet deployment and successful anchor transaction.

## Privacy boundary

The contract never receives report text, human-readable report IDs, tenant/workspace IDs, names, email addresses, coordinates, filenames, URLs, or attachment contents. The canonical manifest remains off-chain. Operational fields such as assignment, review status, sync status, retries, and errors are excluded from the immutable evidence digest.

## Local configuration

1. Run `npm run db:migrate`.
2. Build and test with `npm run contract:test` and `npm run contract:build`.
3. Use the Testnet contract ID from `backend/.env.example`, or deploy a new instance as described in `contracts/README.md`.
4. Prefer `STELLAR_INTEGRITY_SIGNER_SECRET_FILE` with a read-only mounted secret. `STELLAR_INTEGRITY_SIGNER_SECRET` remains available for local development. The signer address must equal the contract's configured writer.
5. Set `STELLAR_INTEGRITY_ENABLED=true` and restart the API.

Never commit the signer secret. For the project-specific local CLI identity, an authorized developer can retrieve it directly with `stellar keys secret votes-pulse-integrity` and place it into their secret manager.

## APIs

- `GET /api/reports/:id/integrity` recomputes the current off-chain digest and reports whether it matches a confirmed anchor.
- `POST /api/reports/:id/integrity/retry` requeues a terminal failure; superadmin only.
- `POST /api/reports/:id/integrity/extend-ttl` extends the latest anchor TTL; superadmin only.
- `GET /api/reports/integrity/health` returns configuration state, pending depth, failure depth, and oldest pending time; superadmin only.

The normal report submission endpoint returns immediately after the report and outbox are committed. Stellar submission never blocks mobile synchronization.

## Operations

- Alert when `oldestPendingAt` exceeds five minutes or `failed` is non-zero.
- Keep the signer funded with Testnet XLM for the pilot and XLM on Mainnet only after a release review.
- Treat `failed` jobs as requiring operator review before retry.
- Rotate the writer on compromise; the admin identity should be held separately for production.
- Persistent entries are extended when anchored and read. Add a scheduled TTL sweep before Mainnet if reports must remain immediately readable indefinitely.

## Phase 3–5 foundation status

Implemented now:

- Immutable revision chaining and contract-side previous-hash validation.
- Automatic review attestations when report status changes.
- Integrity history and chain validation in the web report detail view.
- Admin/writer rotation, future Wasm upgrade hook, and manual TTL maintenance.
- File-mounted signer support and a CI release gate.
- A v2 Testnet deployment verified through the backend SDK.

Remaining for the next implementation session:

- Evidence-editing UX that intentionally creates a new `report` revision.
- Scheduled batching of TTL maintenance instead of the manual operator endpoint.
- Production KMS/HSM adapter and separate production admin/writer identities.
- External contract review, load/cost measurements, alerts, and Mainnet approval.
- Final UI polish, operational dashboard, demo recording, and release sign-off.
