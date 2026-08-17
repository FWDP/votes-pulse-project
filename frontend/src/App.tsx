import {
  lazy,
  Suspense,
  type ReactNode,
} from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import {
  loadDataScopePage,
  loadFieldReportsPage,
  loadHistoricalPage,
  loadIssuesPage,
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
const DataScopePage = lazy(loadDataScopePage)
const FieldReportsPage = lazy(loadFieldReportsPage)

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
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<LazyRoute><PulseApp /></LazyRoute>}
        />
        <Route path="pulse" element={<DashboardLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<LazyRoute><OverviewPage /></LazyRoute>} />
          <Route path="sentiment" element={<LazyRoute><SentimentPage /></LazyRoute>} />
          <Route path="issues" element={<LazyRoute><IssuesPage /></LazyRoute>} />
          <Route path="location" element={<LazyRoute><LocationPage /></LazyRoute>} />
          <Route path="timeline" element={<LazyRoute><TimelinePage /></LazyRoute>} />
          <Route path="historical" element={<LazyRoute><HistoricalPage /></LazyRoute>} />
          <Route path="datascope" element={<LazyRoute><DataScopePage /></LazyRoute>} />
          <Route path="fieldreports" element={<LazyRoute><FieldReportsPage /></LazyRoute>} />
        </Route>

        <Route path="votes" element={<DashboardLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<LazyRoute><OverviewPage /></LazyRoute>} />
          <Route path="sentiment" element={<LazyRoute><SentimentPage /></LazyRoute>} />
          <Route path="issues" element={<LazyRoute><IssuesPage /></LazyRoute>} />
          <Route path="location" element={<LazyRoute><LocationPage /></LazyRoute>} />
          <Route path="timeline" element={<LazyRoute><TimelinePage /></LazyRoute>} />
          <Route path="historical" element={<LazyRoute><HistoricalPage /></LazyRoute>} />
          <Route path="datascope" element={<LazyRoute><DataScopePage /></LazyRoute>} />
          <Route path="fieldreports" element={<LazyRoute><FieldReportsPage /></LazyRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
