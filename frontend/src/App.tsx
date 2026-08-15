import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PulseApp from './PulseApp'
import OverviewPage from './pages/OverviewPage'
import SentimentPage from './pages/SentimentPage'
import IssuesPage from './pages/IssuesPage'
import LocationPage from './pages/LocationPage'
import TimelinePage from './pages/TimelinePage'
import HistoricalPage from './pages/HistoricalPage'
import DataScopePage from './pages/DataScopePage'
import FieldReportsPage from './pages/FieldReportsPage'
import DashboardLayout from './layouts/DashboardLayout'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PulseApp />} />
        <Route path="pulse" element={<DashboardLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="sentiment" element={<SentimentPage />} />
          <Route path="issues" element={<IssuesPage />} />
          <Route path="location" element={<LocationPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="historical" element={<HistoricalPage />} />
          <Route path="datascope" element={<DataScopePage />} />
          <Route path="fieldreports" element={<FieldReportsPage />} />
        </Route>

        <Route path="votes" element={<DashboardLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="sentiment" element={<SentimentPage />} />
          <Route path="issues" element={<IssuesPage />} />
          <Route path="location" element={<LocationPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="historical" element={<HistoricalPage />} />
          <Route path="datascope" element={<DataScopePage />} />
          <Route path="fieldreports" element={<FieldReportsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
