import type { AreaItem } from "../../types/dashboard";

interface AreaComparisonProps {
    data: AreaItem[];
    selectedAreaName?: string | null;
    title?: string;
    subtitle?: string;
}

const AREA_COLORS: Record<string, string> = {
    north: '#2563eb',
    central: '#7c3aed',
    south: '#f59e0b',
    marilao: '#2563eb',
    cavite: '#7c3aed',
    lucena: '#f59e0b',
};

export default function AreaComparison({ data, selectedAreaName, title = 'Area Comparison', subtitle }: AreaComparisonProps) {
    if (!data.length) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-4">
                    <h3 className="font-bold text-slate-800">Area Comparison</h3>
                    <p className="text-sm text-slate-500">No area comparison data configured.</p>
                </div>
            </div>
        )
    }

    const normalizedSelectedArea = selectedAreaName?.replace(/^Coverage:\s*/i, '').trim() || null
    const totalMentions = data.reduce((sum, area) => sum + area.mentions, 0)
    const normalizedData = data.map((area) => {
        const lowered = area.name.toLowerCase()
        if (lowered.includes('northern area')) return { ...area, name: 'Marilao, Bulacan' }
        if (lowered.includes('central area')) return { ...area, name: 'Cavite Province' }
        if (lowered.includes('southern area')) return { ...area, name: 'Lucena City' }
        return area
    })
    const ranked = [...normalizedData].sort((a, b) => b.mentions - a.mentions)
    const selectedMatch = normalizedSelectedArea
        ? ranked.find((area) => area.name.toLowerCase().includes(normalizedSelectedArea.toLowerCase()))
        : null

    const sorted = selectedMatch
        ? [selectedMatch, ...ranked.filter((area) => area.id !== selectedMatch.id)]
        : ranked

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4">
                <h3 className="font-bold text-slate-800">{title}</h3>
                <p className="text-sm text-slate-500">
                    {subtitle ?? (
                        `${normalizedSelectedArea ? `${normalizedSelectedArea} focus · ` : ''}${sorted.length} areas · ${totalMentions.toLocaleString()} aggregated mentions`
                    )}
                </p>
            </div>

            <div className="space-y-3">
                {sorted.map((area) => {
                    const color = AREA_COLORS[area.id] ?? '#64748b'
                    const sentimentTotal = area.sentiment.positive + area.sentiment.neutral + area.sentiment.negative
                    const isSelected = !!normalizedSelectedArea && area.name.toLowerCase().includes(normalizedSelectedArea.toLowerCase())

                    return (
                        <div key={area.id} className={`rounded-lg border p-4 ${isSelected ? 'border-sky-200 bg-sky-50/60' : 'border-slate-200 bg-white'}`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex min-w-0 gap-2">
                                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                                            <span>{area.name}</span>
                                            {isSelected && (
                                                <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                                                    Selected
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {area.count} units{area.topTopics.length > 0 ? ` · Top: ${area.topTopics.join(' & ')}` : ''}
                                        </div>
                                    </div>
                                </div>

                                <div className="shrink-0 text-right">
                                    <div className="font-bold text-slate-800">{area.mentions.toLocaleString()}</div>
                                    <div className="text-xs text-slate-500">mentions</div>
                                </div>
                            </div>

                            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
                                <div className="bg-green-500" style={{ width: `${area.sentiment.positive}%` }} />
                                <div className="bg-slate-400" style={{ width: `${area.sentiment.neutral}%` }} />
                                <div className="bg-red-500" style={{ width: `${area.sentiment.negative}%` }} />
                            </div>

                            <div className="mt-2 flex gap-5 text-xs">
                                <span className="text-green-600">{area.sentiment.positive}% pos</span>
                                <span className="text-slate-500">{area.sentiment.neutral}% neu</span>
                                <span className="text-red-500">{area.sentiment.negative}% neg</span>
                            </div>
                            {sentimentTotal > 0 && (
                                <div className="mt-1 text-[10px] text-slate-400">Sentiment mix totals: {sentimentTotal}%</div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}