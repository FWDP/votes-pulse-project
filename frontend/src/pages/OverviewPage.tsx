import OverviewContent from '../components/content/OverviewContent'
import PageShell from '../components/PageShell';
import { getCoverageLabel, useAuth } from '../contexts/AuthContext'

export default function OverviewPage() {
  const { user } = useAuth()

  return (
    <PageShell title="Overview" subtitle={getCoverageLabel(user)}>
      <OverviewContent />
    </PageShell>
  )
}
