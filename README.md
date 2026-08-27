# votes-pulse

PULSE is a public-opinion intelligence dashboard designed to combine social listening, survey, historical election and community field data across the Philippines.

## Current prototype

- Nationwide geographic-intelligence overview
- Administrative and electoral viewing modes
- Cascading location-ready filter architecture
- Sentiment, issue momentum and regional coverage views
- Transparent demo-data and confidence indicators
- Responsive desktop/mobile interface
- NVIDIA-independent browser application
- Authenticated web and Expo Field Reports workflow
- Stellar/Soroban-backed integrity verification for reports and reusable VOTES artifacts

All figures are illustrative. The next data milestone is integration with the PSA Philippine Standard Geographic Code (PSGC), followed by a separately versioned congressional-district mapping.

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite client on port 5173 and the API on port 8787. Vite proxies requests under `/api` to the local API. Configure an external API base in `.env` using `VITE_API_BASE_URL`, for example `https://your-api.example.com`.

## Field Reports mobile prototype

The focused Expo/React Native client lives in [`mobile/`](mobile/README.md). It provides the Field Reports foundation and core device workflow without duplicating the Web App dashboard.

```bash
npm --prefix mobile install
npm run mobile:start
```

The mobile app runs with local prototype persistence by default. Configure `EXPO_PUBLIC_API_BASE_URL` to enable authenticated synchronization with the Field Reports review queue in the Web App. For PostgreSQL-backed environments, run `npm run db:migrate` before starting the API.

## Stellar and Soroban integrity

VOTES uses Stellar Soroban as a privacy-preserving verification layer. PostgreSQL remains the operational source of truth; only opaque random keys, revision numbers, schema versions, and SHA-256 commitments are written on-chain. Report text, identities, locations, filenames, and attachment contents remain off-chain.

Current Stellar features:

- Authorized Rust/Wasm integrity registry with separate administrator and writer roles
- Immutable field-report submission anchors and server-generated attachment hashes
- Ordered evidence revisions and review attestations with contract-enforced previous-hash validation
- Transactional PostgreSQL outbox, non-blocking submissions, atomic worker claims, exponential retries, and manual retry controls
- Confirmed transaction hashes, ledger sequences, Stellar Expert links, and integrity-chain validation in web and mobile views
- Superadmin audit trail containing every successfully confirmed field-report revision and attestation
- Scheduled persistent-storage TTL renewal plus manual Superadmin TTL maintenance
- Direct contract-state reconciliation for missing or mismatched on-chain records
- Durable operational incidents, queue health, reconciliation health, and optional authenticated webhook alerts
- Cursor-based Soroban event ingestion with event-ID deduplication and PostgreSQL retention
- Local file-mounted signer support and an HTTPS remote-signing boundary suitable for a KMS/HSM service
- Explicit Mainnet approval and local-Mainnet-signer safety guards
- Fail-closed Mainnet validation for network/passphrase, HTTPS RPC, contract address, deployment ledger, separate admin/writer identities, remote signer tokens, alerts, TTL, and reconciliation
- Startup verification that the RPC network, deployed contract administrator, and contract writer match the approved configuration
- Durable submitted-transaction recovery that polls the original hash after uncertain RPC responses instead of creating duplicate anchors
- Retryable alert-delivery outbox and bounded multi-page event backlog draining with retention-gap detection
- Privacy-safe verification receipts at `/verify/:receipt`
- A reusable artifact registry for survey schemas and batches, dataset snapshots, social-listening batches, analytics snapshots, AI attestations, configuration approvals, export manifests, administrative audits, and release approvals
- Tenant isolation, Superadmin-only operational APIs, Docker-persistent uploads, automated migrations, contract tests, and CI release gates

The reusable artifact endpoint accepts either a JSON payload for deterministic server-side hashing or an existing lowercase SHA-256 digest for files and external datasets. Public artifact verification must be explicitly enabled per artifact; private artifacts remain available only to authorized operators.

See [`docs/soroban-integrity.md`](docs/soroban-integrity.md) for configuration, API routes, privacy boundaries, operational controls, and deployment gates. Contract deployment details are in [`contracts/README.md`](contracts/README.md).

### Mainnet release checks

Mainnet uses the standalone [`compose.mainnet.yaml`](compose.mainnet.yaml); it disables prototype authentication and local signer material, mounts remote-signer and alert tokens as secrets, runs migrations first, and checks `/api/readiness` rather than basic process health.

Start by copying `backend/.env.mainnet.example` to the ignored `backend/.env.mainnet`, then replace every placeholder and keep the two mounted token files outside the repository.

```bash
npm run contract:build
npm run integrity:estimate-cost
NODE_ENV=production npm run integrity:mainnet-check
docker compose -f compose.mainnet.yaml up --build -d
```

`integrity:mainnet-check` fails closed until the reviewed Wasm hash, deployment transaction, security review, cost report, production tokens, database migration, Mainnet RPC, contract writer, and separate administrator all validate. It does not deploy or approve Mainnet automatically.

## Run the API with Docker

Create the backend environment file and add your PSA PSGC token:

```bash
cp backend/.env.example backend/.env
```

```dotenv
PSA_PSGC_TOKEN=your-token
PSA_PSGC_VERSION=Q2_2024
```

Build and start the API in the background:

```bash
docker compose up --build -d api
```

Compose runs the idempotent database migration service before starting the API, including the integrity outbox, audit, artifact, incident, reconciliation, and event-ingestion tables.

On Linux, the API service uses host networking so a `DATABASE_URL` containing
`localhost:5432` connects to PostgreSQL running on the host. PostgreSQL remains
bound to loopback and is not exposed to other devices on the network.
The local Compose service explicitly enables the prototype mobile account; omit
`MOBILE_AUTH_PROTOTYPE_ONLY` from real production deployments.

Verify the container and the regions endpoint:

```bash
docker compose ps
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:8787/api/geography/regions
```

The existing Vite development server will continue to proxy `/api` requests to the container on port 8787. View logs or stop the service with:

```bash
docker compose logs -f api
docker compose down
```

## Production data model

Administrative geography and electoral geography must remain separate:

- Administrative: country → region → province/HUC → city or municipality → barangay
- Electoral: election cycle → congressional district → member localities/barangays

Every geographic record should carry stable IDs, official codes, effective dates, source version and boundary provenance.

## Data sources

The implementation-ready source and ingestion policy is documented in [`docs/data-sources.md`](docs/data-sources.md). The application-facing registry lives in [`src/data/sourceCatalog.ts`](src/data/sourceCatalog.ts).

Prefer official APIs, bulk downloads and publisher-provided feeds. Public visibility alone does not authorize scraping; each connector requires a terms, robots, licensing, privacy and retention review.
