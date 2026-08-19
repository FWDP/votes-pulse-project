import {
  lazy,
  Suspense,
  type ReactNode,
} from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import AdminLayout from './layouts/AdminLayout'
import LoginPage from './pages/LoginPage'
import {
  loadDataScopePage,
  loadFieldReportsPage,
  loadHistoricalPage,
  loadIssuesPage,
  loadKeyInsightsPage,
  loadLocationPage,
  loadOverviewPage,
  loadPulseApp,
  loadSentimentPage,
  loadTimelinePage,
} from './routeLoaders'

const PulseApp = lazy(loadPulseApp)
const OverviewPage = lazy(loadOverviewPage)
const SentimentPage = lazy(loadSentimentPage)
const IssuesPage = lazy(loadIssuesPage)
const LocationPage = lazy(loadLocationPage)
const TimelinePage = lazy(loadTimelinePage)
const HistoricalPage = lazy(loadHistoricalPage)
const KeyInsightsPage = lazy(loadKeyInsightsPage)
const DataScopePage = lazy(loadDataScopePage)
const FieldReportsPage = lazy(loadFieldReportsPage)
const SessionsPage = lazy(() => import('./pages/admin/SessionsPage'))
const ExportsPage = lazy(() => import('./pages/admin/ExportsPage'))
const RolesPage = lazy(() => import('./pages/admin/RolesPage'))
const SuperadminsPage = lazy(() => import('./pages/admin/SuperadminsPage'))

function RouteLoader() {
  return (
    <div
      className="flex min-h-48 items-center justify-center text-sm text-slate-500"
      role="status"
    >
      Loading page…
    </div>
  )
}

function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RouteLoader />}>
      {children}
    </Suspense>
  )
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<LazyRoute><PulseApp /></LazyRoute>}
      />
        <Route
          path="login"
          element={<LazyRoute><PulseApp /></LazyRoute>}
        />
        <Route
          path="login/votes"
          element={<LoginPage product="votes" />}
        />
        <Route
          path="login/pulse"
          element={<LoginPage product="pulse" />}
        />
        <Route path="pulse" element={<DashboardLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<LazyRoute><OverviewPage /></LazyRoute>} />
          <Route path="sentiment" element={<LazyRoute><SentimentPage /></LazyRoute>} />
          <Route path="issues" element={<LazyRoute><IssuesPage /></LazyRoute>} />
          <Route path="location" element={<LazyRoute><LocationPage /></LazyRoute>} />
          <Route path="timeline" element={<LazyRoute><TimelinePage /></LazyRoute>} />
          <Route path="historical" element={<LazyRoute><HistoricalPage /></LazyRoute>} />
          <Route path="insights" element={<LazyRoute><KeyInsightsPage /></LazyRoute>} />
          <Route path="datascope" element={<LazyRoute><DataScopePage /></LazyRoute>} />
          <Route path="fieldreports" element={<LazyRoute><FieldReportsPage /></LazyRoute>} />
        </Route>
          <Route path="admin" element={<AdminLayout />}>
            <Route path="roles" element={<LazyRoute><RolesPage /></LazyRoute>} />
            <Route path="sessions" element={<LazyRoute><SessionsPage /></LazyRoute>} />
            <Route path="exports" element={<LazyRoute><ExportsPage /></LazyRoute>} />
            <Route path="superadmins" element={<LazyRoute><SuperadminsPage /></LazyRoute>} />
          </Route>

          <Route path="votes/admin" element={<AdminLayout />}>
            <Route path="roles" element={<LazyRoute><RolesPage /></LazyRoute>} />
            <Route path="sessions" element={<LazyRoute><SessionsPage /></LazyRoute>} />
            <Route path="exports" element={<LazyRoute><ExportsPage /></LazyRoute>} />
            <Route path="superadmins" element={<LazyRoute><SuperadminsPage /></LazyRoute>} />
          </Route>

        <Route path="votes" element={<DashboardLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<LazyRoute><OverviewPage /></LazyRoute>} />
          <Route path="sentiment" element={<LazyRoute><SentimentPage /></LazyRoute>} />
          <Route path="issues" element={<LazyRoute><IssuesPage /></LazyRoute>} />
          <Route path="location" element={<LazyRoute><LocationPage /></LazyRoute>} />
          <Route path="timeline" element={<LazyRoute><TimelinePage /></LazyRoute>} />
          <Route path="historical" element={<LazyRoute><HistoricalPage /></LazyRoute>} />
          <Route path="insights" element={<LazyRoute><KeyInsightsPage /></LazyRoute>} />
          <Route path="datascope" element={<LazyRoute><DataScopePage /></LazyRoute>} />
          <Route path="fieldreports" element={<LazyRoute><FieldReportsPage /></LazyRoute>} />
        </Route>
    </Routes>
  )
}
