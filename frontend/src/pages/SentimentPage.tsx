import PageShell from '../components/PageShell'
import SentimentContent from '../components/content/SentimentContent'
import AiInsightPanel from '../components/dashboard/AiInsightPanel'
import { getCoverageLabel, useAuth } from '../contexts/AuthContext'

export default function SentimentPage() {
  const { user } = useAuth()

  return (
    <PageShell title="Sentiment Analysis" subtitle={getCoverageLabel(user)}>
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <SentimentContent />
        </div>
      </div>
    </PageShell>
  )
}
