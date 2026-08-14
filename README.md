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

All figures are illustrative. The next data milestone is integration with the PSA Philippine Standard Geographic Code (PSGC), followed by a separately versioned congressional-district mapping.

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite client on port 5173 and the cached source service on port 8787. Copy `.env.example` to `.env` and provide `PSA_PSGC_TOKEN` to activate the official PSGC connector.

## Production data model

Administrative geography and electoral geography must remain separate:

- Administrative: country → region → province/HUC → city or municipality → barangay
- Electoral: election cycle → congressional district → member localities/barangays

Every geographic record should carry stable IDs, official codes, effective dates, source version and boundary provenance.

## Data sources

The implementation-ready source and ingestion policy is documented in [`docs/data-sources.md`](docs/data-sources.md). The application-facing registry lives in [`src/data/sourceCatalog.ts`](src/data/sourceCatalog.ts).

Prefer official APIs, bulk downloads and publisher-provided feeds. Public visibility alone does not authorize scraping; each connector requires a terms, robots, licensing, privacy and retention review.
