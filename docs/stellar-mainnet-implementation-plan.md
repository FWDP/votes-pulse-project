# Stellar/Soroban Mainnet implementation plan

Status date: 2026-08-27  
Current decision: **NO-GO until every P0 gate below has evidence and the automated readiness check passes.**

This plan covers the work that remains after the application-side Mainnet safeguards were implemented. It is an operational release plan, not an instruction to put secrets in the repository. PostgreSQL remains the operational source of truth; Stellar is the integrity and verification rail.

## What is already implemented

- Fail-closed Mainnet configuration and runtime validation.
- A remote-signing boundary; the API does not need custody of the writer secret.
- Scoped auth-entry signing with a separate file-mounted fee payer; the writer no longer needs to sign complete transaction envelopes.
- Runtime validation that the administrator's Stellar account thresholds require the configured number of independent approvals.
- Hash-chained off-site event archive delivery, health reporting, and explicit state-restoration tooling.
- Provenance, Merkle batching, publisher attestations, and confirmed multi-party release-gate foundations.
- Separate contract administrator and writer checks.
- Transactional anchoring, uncertain-transaction recovery, reconciliation, TTL renewal, event ingestion, incident persistence, and alert delivery.
- Production Docker Compose configuration with file-mounted signer and alert tokens.
- Migration `009_integrity_mainnet_readiness.sql` and an executable `integrity:mainnet-check` gate.
- Contract tests, strict Rust linting, production application builds, and a reproducible optimized Wasm candidate.

Release candidate Wasm SHA-256:

```text
5759c354225fbf8754e8e8ec87f36e87776f4a5d8cd429dac10afb2b2aa199d3
```

Any contract source or toolchain change invalidates this candidate. Rebuild, record the new hash, repeat the independent review, and update the controlled release record.

## Remaining blockers by priority

| Priority | Blocker | Completion evidence | Suggested owner |
| --- | --- | --- | --- |
| P0 | Independent contract/security review | Final report ID or immutable report URL approving the exact Wasm hash | Security reviewer |
| P0 | Production remote signer | KMS/HSM-backed auth-entry signing endpoint, writer public key, token mount, access policy, audit logs, and recovery test | Security/Platform |
| P0 | Threshold administrator custody | Admin public key different from writer/fee payer; at least the configured independent approvals; recovery procedure tested | Security/Release owner |
| P0 | Approved Mainnet RPC | HTTPS endpoint, availability/SLA decision, retention limits, and successful public-network validation | Platform |
| P0 | Production alert receiver | HTTPS authenticated webhook, mounted token, routing/escalation policy, and delivered test incident | Platform/Operations |
| P0 | Production load and cost report | Signed-off report covering anchor, revision, review, TTL, reconciliation, and backlog behavior | QA/Platform |
| P0 | Mainnet deployment approval | Recorded go/no-go approval tied to the reviewed Wasm hash and release commit | Release owner |
| P0 | Contract deployment and release record | Contract ID, transaction hash, deployment ledger, Wasm hash, RPC, admin, and writer recorded | Release owner |
| P1 | Long-term event/archive retention | Archive receiver connected to the implemented hash-chained delivery; retention period, restore procedure, and monitoring | Data/Platform |
| P1 | Production validation and rollback drill | Readiness, smoke tests, alert test, worker health, and stop/recovery procedure recorded | QA/Operations |
| P2 | Demo and final release sign-off | Demo recording, operator handoff, and named final approvers | Product/Release owner |

## Ordered implementation steps

### 1. Freeze and identify the release candidate — P0

1. Select the release commit and build from a clean checkout using the pinned project lockfiles/toolchain.
2. Run the complete release suite:

   ```bash
   npm run test:release
   npm run contract:build
   ```

3. Calculate the optimized Wasm SHA-256 and confirm it equals the candidate hash above.
4. Create a controlled release record containing the Git commit, build environment/tool versions, Wasm hash, build timestamp, and person who performed the build.
5. Freeze contract changes while review is in progress. Application changes that alter canonicalization, signing, authorization, recovery, or verification also require review.

Acceptance: the clean build is reproducible and the controlled release record identifies one exact commit and Wasm artifact.

### 2. Complete independent security review — P0

The review scope must include contract authorization, admin/writer rotation, upgrade authorization, immutable revision chaining, TTL behavior, event semantics, privacy of on-chain inputs, canonicalization, remote-signing requests, transaction recovery, and public verification.

1. Give the reviewer the exact source commit and candidate Wasm hash.
2. Track findings to closure. A risk acceptance must name its owner, rationale, and expiry/review date.
3. Record the final review reference as `STELLAR_INTEGRITY_SECURITY_REVIEW_ID`.
4. If remediation changes the contract or security-sensitive backend paths, return to step 1 and review the new artifact.

Acceptance: an independent reviewer approves the exact release candidate and no unresolved release-blocking finding remains.

### 3. Provision production identities and remote signing — P0

1. Create a dedicated Mainnet writer in an approved KMS/HSM or equivalent managed signing service. Do not export its secret into the API host, container, environment file, logs, or repository.
2. Create a separate administrator identity. Keep it offline or under an independently controlled multisignature policy. The administrator must not equal the writer.
3. Restrict the signing service to the expected VOTES transaction shape, public network passphrase, approved contract, service identity, and rate limits where supported.
4. Enable signer audit logs and alerts for denied, abnormal, and high-volume requests.
5. Mount the API authentication token as a read-only file and set:

   - `STELLAR_INTEGRITY_SIGNER_URL`
   - `STELLAR_INTEGRITY_SIGNER_PUBLIC_KEY`
   - `STELLAR_INTEGRITY_ADMIN_PUBLIC_KEY`
   - `STELLAR_SIGNER_TOKEN_HOST_FILE`

6. Test authentication failure, malformed payload rejection, successful signing in a non-production rehearsal, token rotation, service outage behavior, and recovery.

Acceptance: the API can request only authorized signatures; it has no writer/admin secret; admin and writer are distinct; rotation and recovery are demonstrated.

### 4. Provision RPC, alerting, database, and retention — P0/P1

1. Select an approved Stellar Mainnet RPC with HTTPS, sufficient history/retention for event ingestion, documented limits, and a failover decision.
2. Provision the production PostgreSQL database, backup policy, point-in-time recovery, monitoring, and restricted application credentials.
3. Provision an HTTPS alert receiver and mount its authentication token outside the repository. Route integrity incidents to an owned on-call/escalation path.
4. Define how PostgreSQL Soroban events and integrity audit records are archived after the operational retention window. Document restore and verification procedures.
5. Populate a protected copy of `backend/.env.mainnet` from `backend/.env.mainnet.example`. Leave approval false and deployment-specific fields empty until their corresponding gates are complete.
6. Apply migrations:

   ```bash
   npm run db:migrate
   ```

Acceptance: database recovery is tested, the alert receiver accepts an authenticated test, RPC reports the public network, and retention ownership is recorded.

### 5. Produce the Mainnet load and cost report — P0

The existing Testnet observation of five read-only simulations at `51,836` stroops each is only a baseline; it is not production approval evidence.

1. Rehearse against the reviewed contract interface with representative report anchors, evidence revisions, review attestations, TTL extensions, reconciliation reads, event backlog catch-up, RPC timeouts, and signer/alert failures.
2. Measure transaction resource fees, end-to-end confirmation latency, throughput, retry volume, database/outbox growth, RPC usage, signer load, alert latency, and recovery time.
3. Include normal load, expected peak, backlog recovery, and a documented safety margin.
4. Establish funding thresholds and alerts for the writer account. The admin account should not be used for routine submissions.
5. Record assumptions, sample size, results, projected monthly cost, capacity limit, and approver.
6. Store the approved report reference as `STELLAR_INTEGRITY_LOAD_TEST_REPORT`.

Acceptance: QA/Platform approve the capacity and cost envelope, and Operations accepts the funding and alert thresholds.

### 6. Hold the deployment go/no-go review — P0

Confirm all of the following before authorizing deployment:

- Release commit and Wasm hash are frozen and reviewed.
- Security findings are closed or formally accepted.
- Writer and administrator custody controls are tested and separate.
- RPC, database, alerting, retention, monitoring, funding, and on-call owners are ready.
- Load/cost report is approved.
- Deployment operator, observer, maintenance window, and stop conditions are named.

Create a `release-approval` artifact whose payload binds the release commit, reviewed Wasm hash, security review, load/cost report, intended RPC, administrator, writer, and fee payer. Create its multi-party gate, wait for the artifact, gate policy, and required approval attestations to confirm, then set `STELLAR_INTEGRITY_RELEASE_GATE_ID` and `STELLAR_INTEGRITY_RELEASE_SUBJECT_SHA256` from that exact record.

Only after approval, set `STELLAR_INTEGRITY_PUBLIC_DEPLOYMENT_APPROVED=true` in the protected production configuration. This flag records approval; it does not deploy anything.

Acceptance: named approvers record a GO decision tied to the exact release commit and Wasm hash.

### 7. Deploy the reviewed contract — P0

Use the reviewed Wasm, approved Mainnet RPC, designated deployment account, and the separate admin/writer public keys. The canonical command shape is maintained in `contracts/README.md`.

Immediately record:

- Contract ID.
- Deployment transaction hash.
- Deployment ledger sequence.
- Wasm SHA-256.
- Network passphrase and RPC provider.
- Administrator and writer public keys.
- Deployment time, operator, and release approval reference.

Set the following protected configuration values from that record:

- `STELLAR_INTEGRITY_CONTRACT_ID`
- `STELLAR_INTEGRITY_DEPLOYMENT_TRANSACTION`
- `STELLAR_INTEGRITY_EVENT_START_LEDGER` to the deployment ledger, never `0`
- `STELLAR_INTEGRITY_EXPECTED_WASM_SHA256`

Contract deployment is a public, durable action. If any returned value differs from the approved plan, stop before starting API workers and reconvene the release review.

Acceptance: Stellar Mainnet shows the deployment transaction, and read-only calls return the approved, distinct administrator and writer.

### 8. Pass the automated gate and start production — P0

Inject `backend/.env.mainnet` and both token files through the approved production secret mechanism. Run the check from the clean release workspace so the candidate Wasm is available:

```bash
NODE_ENV=production npm run integrity:mainnet-check
```

Do not continue unless the JSON result contains `"ready": true` and every check passes. Then start the production stack:

```bash
docker compose -f compose.mainnet.yaml up --build -d
docker compose -f compose.mainnet.yaml ps
```

Verify `/api/readiness` returns HTTP 200. Do not use `/api/health` as the release gate.

Acceptance: the automated gate passes, migration 011 is present, runtime contract roles and administrator thresholds match configuration, the multi-party release gate is approved, and the API is ready without local writer material.

### 9. Run production smoke tests and observation — P0/P1

Use synthetic, non-sensitive test data approved for production.

1. Submit a field report and confirm the API commits it without waiting for Stellar.
2. Confirm the outbox worker anchors it and records a transaction hash and ledger.
3. Add an evidence revision and review attestation; verify ordered previous-hash chaining.
4. Verify the receipt directly against Soroban and confirm no personal/report content appears on-chain.
5. Run reconciliation and confirm no mismatch or missing anchor.
6. Confirm event ingestion advances from the deployment ledger without a retention gap.
7. Trigger a controlled alert and verify receipt by the on-call destination.
8. Confirm TTL scheduling, queue depth, pending age, signer balance, RPC errors, incident count, database backups, and audit visibility.
9. Observe at heightened monitoring for the agreed release window before declaring stable.

Acceptance: all smoke evidence is attached to the release record and no unresolved critical incident exists.

### 10. Complete operational handoff and release sign-off — P1/P2

1. Assign owners for signer balance, token rotation, admin recovery, RPC incidents, failed jobs, reconciliation mismatches, TTL failures, event retention gaps, and database restore.
2. Record runbooks and escalation contacts in the controlled operations system.
3. Record a demo covering submission, confirmed anchor, verification, Superadmin audit, reconciliation, and incident handling.
4. Obtain Product, Security, Platform/Operations, QA, and release-owner sign-off.

Acceptance: ownership is explicit, operators can execute the recovery procedures, and final release approval is recorded.

## Stop and recovery rules

- Before contract deployment: stop the release, keep `STELLAR_INTEGRITY_PUBLIC_DEPLOYMENT_APPROVED=false`, fix the blocker, and rerun the gate.
- After deployment but before API start: do not submit writes. Correct configuration or deploy a newly approved instance if the deployed roles/artifact are wrong; never silently substitute an unreviewed contract.
- After API start: stop the API workers for wrong-network, wrong-contract, authorization, unexpected upgrade, privacy, or chain-mismatch incidents. Preserve PostgreSQL/outbox state and transaction evidence for recovery; do not delete or manually rewrite audit rows.
- For an uncertain submission: allow the implemented recovery path to poll the persisted transaction hash. Do not create a replacement transaction manually unless the incident runbook proves the original cannot land.
- For writer compromise: stop workers, invoke the separately controlled admin rotation procedure, rotate signer credentials/tokens, reconcile state, and obtain incident approval before resuming.

## Final release checklist

- [ ] Exact release commit and Wasm hash recorded.
- [ ] Independent security review approved and referenced.
- [ ] KMS/HSM writer and separate administrator controls tested.
- [ ] Approved HTTPS Mainnet RPC configured.
- [ ] Authenticated alert receiver and escalation path tested.
- [ ] Production database migration, backup, and restore verified.
- [ ] Event/archive retention and recovery ownership accepted.
- [ ] Production load/cost report approved and referenced.
- [ ] Mainnet deployment GO approval recorded.
- [ ] Contract ID, transaction, ledger, roles, and Wasm hash recorded.
- [ ] `STELLAR_INTEGRITY_EVENT_START_LEDGER` equals the deployment ledger.
- [ ] `NODE_ENV=production npm run integrity:mainnet-check` returns `ready: true`.
- [ ] `/api/readiness` returns HTTP 200 after startup.
- [ ] Synthetic anchor, revision, attestation, receipt, reconciliation, event, TTL, and alert smoke tests pass.
- [ ] Monitoring window completes without an unresolved critical incident.
- [ ] Operational handoff, demo, and final sign-off are complete.

Mainnet is ready only when every P0 item is complete and evidenced. P1 items must be complete before normal production operation; P2 closes the release process.
