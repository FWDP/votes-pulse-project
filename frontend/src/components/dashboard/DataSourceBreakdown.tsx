import type { SourceItem } from "../../types/dashboard";
import { defaultColor, sourceColors } from '../../theme/colors'

interface DataSourcesBreakdownProps {
    data: SourceItem[];
}

export default function DataSourcesBreakdown({ data }: DataSourcesBreakdownProps) {
    const total = data.reduce((sum, source) => sum + source.mentions, 0)

    return (
        <div>
            <h3 className="mb-4 font-bold text-slate-800">Data Sources Breakdown</h3>

            {!data.length ? (
                <div className="py-8 text-center text-sm text-slate-500">No source data available.</div>
            ) : (
                <div className="space-y-3">
                    {data.map((source) => {
                        const percentage = total > 0 ? (source.mentions / total) * 100 : 0
                        const colorKey = (source.id || source.name).toLowerCase().replace(/[^a-z0-9]+/g, '_')
                        const color = sourceColors[colorKey as keyof typeof sourceColors] ?? defaultColor

                        return (
                            <div key={source.id}>
                                <div className="mb-1 flex items-center justify-between gap-4 text-xs">
                                    <div className="flex min-w-0 items-center gap-2 text-slate-700">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                                        <span className="min-w-0 truncate">{source.name}</span>
                                    </div>

                                    <span className="shrink-0 text-slate-500">
                                        {source.mentions.toLocaleString()} ({percentage.toFixed(1)}%)
                                    </span>
                                </div>

                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}