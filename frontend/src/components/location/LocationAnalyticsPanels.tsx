import {
    useMemo,
    useState,
} from 'react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

import type {
    GeographyUnit,
} from '../../types/geography'
import type {
    AdministrativeGroup,
} from './AdministrativeBreakdown'
import type { LocationSentimentMetric } from '../../types/sentiment'

interface LocationAnalyticsPanelsProps {
    groups: AdministrativeGroup[]
    loading: boolean
    metrics?: LocationSentimentMetric[]
    scopeName: string
    unitLevel: 'region' | 'locality'
    units: GeographyUnit[]
}

type SortMode = 'volume' | 'negative' | 'positive'

const GROUP_COLORS = [
    '#3b82f6',
    '#8b5cf6',
    '#f59e0b',
    '#10b981',
    '#ec4899',
    '#06b6d4',
]

const getOverall = (
    metric: LocationSentimentMetric,
) => {
    if (
        metric.positive >= metric.neutral &&
        metric.positive >= metric.negative
    ) return 'Positive'

    if (
        metric.negative >= metric.positive &&
        metric.negative >= metric.neutral
    ) return 'Negative'

    return 'Mixed'
}

const getTypeLabel = (unit: GeographyUnit) =>
    unit.geographic_level.trim().toLowerCase() === 'city'
        ? 'City'
        : 'Municipality'

export default function LocationAnalyticsPanels({
    groups,
    loading,
    metrics = [],
    scopeName,
    unitLevel,
    units,
}: LocationAnalyticsPanelsProps) {
    const [sortMode, setSortMode] = useState<SortMode>('volume')

    const rows = useMemo(() => {
        const metricByCode = new Map(
            metrics.map(metric => [metric.code, metric]),
        )

        return units.map(unit => {
            const groupIndex = groups.findIndex(group =>
                group.units.some(groupUnit => groupUnit.code === unit.code),
            )

            return {
                unit,
                metric: metricByCode.get(unit.code),
                groupName: groupIndex >= 0
                    ? groups[groupIndex].name
                    : getTypeLabel(unit),
                color: GROUP_COLORS[
                    (groupIndex >= 0 ? groupIndex : 0) % GROUP_COLORS.length
                ],
            }
        }).sort((a, b) => {
            if (!a.metric && !b.metric) {
                return a.unit.area_name.localeCompare(b.unit.area_name)
            }

            if (!a.metric) return 1
            if (!b.metric) return -1

            return sortMode === 'negative'
                ? b.metric.negative - a.metric.negative
                : sortMode === 'positive'
                    ? b.metric.positive - a.metric.positive
                    : b.metric.mentions - a.metric.mentions
        })
    }, [groups, metrics, sortMode, units])

    const chartData = rows
        .filter(row => row.metric)
        .map(row => ({
            name: row.unit.area_name
                .replace(/^City of /i, '')
                .replace(/^Municipality of /i, ''),
            mentions: row.metric?.mentions ?? 0,
            fill: row.color,
        }))
    const hasMetrics = chartData.length > 0
    const isRegional = unitLevel === 'region'

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">
                            {isRegional
                                ? 'Mention Volume by Region'
                                : 'Mention Volume by City / Municipality'}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                            {scopeName} · follows the current coverage selection
                        </p>
                    </div>

                    {!loading && (
                        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                            {hasMetrics ? 'Simulation data' : 'Awaiting metrics'}
                        </span>
                    )}
                </header>

                <div className="h-[300px] p-5">
                    {loading ? (
                        <div className="flex h-full items-center justify-center text-sm text-slate-500" role="status">
                            Loading location coverage…
                        </div>
                    ) : hasMetrics ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 8, right: 12, bottom: 54, left: 4 }}
                            >
                                <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    angle={-28}
                                    interval={0}
                                    textAnchor="end"
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    formatter={value => [
                                        Number(
                                            Array.isArray(value)
                                                ? value[0]
                                                : value ?? 0,
                                        ).toLocaleString(),
                                        'Mentions',
                                    ]}
                                />
                                <Bar dataKey="mentions" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-6 text-center">
                            <div className="max-w-md">
                                <p className="text-sm font-semibold text-slate-600">
                                    No location-level mention volume is available
                                </p>
                                <p className="mt-2 text-xs leading-5 text-slate-500">
                                    The chart will populate when verified sentiment records include a PSGC city or municipality code.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">
                            {isRegional
                                ? 'Regional Detail'
                                : 'City and Municipality Detail'}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Showing {units.length.toLocaleString()} official {isRegional ? 'regions' : 'LGUs'} · {scopeName}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Sort:</span>
                        {([
                            ['volume', 'Volume'],
                            ['negative', 'Negative %'],
                            ['positive', 'Positive %'],
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setSortMode(value)}
                                disabled={!hasMetrics}
                                className={`rounded px-2.5 py-1 font-medium ${
                                    sortMode === value && hasMetrics
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-500'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="overflow-x-auto">
                    <table className="min-w-[980px] w-full border-collapse text-left">
                        <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-5 py-3">
                                    {isRegional ? 'Region' : 'City / Municipality'}
                                </th>
                                <th className="px-5 py-3">
                                    {isRegional ? 'Island Group' : 'Division'}
                                </th>
                                <th className="px-5 py-3 text-right">Mentions</th>
                                <th className="px-5 py-3">Overall</th>
                                <th className="px-5 py-3">Sentiment breakdown</th>
                                <th className="px-5 py-3">Top concern</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                                        Loading official LGUs…
                                    </td>
                                </tr>
                            )}

                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                                        No LGUs are available for this selection.
                                    </td>
                                </tr>
                            )}

                            {!loading && rows.map(row => {
                                const overall = row.metric
                                    ? getOverall(row.metric)
                                    : null

                                return (
                                    <tr key={row.unit.code} className="text-xs text-slate-600">
                                        <td className="px-5 py-4">
                                            <p className="font-semibold text-slate-800">
                                                {row.unit.area_name}
                                            </p>
                                            <p className="mt-0.5 text-[10px] text-slate-400">
                                                PSGC {row.unit.code}
                                            </p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-flex items-center gap-2">
                                                <span
                                                    className="h-2 w-2 rounded-full"
                                                    style={{ backgroundColor: row.color }}
                                                />
                                                {row.groupName}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right font-mono text-slate-700">
                                            {row.metric
                                                ? row.metric.mentions.toLocaleString()
                                                : '—'}
                                        </td>
                                        <td className="px-5 py-4">
                                            {overall ? (
                                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                                    overall === 'Positive'
                                                        ? 'bg-green-100 text-green-700'
                                                        : overall === 'Negative'
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {overall}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">Unavailable</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            {row.metric ? (
                                                <div className="w-36">
                                                    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                                                        <span className="bg-green-500" style={{ width: `${row.metric.positive}%` }} />
                                                        <span className="bg-slate-400" style={{ width: `${row.metric.neutral}%` }} />
                                                        <span className="bg-red-500" style={{ width: `${row.metric.negative}%` }} />
                                                    </div>
                                                    <p className="mt-1 text-[10px] text-slate-400">
                                                        {row.metric.positive}% / {row.metric.neutral}% / {row.metric.negative}%
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">No sentiment data</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-slate-500">
                                            {row.metric?.topConcern ?? '—'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
