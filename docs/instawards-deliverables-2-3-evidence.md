# Instawards Deliverables 2 and 3 evidence

Validation date: 2026-08-27  
Validated commit: `65f543e3f7cfad8e32989d8f3a461d2d493e01a0`

This evidence uses synthetic records only. It contains no survey responses, respondent identities, contact information, device identifiers, locations, or political profiles.

## Deliverable 2 — Backend integrity pipeline and reusable artifacts

### Release validation

`npm run test:release` completed successfully against an isolated PostgreSQL 18 database after all migrations from `001_init.sql` through `011_integrity_archive_chain.sql` were applied.

- Field-report service tests: 7 passed, 0 failed.
- Integrity application and database tests: 17 passed, 0 failed.
- Soroban contract tests: 9 passed, 0 failed.
- Web and server TypeScript checks: passed.
- Mobile TypeScript check: passed.
- Production web build: passed.

The integrity suite includes transactional report/outbox persistence, deterministic hashing and privacy boundaries, revision and attestation chaining, generalized artifact commitments, Merkle proofs, provenance commitments, signed publisher attestations, fail-closed release gates, and Mainnet configuration safeguards.

### Synthetic survey-batch Testnet evidence

- Artifact type: `survey-batch`
- External ID: `instawards-evidence-20260827`
- Records: 3 synthetic records
- Contains real respondent data: `false`
- Soroban contract: `CCSUQUHI3U25WIZFDODQDC7T4MGKRVAIXVQVIITESQDFYAGMQ6J5KFFA`
- Receipt: `a492416d8b10e3562acc87ea7567058abb4b2863951ac16d2caf5863a55b16f3`
- Content commitment: `49c98e02b983e3761a4d672cb1e0bc52729cb47bb07b1a24fcfe97462b6e63df`
- Subject commitment: `74b2480e84bfeec2baaf4e9500eb3476b7fd6ddd2f4e607f1a7aadc5edd9faf3`
- Merkle root: `9318bf636ff3e19a36fe35392188cdfae36943f946e5cfb057c89f15dbab4468`
- Transaction: `4b32160067dbf6236b4ce2f84c0c6644b8bd96020c92f1dcdf91770ead9b6738`
- Ledger: `4358892`
- Horizon evidence: <https://horizon-testnet.stellar.org/transactions/4b32160067dbf6236b4ce2f84c0c6644b8bd96020c92f1dcdf91770ead9b6738>
- Stellar Expert: <https://stellar.expert/explorer/testnet/tx/4b32160067dbf6236b4ce2f84c0c6644b8bd96020c92f1dcdf91770ead9b6738>

The public verification endpoint returned:

- `verified: true`
- `chainValid: true`
- `onChainVerified: true`
- `network: testnet`
- `artifactType: survey-batch`

### Record-level Merkle inclusion proof

Proof for synthetic leaf index 1:

- Algorithm: `sha256-domain-v1`
- Leaf hash: `736a01197da41864cde3417ccbe52bda6738a3e398e16bad866956002321aebb`
- Left sibling: `403d44fab0b5b593cf657c67e71a8a5e818307fed9af6753c5ed1b0fdf60504e`
- Right sibling: `5b022684e4a8323055c112c0efe0a06166bcc8aa43693f8c90420a35d235a1ef`
- Reconstructed root: `9318bf636ff3e19a36fe35392188cdfae36943f946e5cfb057c89f15dbab4468`

## Deliverable 3 — Verification UX and readiness controls

The isolated Testnet API readiness response reported:

- `ready: true`
- Database configured: yes
- Stellar enabled and configured: yes
- Network: Testnet
- Integrity worker started: yes
- Configuration errors: none

The production build emitted the lazy-loaded `VerifyIntegrityPage` bundle, and the public receipt API independently re-read the committed revision from Soroban before reporting it as verified.

Mainnet remains intentionally excluded. `npm run integrity:mainnet-check` returns `ready: false` until the external security review, production RPC and contract deployment, remote signing infrastructure, fee payer, alert/archive receivers, production load/cost report, and approved multi-party release gate are supplied.

## Evidence limitation and next capture

The generated receipt is stored in the isolated validation database used for this run. The Testnet transaction is permanent, but a durable public V.O.T.E.S. receipt URL and final browser screenshot must be captured after the same artifact is created through the persistent PostgreSQL service or another reviewer-accessible deployment.
