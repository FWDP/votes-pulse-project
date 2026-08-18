import { useEffect, useMemo, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import PageShell from '../components/PageShell'
import CoverageFilter from '../components/dashboard/CoverageFilter'
import { getPlaceholderTimeline } from '../data/placeholderTimeline'
import type { GeographySelection } from '../types/geography'
import { getAssignedGeographySelection, getCoverageLabel, useAuth } from '../contexts/AuthContext'
import { isSameGeography } from '../utils/geography'

type MetricMode = 'volume' | 'sentiment' | 'netScore'

const METRICS: Array<{ value: MetricMode; label: string }> = [
  { value: 'volume', label: 'Volume' },
  { value: 'sentiment', label: 'Sentiment %' },
  { value: 'netScore', label: 'Net Score' },
]

export default function TimelinePage() {
  const { user } = useAuth()
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'
  const [geography, setGeography] = useState<GeographySelection>(getAssignedGeographySelection(user))
  const [period, setPeriod] = useState('30d')
  const [metric, setMetric] = useState<MetricMode>('volume')

  useEffect(() => {
    if (!user?.homeLocation || user.isSuperadmin) return

    const assigned = getAssignedGeographySelection(user)
    setGeography(current => isSameGeography(current, assigned) ? current : assigned)
  }, [user])
  const timeline = useMemo(
    () => getPlaceholderTimeline(geography, period),
    [geography, period],
  )
  const metricLabel = METRICS.find(item => item.value === metric)?.label ?? 'Volume'

  return (
    <PageShell title="Timeline" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : getCoverageLabel(user)}>
      <div className="space-y-6">
        <CoverageFilter
          geography={geography}
          onGeographyChange={setGeography}
          period={period}
          onPeriodChange={setPeriod}
        />

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {timeline.intervalLabel} Mention Volume
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {timeline.points[0]?.label} – {timeline.points.at(-1)?.label} · {timeline.points.length} data points
              </p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Timeline metric">
              {METRICS.map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMetric(item.value)}
                  aria-pressed={metric === item.value}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${metric === item.value
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </header>

          <div className="mt-5 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline.points} margin={{ top: 10, right: 18, left: 4, bottom: 8 }}>
                <defs>
                  <linearGradient id="timelineArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis
                  domain={metric === 'netScore' ? [-60, 60] : ['auto', 'auto']}
                  tickFormatter={value => metric === 'volume' ? Number(value).toLocaleString() : `${value}%`}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={value => [
                  metric === 'volume' ? Number(value ?? 0).toLocaleString() : `${value}%`,
                  metricLabel,
                ]} />
                {timeline.events.map(event => (
                  <ReferenceLine
                    key={`${event.date}-${event.event}`}
                    x={event.label}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                  />
                ))}
                <Area
                  type="monotone"
                  dataKey={metric}
                  name={metricLabel}
                  stroke="#2563eb"
                  strokeWidth={2.25}
                  fill="url(#timelineArea)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <p className="mt-3 text-xs text-amber-700">
            Dashed amber lines mark simulated key events. Hover over the chart for details.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <header>
            <h2 className="text-sm font-bold text-slate-800">Volume vs Negative Sentiment</h2>
            <p className="mt-1 text-xs text-slate-500">
              Compare changes in discussion volume with the negative share.
            </p>
          </header>

          <div className="mt-5 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline.points} margin={{ top: 10, right: 12, left: 4, bottom: 8 }}>
                <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis yAxisId="volume" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="negative" orientation="right" domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend />
                <Line yAxisId="volume" type="monotone" dataKey="volume" name="Volume" stroke="#2563eb" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
                <Line yAxisId="negative" type="monotone" dataKey="negative" name="Negative %" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800">Key Events Timeline</h2>
          <ol className="relative mt-5 ml-2 border-l border-slate-200">
            {timeline.events.map(event => (
              <li
                key={`${event.date}-${event.event}`}
                className="relative grid grid-cols-1 gap-2 py-3 pl-6 text-sm sm:grid-cols-[90px_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4"
              >
                <span className="absolute -left-[5px] top-5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500" />
                <time className="font-mono text-xs text-slate-500" dateTime={event.date}>{event.label}</time>
                <strong className="font-semibold text-slate-700">{event.event}</strong>
                <span className="text-xs tabular-nums text-slate-500">{event.volume.toLocaleString()} mentions</span>
                <span className="text-xs font-semibold tabular-nums text-red-600">{event.negative}% negative</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </PageShell>
  )
}
