import { useEffect, useMemo, useState, type ReactNode } from 'react'

import PageShell from '../components/PageShell'
import CoverageFilter from '../components/dashboard/CoverageFilter'
import LiveFeedPanel from '../components/dashboard/LiveFeedPanel'
import AiInsightPanel from '../components/dashboard/AiInsightPanel'
import { getUserSentimentData } from '../hooks/userSentimentData'
import type { GeographySelection } from '../types/geography'
import { getDominantSentiment } from '../utils/sentiment'
import { getAssignedGeographySelection, getCoverageLabel, useAuth } from '../contexts/AuthContext'
import { isSameGeography } from '../utils/geography'

type PriorityFilter = 'all' | 'high' | 'medium'

export default function KeyInsightsPage() {
  const { user } = useAuth()
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'
  const [geography, setGeography] = useState<GeographySelection>(getAssignedGeographySelection(user))
  const [period, setPeriod] = useState('30d')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    if (!user?.homeLocation || user.isSuperadmin) return

    const assigned = getAssignedGeographySelection(user)
    setGeography(current => isSameGeography(current, assigned) ? current : assigned)
  }, [user])
  const [priority, setPriority] = useState<PriorityFilter>('all')
  const { topics } = useMemo(
    () => getUserSentimentData(geography, period),
    [geography, period],
  )
  const insights = useMemo(
    () => [...topics]
      .map(topic => ({
        topic,
        priorityScore: topic.mentions * (1 + topic.negative / 100),
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 8)
      .map(({ topic, priorityScore }, index, ranked) => {
        const dominantSentiment = getDominantSentiment(topic)
        const dominant = {
          ...dominantSentiment,
          direction: dominantSentiment.key === 'positive'
            ? '↑'
            : dominantSentiment.key === 'negative'
              ? '↓'
              : '→',
        }
        const insightPriority = index < Math.ceil(ranked.length / 2)
          ? 'high'
          : 'medium'
        const titleSuffix = insightPriority === 'high'
          ? 'requires close attention'
          : dominant.key === 'positive'
            ? 'shows a positive signal worth sustaining'
            : dominant.key === 'neutral'
              ? 'remains a mixed discussion area'
              : 'shows a noteworthy discussion pattern'

        return {
          topic,
          priorityScore,
          priority: insightPriority as Exclude<PriorityFilter, 'all'>,
          dominant,
          title: `${topic.name} ${titleSuffix}`,
          description: `${topic.name} generated ${topic.mentions.toLocaleString()} simulated mentions for the selected coverage. ${dominant.label} sentiment is the largest share at ${dominant.value}% (${topic.positive}% positive, ${topic.neutral}% neutral, and ${topic.negative}% negative).`,
        }
      }),
    [topics],
  )
  const categoryInsights = insights.filter(insight =>
    category === 'all' || insight.topic.id === category
  )
  const visibleInsights = categoryInsights.filter(insight =>
    priority === 'all' || insight.priority === priority
  )
  const highCount = categoryInsights.filter(insight => insight.priority === 'high').length
  const mediumCount = categoryInsights.filter(insight => insight.priority === 'medium').length

  const aiInsightContext = useMemo(() => {
    const totalPositive = topics.reduce((sum, topic) => sum + topic.positive, 0)
    const totalNeutral = topics.reduce((sum, topic) => sum + topic.neutral, 0)
    const totalNegative = topics.reduce((sum, topic) => sum + topic.negative, 0)

    return {
      coverageLabel: getCoverageLabel(user) || 'Selected coverage',
      periodLabel: period,
      sentiment: {
        positive: Math.round(totalPositive / Math.max(topics.length, 1)),
        neutral: Math.round(totalNeutral / Math.max(topics.length, 1)),
        negative: Math.round(totalNegative / Math.max(topics.length, 1)),
      },
      topics: topics.slice(0, 5).map(topic => ({
        name: topic.name,
        mentions: topic.mentions,
        positive: topic.positive,
        neutral: topic.neutral,
        negative: topic.negative,
      })),
      insights: [
        {
          title: 'Monitoring priority',
          description: 'The current insight set shows the most prominent issue clusters for the selected coverage.',
        },
      ],
    }
  }, [period, topics, user])

  return (
    <PageShell title="Key Insights" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : getCoverageLabel(user)}>
      <div className="space-y-6">
        <CoverageFilter
          geography={geography}
          onGeographyChange={setGeography}
          period={period}
          onPeriodChange={setPeriod}
        />

        <AiInsightPanel
          title="Insights AI Brief"
          context={aiInsightContext}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InsightMetric value={highCount} title="High-Priority Observations" description="Findings warranting immediate attention or follow-up" color="text-red-600" selected={priority === 'high'} onClick={() => setPriority(priority === 'high' ? 'all' : 'high')} />
          <InsightMetric value={mediumCount} title="Medium-Priority Observations" description="Noteworthy patterns for monitoring or context" color="text-amber-700" selected={priority === 'medium'} onClick={() => setPriority(priority === 'medium' ? 'all' : 'medium')} />
          <InsightMetric value={categoryInsights.length} title="Total Research Insights" description={`Across ${categoryInsights.length} matching topic categories`} color="text-slate-700" selected={priority === 'all'} onClick={() => setPriority('all')} />
        </div>

        <LiveFeedPanel title="Key Insights Feed" locationLabel={getCoverageLabel(user) || 'Selected coverage'} />

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
            const high = insight.priority === 'high'
            const sentimentClasses = insight.dominant.key === 'positive'
              ? 'bg-green-100 text-green-700'
              : insight.dominant.key === 'negative'
                ? 'bg-red-100 text-red-700'
                : 'bg-slate-200 text-slate-700'

            return (
              <article
                key={insight.topic.id}
                className={`rounded-xl border px-6 py-5 ${high ? 'border-red-200 bg-red-50/70' : 'border-amber-300 bg-white'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3 pt-0.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${high ? 'bg-red-500' : 'bg-amber-500'}`}
                      aria-hidden="true"
                    />
                    {insight.topic.shortName}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-bold leading-none ${sentimentClasses}`}>
                      {insight.dominant.direction} {insight.dominant.label.toLowerCase()}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-bold leading-none ${high ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                      {high ? 'High Priority' : 'Medium'}
                    </span>
                  </div>
                </div>
                <h2 className="mt-4 text-base font-bold leading-6 text-slate-800">{insight.title}</h2>
                <p className="mt-2 max-w-none text-sm leading-6 text-slate-600">{insight.description}</p>
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

function InsightMetric({ value, title, description, color, selected, onClick }: { value: number; title: string; description: string; color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${selected ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200'}`}
    >
      <strong className={`text-3xl font-black tabular-nums ${color}`}>{value}</strong>
      <h2 className="mt-2 text-sm font-bold text-slate-800">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </button>
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
