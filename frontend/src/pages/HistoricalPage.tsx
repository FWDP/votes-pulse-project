import React, { useEffect, useMemo, useState } from 'react'
import { topics } from './shared'
import { CalendarDays } from 'lucide-react'
import PageShell from '../components/PageShell'
import CoverageFilter from '../components/dashboard/CoverageFilter'
import LiveFeedPanel from '../components/dashboard/LiveFeedPanel'
import type { GeographySelection } from '../types/geography'
import { getAssignedGeographySelection, getCoverageLabel, useAuth } from '../contexts/AuthContext'
import { isSameGeography } from '../utils/geography'

export default function HistoricalPage() {
  const { user } = useAuth()
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'
  const [geography, setGeography] = useState<GeographySelection>(getAssignedGeographySelection(user))
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    if (!user?.homeLocation || user.isSuperadmin) return

    const assigned = getAssignedGeographySelection(user)
    setGeography(current => isSameGeography(current, assigned) ? current : assigned)
  }, [user])

  const historicalEvents = useMemo(() => {
    const baseEvents = [
      ['May 2022', 'National and local election period', 2847, 33],
      ['Jun 2022', 'Administration transition', 1382, 27],
      ['Oct 2022', 'Severe-weather response', 2341, 58],
      ['Oct 2023', 'Barangay and youth election period', 1342, 26],
      ['Nov 2023', 'Regional disaster-response discussion', 1456, 36],
      ['Feb 2025', 'National campaign period', 1876, 32],
      ['May 2025', 'National and local election period', 3456, 35],
      ['Nov 2025', 'Flooding and recovery discussion', 1634, 36],
    ] as const
    const selectionKey = [
      geography.region,
      geography.province,
      geography.district,
      geography.locality,
      period,
    ].join('|')
    const seed = [...selectionKey].reduce(
      (total, character) => total + character.charCodeAt(0),
      0,
    )
    const multiplier = geography.locality
      ? 0.18
      : geography.province || geography.district
        ? 0.42
        : geography.region
          ? 0.7
          : 1

    return baseEvents.map(([date, title, mentions, negative], index) => ({
      date,
      title,
      mentions: Math.max(
        1,
        Math.round(mentions * multiplier * (0.94 + ((seed + index) % 13) / 100)),
      ),
      negative: Math.min(75, Math.max(12, negative + ((seed + index) % 7) - 3)),
    }))
  }, [geography, period])
  const historicalSummary = useMemo(() => {
    const selectionKey = [
      geography.region || 'national',
      geography.province || 'all-provinces',
      geography.district || 'all-districts',
      geography.locality || 'all-localities',
      period,
    ].join('|')
    const seed = [...selectionKey].reduce(
      (total, character, index) =>
        (total + character.charCodeAt(0) * (index + 1)) % 10_000,
      0,
    )
    const roundOne = (value: number) => Math.round(value * 10) / 10
    const firstRaceA = roundOne(39 + (seed % 91) / 10)
    const firstRaceB = roundOne(28 + (Math.floor(seed / 7) % 75) / 10)
    const firstRaceOther = roundOne(100 - firstRaceA - firstRaceB)
    const secondRaceA = roundOne(44 + (Math.floor(seed / 11) % 91) / 10)
    const secondRaceB = roundOne(26 + (Math.floor(seed / 13) % 70) / 10)
    const secondRaceOther = roundOne(100 - secondRaceA - secondRaceB)

    return {
      turnout: roundOne(69 + (seed % 135) / 10),
      races: [
        {
          title: 'Illustrative provincial race',
          labels: ['Candidate A', 'Candidate B', 'Others'],
          values: [firstRaceA, firstRaceB, firstRaceOther],
          colors: ['#4885ee', '#ee9c32', '#a9b8b5'],
        },
        {
          title: 'Illustrative city race',
          labels: ['Candidate C', 'Candidate D', 'Others'],
          values: [secondRaceA, secondRaceB, secondRaceOther],
          colors: ['#be185d', '#7c3aed', '#a9b8b5'],
        },
      ],
      priorities: topics.slice(0, 5).map(([label, value], index) => ({
        label,
        value: Math.min(
          94,
          Math.max(18, value + ((seed + index * 7) % 15) - 7),
        ),
      })),
    }
  }, [geography, period])

  return (
    <PageShell title="Historical Context" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : getCoverageLabel(user)}>
      <div className="space-y-4">
        <CoverageFilter
          geography={geography}
          onGeographyChange={setGeography}
          period={period}
          onPeriodChange={setPeriod}
        />

        <LiveFeedPanel title="Historical Activity Feed" locationLabel={getCoverageLabel(user) || 'Selected coverage'} />

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="history-banner">
            <CalendarDays />
            <div>
              <h3>2025 National & Local Elections</h3>
              <p>Historical election results provide context only and are never presented as current voting intention.</p>
            </div>
            <strong>{historicalSummary.turnout}% simulated turnout</strong>
          </div>

          <div className="demo-two-col mt-6">
            {historicalSummary.races.map(race => {
              const firstStop = race.values[0]
              const secondStop = race.values[0] + race.values[1]

              return (
                <section key={race.title}>
                  <h3>{race.title}</h3>
                  <div
                    className="history-donut"
                    role="img"
                    aria-label={race.labels.map((label, index) =>
                      `${label} ${race.values[index]} percent`
                    ).join(', ')}
                    style={{
                      background: `conic-gradient(${race.colors[0]} 0 ${firstStop}%, ${race.colors[1]} ${firstStop}% ${secondStop}%, ${race.colors[2]} ${secondStop}% 100%)`,
                    }}
                  />
                  <div className="candidate-legend">
                    {race.labels.map((label, index) => (
                      <span key={label}>{label} · {race.values[index]}%</span>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>

          <section className="mt-6">
            <h3>Election-period issue priorities</h3>
            {historicalSummary.priorities.map(priority => (
              <div className="history-priority" key={priority.label}>
                <span>{priority.label}</span>
                <i style={{ width: `${priority.value}%` }} />
                <strong>{priority.value}%</strong>
              </div>
            ))}
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Historical Events Timeline
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Illustrative reference events and simulated discussion signals for the selected coverage.
              </p>
            </div>
            <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Placeholder events
            </span>
          </div>

          <ol className="relative mt-5 ml-2 border-l border-slate-200">
            {historicalEvents.map(event => (
              <li
                key={`${event.date}-${event.title}`}
                className="relative grid grid-cols-1 gap-2 py-3 pl-6 text-sm sm:grid-cols-[90px_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4"
              >
                <span className="absolute -left-[5px] top-5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500" />
                <time className="font-mono text-xs text-slate-500">
                  {event.date}
                </time>
                <strong className="font-semibold text-slate-700">
                  {event.title}
                </strong>
                <span className="text-xs tabular-nums text-slate-500">
                  {event.mentions.toLocaleString()} simulated mentions
                </span>
                <span className="text-xs font-semibold tabular-nums text-red-600">
                  {event.negative}% negative
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </PageShell>
  )
}
