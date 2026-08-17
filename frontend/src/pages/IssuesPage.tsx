import {
  useMemo,
  useState,
} from 'react'
import PageShell from '../components/PageShell'
import CoverageFilter from '../components/dashboard/CoverageFilter'
import IssueTermExplorer from '../components/issues/IssueTermExplorer'
import TopicMomentum from '../components/issues/TopicMomentum'
import {
  getUserSentimentData,
} from '../hooks/userSentimentData'
import type {
  GeographySelection,
} from '../types/geography'

export default function IssuesPage() {
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'
  const [geography, setGeography] = useState<GeographySelection>({
    region: '',
    province: '',
    district: '',
    locality: '',
  })
  const [period, setPeriod] = useState('30d')
  const { topics, isPlaceholder } = useMemo(
    () => getUserSentimentData(geography, period),
    [geography, period],
  )

  return (
    <PageShell title="Key Issues & Topics" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : 'National Pulse'}>
      <div className="space-y-6">
        <CoverageFilter
          geography={geography}
          onGeographyChange={setGeography}
          period={period}
          onPeriodChange={setPeriod}
        />

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Key issues & topics</h2>
              <p className="mt-1 text-xs text-slate-500">
                Ranked topic volume and sentiment for the selected coverage.
              </p>
            </div>

            {isPlaceholder && (
              <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Placeholder data
              </span>
            )}
          </header>

          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[48px_minmax(220px,1.4fr)_110px_minmax(220px,1fr)_145px] gap-4 bg-slate-50 px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <span>#</span>
                <span>Topic</span>
                <span>Volume</span>
                <span>Sentiment</span>
                <span>Momentum</span>
              </div>

              {topics.map((topic, index) => {
                const TopicIcon = topic.icon
                const dominant = [
                  { label: 'Positive', value: topic.positive, className: 'text-green-600' },
                  { label: 'Neutral', value: topic.neutral, className: 'text-slate-500' },
                  { label: 'Negative', value: topic.negative, className: 'text-red-500' },
                ].sort((a, b) => b.value - a.value)[0]

                return (
                  <div
                    key={topic.id}
                    className="grid grid-cols-[48px_minmax(220px,1.4fr)_110px_minmax(220px,1fr)_145px] items-center gap-4 border-t border-slate-100 px-5 py-3.5 text-sm"
                  >
                    <span className="font-semibold text-slate-400">{index + 1}</span>
                    <span className="flex items-center gap-2 font-semibold text-slate-700">
                      <TopicIcon
                        size={17}
                        className="shrink-0 text-slate-700"
                        aria-hidden="true"
                      />
                      {topic.name}
                    </span>
                    <span className="tabular-nums text-slate-600">{topic.mentions.toLocaleString()}</span>
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs">
                        <span className={dominant.className}>{dominant.label}</span>
                        <span className="font-semibold text-slate-600">{dominant.value}%</span>
                      </div>
                      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <span className="bg-green-500" style={{ width: `${topic.positive}%` }} />
                        <span className="bg-slate-400" style={{ width: `${topic.neutral}%` }} />
                        <span className="bg-red-500" style={{ width: `${topic.negative}%` }} />
                      </div>
                    </div>
                    <TopicMomentum
                      label={topic.name}
                      values={topic.momentum}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <IssueTermExplorer topics={topics} />
      </div>
    </PageShell>
  )
}
