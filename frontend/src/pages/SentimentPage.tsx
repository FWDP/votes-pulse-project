import PageShell from '../components/PageShell'
import SentimentContent from '../components/content/SentimentContent'
import SentimentFilter from '../components/sentiment/SentimentFilter'

export default function SentimentPage() {
  return (
    <PageShell title="Sentiment Analysis" subtitle="Positive, neutral, and negative patterns by topic">
      <div className="space-y-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <SentimentContent />
        </div>
      </div>
    </PageShell>
  )
}
