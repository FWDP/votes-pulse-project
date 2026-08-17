import { useMemo, useState, type ReactNode } from 'react'

import PageShell from '../components/PageShell'
import CoverageFilter from '../components/dashboard/CoverageFilter'
import { getUserSentimentData } from '../hooks/userSentimentData'
import type { GeographySelection } from '../types/geography'

type PriorityFilter = 'all' | 'high' | 'medium'

export default function KeyInsightsPage() {
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'
  const [geography, setGeography] = useState<GeographySelection>({
    region: '', province: '', district: '', locality: '',
  })
  const [period, setPeriod] = useState('30d')
  const [category, setCategory] = useState('all')
  const [priority, setPriority] = useState<PriorityFilter>('all')
  const { topics } = useMemo(
    () => getUserSentimentData(geography, period),
    [geography, period],
  )
  const insights = useMemo(
    () => [...topics]
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 8)
      .map((topic, index) => {
        const dominant = topic.negative >= topic.positive
          ? { label: 'negative', value: topic.negative, direction: '↓' }
          : { label: 'positive', value: topic.positive, direction: '↑' }

        return {
          topic,
          priority: (index < 4 ? 'high' : 'medium') as Exclude<PriorityFilter, 'all'>,
          dominant,
          title: `${topic.name} ${index < 4 ? 'requires close attention' : 'shows a noteworthy discussion pattern'}`,
          description: `${topic.name} generated ${topic.mentions.toLocaleString()} simulated mentions for the selected coverage. ${dominant.label[0].toUpperCase()}${dominant.label.slice(1)} sentiment is the largest directional share at ${dominant.value}%, with the remaining discussion split across neutral and opposing signals.`,
        }
      }),
    [topics],
  )
  const visibleInsights = insights.filter(insight =>
    (category === 'all' || insight.topic.id === category) &&
    (priority === 'all' || insight.priority === priority)
  )
  const highCount = insights.filter(insight => insight.priority === 'high').length
  const mediumCount = insights.filter(insight => insight.priority === 'medium').length

  return (
    <PageShell title="Key Insights" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : 'Priority observations from the simulated research dataset'}>
      <div className="space-y-6">
        <CoverageFilter
          geography={geography}
          onGeographyChange={setGeography}
          period={period}
          onPeriodChange={setPeriod}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InsightMetric value={highCount} title="High-Priority Observations" description="Findings warranting immediate attention or follow-up" color="text-red-600" />
          <InsightMetric value={mediumCount} title="Medium-Priority Observations" description="Noteworthy patterns for monitoring or context" color="text-amber-700" />
          <InsightMetric value={insights.length} title="Total Research Insights" description={`Across ${insights.length} leading topic categories`} color="text-slate-700" />
        </div>

        <section aria-label="Insight filters" className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter insights by category">
            <FilterButton selected={category === 'all'} onClick={() => setCategory('all')}>All</FilterButton>
            {insights.map(insight => (
              <FilterButton key={insight.topic.id} selected={category === insight.topic.id} onClick={() => setCategory(insight.topic.id)}>
                {insight.topic.shortName}
              </FilterButton>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter insights by priority">
            {([
              ['all', 'All Priorities'],
              ['high', 'High Priority'],
              ['medium', 'Medium'],
            ] as const).map(([value, label]) => (
              <FilterButton key={value} selected={priority === value} onClick={() => setPriority(value)} accent>
                {label}
              </FilterButton>
            ))}
          </div>
        </section>

        <div className="space-y-4" aria-live="polite">
          {visibleInsights.map(insight => {
            const TopicIcon = insight.topic.icon
            const high = insight.priority === 'high'
            const positive = insight.dominant.label === 'positive'

            return (
              <article key={insight.topic.id} className={`rounded-xl border p-5 shadow-sm ${high ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-white'}`}>
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <TopicIcon size={17} className="text-slate-800" aria-hidden="true" />
                    {insight.topic.name}
                  </div>
                  <div className="flex gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {insight.dominant.direction} {insight.dominant.label} · {insight.dominant.value}%
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${high ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                      {high ? 'High Priority' : 'Medium'}
                    </span>
                  </div>
                </header>
                <h2 className="mt-4 text-base font-bold text-slate-800">{insight.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{insight.description}</p>
              </article>
            )
          })}

          {visibleInsights.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              No placeholder insights match the selected filters.
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}

function InsightMetric({ value, title, description, color }: { value: number; title: string; description: string; color: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <strong className={`text-3xl font-black tabular-nums ${color}`}>{value}</strong>
      <h2 className="mt-2 text-sm font-bold text-slate-800">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </article>
  )
}

function FilterButton({ selected, onClick, accent = false, children }: { selected: boolean; onClick: () => void; accent?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${selected
        ? accent
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-slate-800 bg-slate-800 text-white'
        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}
    >
      {children}
    </button>
  )
}
