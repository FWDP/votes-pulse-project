# VOTES Field Reports Mobile

Focused Expo/React Native client for collecting Field Reports and synchronizing them with the VOTES Web App.

## Foundation included

- Expo Router navigation with reports, new-report and profile screens
- Securely persisted prototype session
- Locally persisted reports and drafts
- Camera and photo-library evidence capture
- Foreground GPS capture
- Draft, queue, synchronization and retry states
- Outbox multi-select for sending only chosen drafts or failed reports
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

These commands explicitly use Expo Go, avoiding an outdated custom development client after native dependencies change.

Run Expo and EAS commands from `mobile/`, not from the repository root. The root project is the Vite Web App and does not contain a React Native `App.tsx` entrypoint.

```bash
cd mobile
npx expo start --go --android
npx eas-cli build --profile development --platform android
```

To use a custom development client, install the latest development APK produced by EAS, then run:

```bash
npm run mobile:android:dev-client
```

Rebuild and reinstall that client after adding or upgrading a native Expo module. An older client can otherwise fail with errors such as `Cannot find native module 'ExpoLinking'` even when the JavaScript dependency is installed.

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
GET  /api/reports/recipients
POST /api/reports
POST /api/reports/upload
GET  /api/reports/files/:filename
PATCH /api/reports/:id
```

These endpoints are implemented. When PostgreSQL is configured, apply the Field Reports migration before starting the connected client:

```bash
npm run db:migrate
```

Database users authenticate with their seeded password. In non-production environments, `field@example.test` with the configured `MOBILE_PROTOTYPE_PASSWORD` remains available as a development fallback. The fallback is disabled automatically in production.

Submitted reports upload evidence first, synchronize idempotently using `clientId`, and appear in the Web App Field Reports review queue. Queued or failed reports retry when network connectivity returns.
Reporters can select an authorized web recipient from their current tenant/workspace; the API validates the selection and assigns the synchronized report to that account.
They can submit immediately or save multiple reports to the Outbox, select the reports to send, and synchronize only that batch.
Locally saved drafts can be reopened, edited, submitted, or permanently deleted from the Report Detail screen.
In prototype mode, the Web App synchronizes its managed-user registry to the backend so the mobile recipient selector mirrors the accounts shown in Web administration. Superadmins are excluded from the recipient selector because they already have global Field Report visibility.
The report register is sourced from the live API. The mobile app stores only genuine drafts and queued/failed submissions locally; bundled demonstration reports are not used.

## Verification

```bash
npm run mobile:type-check
npm --prefix mobile run doctor
npm run test:reports
```

## Data and privacy notes

- Attachments and coordinates may contain sensitive information.
- Do not collect names or identifiable statements without an approved purpose and consent flow.
- Production synchronization must authenticate every request, enforce tenant/coverage scope server-side, encrypt transport, and apply upload limits and retention rules.
