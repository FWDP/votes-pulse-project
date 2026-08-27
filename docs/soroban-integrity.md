# Soroban integrity platform

VOTES/PULSE uses Soroban as an asynchronous, privacy-preserving integrity rail. PostgreSQL remains the operational source of truth. The chain receives only an opaque random key, revision number, schema version, and SHA-256 content digest.

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
- `PUT /api/reports/:id/evidence` creates a chained evidence revision; reporter or superadmin only.
- `POST /api/reports/:id/integrity/retry` requeues a terminal failure; superadmin only.
- `POST /api/reports/:id/integrity/extend-ttl` extends the latest anchor TTL; superadmin only.
- `GET /api/reports/integrity/health` returns configuration state, pending depth, failure depth, and oldest pending time; superadmin only.
- `GET /api/reports/integrity/audit` returns confirmed report, evidence, and review anchors; superadmin only.

The normal report submission endpoint returns immediately after the report and outbox are committed. Stellar submission never blocks mobile synchronization.

## Operations

- Configure `STELLAR_INTEGRITY_ALERT_WEBHOOK_URL` to deliver persisted submission and reconciliation incidents to the production alert receiver.
- Keep the signer funded with Testnet XLM for the pilot and XLM on Mainnet only after a release review.
- Treat `failed` jobs as requiring operator review before retry.
- Rotate the writer on compromise; the admin identity should be held separately for production.
- Persistent entries are extended when anchored and read; the scheduled TTL worker renews both report and reusable artifact anchors.

## Phase 3–5 foundation status

Implemented repository foundation:

- Immutable revision chaining and contract-side previous-hash validation.
- Automatic review attestations when report status changes.
- Integrity history and chain validation in the web report detail view.
- Admin/writer rotation, future Wasm upgrade hook, and manual plus scheduled TTL maintenance.
- File-mounted signer support and a CI release gate.
- A v2 Testnet deployment verified through the backend SDK.
- Intentional evidence revisions with chained report hashes and reporter/superadmin authorization.
- Scheduled TTL maintenance with configurable cadence, batch size, and health alerts.
- A remote signing-service boundary for KMS/HSM-backed production keys.
- Superadmin operational health and a Stellar-confirmed field report audit trail.
- Docker-persistent uploads and a read-only signer mount.
- Contract-state reconciliation that detects missing and mismatched anchors.
- Durable incident records with an optional authenticated alert webhook.
- Durable, cursor-based Soroban event ingestion with event-ID deduplication.
- Mainnet approval and local-signer deployment guards.
- Privacy-safe public verification receipts at `/verify/:receipt`.
- A generalized artifact registry for survey schemas/batches, dataset snapshots, social batches, analytics, AI attestations, configuration approvals, exports, admin audits, and releases.
- Fail-closed Mainnet configuration validation and live startup checks for RPC passphrase, administrator, and writer.
- Pre-broadcast transaction-hash persistence with timeout/uncertain-result recovery.
- Public receipt verification that reads and compares every revision directly from Soroban.
- Versioned artifact commitment envelopes binding artifact type, external ID, schema version, and subject SHA-256.
- Retryable alert delivery, paginated event backlog draining, and RPC-retention gap detection.
- A production Compose template and executable Mainnet readiness/cost-estimation commands.

## General integrity API

- `POST /api/integrity/artifacts` creates or revises a typed integrity artifact; superadmin only. Supply a JSON `payload` for server-side canonical hashing or a lowercase SHA-256 `contentHash` for a file or external dataset.
- `GET /api/integrity/artifacts` lists the latest artifact revisions; superadmin only.
- `GET /api/integrity/artifacts/:type/:externalId` returns an artifact revision chain; superadmin only.
- `GET /api/integrity/incidents` returns unresolved reconciliation and submission incidents; superadmin only.
- `POST /api/integrity/reconcile` starts a manual reconciliation batch; superadmin only.
- `GET /api/verify/:receipt` returns privacy-safe proof metadata. Artifact receipts must explicitly use `visibility: "public"`; field-report receipts are unguessable capability links and expose no report content.

Set `STELLAR_INTEGRITY_EVENT_START_LEDGER` to the contract deployment ledger before the first production start. Leaving it at `0` starts ingestion at the current ledger and does not reconstruct older events.

## Mainnet gate

Build the exact release candidate and record its output:

```bash
npm run contract:build
npm run integrity:estimate-cost
NODE_ENV=production npm run integrity:mainnet-check
```

The readiness command checks the public network/passphrase, HTTPS endpoints, contract address, remote signer, distinct administrator, mounted authentication tokens, event deployment ledger, required workers, alerting, reviewed Wasm hash, deployment transaction, security-review reference, cost-report reference, database migration, RPC-reported network, and deployed contract roles. Any missing or mismatched item returns a nonzero exit code.

Current undeployed Mainnet candidate Wasm SHA-256: `4ffd8b15ce098262f91dafd54c7eb59398624b43b1b65929d15d41e16be6f12d`.

On 2026-08-27, five read-only Testnet simulations against the deployed v2 anchor interface each reported a minimum resource fee of `51,836` stroops. This is a development measurement, not a substitute for the recorded production load/cost report required by the Mainnet gate.

Remaining external release gates:

- External contract review, recorded production load/cost measurements, webhook receiver configuration, and Mainnet approval.
- Provision the production KMS/HSM signing service and separate admin/writer identities.
- Choose and operate the long-term event/archive retention system; PostgreSQL ingestion is implemented.
- Demo recording and release sign-off.

The remaining items are deliberately not represented as code-complete: an independent security review cannot be self-certified by the implementation; cloud KMS/HSM provisioning requires the selected provider and production account; Mainnet activation requires organizational approval; and demo/release sign-off requires the release owners. The application-side signing boundary, safety guards, alert delivery, event archive, and verification mechanisms needed to support those activities are implemented.
