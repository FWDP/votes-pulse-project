# VOTES Field Reports Mobile

Focused Expo/React Native client for collecting Field Reports and synchronizing them with the VOTES Web App.

## Foundation included

- Expo Router navigation with reports, new-report and profile screens
- Securely persisted prototype session
- Locally persisted reports and drafts
- Camera and photo-library evidence capture
- Foreground GPS capture
- Draft, queue, synchronization and retry states
- Shared Field Report contract from `../shared/fieldReports.ts`
- API boundary ready for authenticated backend integration

The app intentionally excludes dashboard analytics, election maps and administrative tools.

## Run locally

Install dependencies from this directory if they are not already present:

```bash
npm install
```

Start Expo from the repository root:

```bash
npm run mobile:start
```

Or launch Android directly:

```bash
npm run mobile:android
```

Without an API URL, the app runs in prototype mode. Use the prefilled login credentials; reports remain on the device.

## Connect to the backend

Copy the example environment configuration:

```bash
cp mobile/.env.example mobile/.env.local
```

Set `EXPO_PUBLIC_API_BASE_URL` to an address reachable by the device. `localhost` refers to the phone itself, so use the development computer's LAN address for a physical device.

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:8787
```

The mobile integration boundary expects:

```text
POST /api/mobile/session
GET  /api/reports
POST /api/reports
POST /api/reports/upload
GET  /api/reports/files/:filename
```

Only attachment upload/download currently exists in the backend. Session and report CRUD endpoints are intentionally the next integration phase; setting an API URL before those endpoints exist will make connected sign-in fail visibly instead of silently using prototype data.

## Verification

```bash
npm run mobile:type-check
npm --prefix mobile run doctor
```

## Data and privacy notes

- Attachments and coordinates may contain sensitive information.
- Do not collect names or identifiable statements without an approved purpose and consent flow.
- Production synchronization must authenticate every request, enforce tenant/coverage scope server-side, encrypt transport, and apply upload limits and retention rules.
