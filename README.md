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

`npm run dev` starts the Vite client on port 5173 and the API on port 8787. Vite proxies requests under `/api` to the local API. Configure an external API base in `.env` using `VITE_API_BASE_URL`, for example `https://your-api.example.com`.

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
