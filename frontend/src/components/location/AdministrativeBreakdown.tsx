import {
    MapPin,
} from 'lucide-react'

import type {
    GeographyUnit,
} from '../../types/geography'
import type { LocationSentimentMetric } from '../../types/sentiment'

export interface AdministrativeGroup {
    code: string
    name: string
    units: GeographyUnit[]
}

interface AdministrativeBreakdownProps {
    groups: AdministrativeGroup[]
    kind: 'district' | 'province' | 'locality-type'
    metrics: LocationSentimentMetric[]
    onGroupSelect?: (group: AdministrativeGroup) => void
}

const GROUP_COLORS = [
    '#3b82f6',
    '#8b5cf6',
    '#f59e0b',
    '#10b981',
    '#ec4899',
    '#06b6d4',
]

export default function AdministrativeBreakdown({
    groups,
    kind,
    metrics,
    onGroupSelect,
}: AdministrativeBreakdownProps) {
    if (groups.length === 0) return null

    const title = kind === 'district'
        ? 'NCR statistical districts'
        : kind === 'locality-type'
            ? 'Cities and municipalities'
            : 'Provincial coverage'
    const groupCountLabel = kind === 'district'
        ? 'districts'
        : kind === 'locality-type'
            ? 'LGU types'
            : 'groups'

    return (
        <section aria-labelledby="administrative-breakdown-title">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2
                        id="administrative-breakdown-title"
                        className="text-sm font-bold text-slate-800"
                    >
                        {title}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Official PSA PSGC membership with illustrative placeholder sentiment
                    </p>
                </div>

                <span className="text-xs font-medium text-slate-400">
                    {groups.length} {groupCountLabel}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {groups.map((group, index) => {
                    const groupCodes = new Set(group.units.map(unit => unit.code))
                    const groupMetrics = metrics.filter(metric => groupCodes.has(metric.code))
                    const mentions = groupMetrics.reduce((sum, metric) => sum + metric.mentions, 0)
                    const weighted = (key: 'positive' | 'neutral' | 'negative') =>
                        mentions === 0
                            ? 0
                            : Math.round(groupMetrics.reduce(
                                (sum, metric) => sum + metric[key] * metric.mentions,
                                0,
                            ) / mentions)
                    const positive = weighted('positive')
                    const negative = weighted('negative')
                    const neutral = Math.max(0, 100 - positive - negative)
                    const concernTotals = new Map<string, number>()
                    groupMetrics.forEach(metric => {
                        if (!metric.topConcern) return
                        concernTotals.set(
                            metric.topConcern,
                            (concernTotals.get(metric.topConcern) ?? 0) + metric.mentions,
                        )
                    })
                    const topConcern = [...concernTotals.entries()]
                        .sort((a, b) => b[1] - a[1])[0]?.[0]
                    const canSelect = Boolean(
                        onGroupSelect &&
                        (
                            kind === 'district' ||
                            kind === 'province' ||
                            kind === 'locality-type'
                        ),
                    )

                    return (
                    <button
                        key={group.code}
                        type="button"
                        disabled={!canSelect}
                        onClick={() => onGroupSelect?.(group)}
                        aria-label={canSelect ? `Filter to ${group.name}` : undefined}
                        className={`rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition ${
                            canSelect
                                ? 'cursor-pointer hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
                                : 'cursor-default'
                        }`}
                    >
                        <div className="flex items-start gap-2.5">
                            <span
                                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{
                                    backgroundColor:
                                        GROUP_COLORS[index % GROUP_COLORS.length],
                                }}
                            />

                            <div className="min-w-0">
                                <h3 className="text-sm font-bold text-slate-800">
                                    {group.name}
                                </h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    {group.units.length.toLocaleString()} constituent {group.units.length === 1 ? 'LGU' : 'LGUs'} · {mentions.toLocaleString()} mentions
                                </p>
                            </div>
                        </div>

                        {groupMetrics.length > 0 && (
                            <div className="mt-4">
                                <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                                    <span className="bg-green-500" style={{ width: `${positive}%` }} />
                                    <span className="bg-slate-400" style={{ width: `${neutral}%` }} />
                                    <span className="bg-red-500" style={{ width: `${negative}%` }} />
                                </div>
                                <div className="mt-2 flex gap-3 text-[11px] font-medium">
                                    <span className="text-green-700">{positive}% pos</span>
                                    <span className="text-slate-500">{neutral}% neu</span>
                                    <span className="text-red-600">{negative}% neg</span>
                                </div>
                                {topConcern && (
                                    <p className="mt-2 text-[11px] text-slate-500">
                                        Top concern: <span className="font-medium text-slate-700">{topConcern}</span>
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500">
                            <MapPin
                                size={13}
                                className="mt-0.5 shrink-0 text-slate-700"
                            />
                            <p>
                                {group.units.length > 0
                                    ? group.units.map(unit => unit.area_name).join(', ')
                                    : 'No constituent LGUs returned'}
                            </p>
                        </div>

                        <div className="mt-4 border-t border-slate-100 pt-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-[11px] font-medium text-slate-400">
                                    Illustrative simulation data
                                </p>
                                {canSelect && (
                                    <span className="text-[11px] font-semibold text-blue-600">
                                        Click to filter →
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>
                    )
                })}
            </div>
        </section>
    )
}
