import type {
    SourceItem,
} from "../../types/dashboard";

interface DataSourcesBreakdownProps {
    data: SourceItem[];
}

const SOURCE_COLORS = [
    "#3b82f6",
    "#10b981",
    "#06b6d4",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#64748b",
];

export default function DataSourcesBreakdown({
    data,
}: DataSourcesBreakdownProps) {
    const total = data.reduce(
        (sum, source) =>
            sum + source.mentions,
        0,
    );

    return (
        <div>
            <h3 className="mb-4 font-bold text-slate-800">
                Data Sources Breakdown
            </h3>

            {!data.length ? (
                <div className="py-8 text-center text-sm text-slate-500">
                    No source data available.
                </div>
            ) : (
                <div className="space-y-3">
                    {data.map(
                        (source, index) => {
                            const percentage =
                                total > 0
                                    ? (source.mentions /
                                        total) *
                                    100
                                    : 0;

                            const color =
                                SOURCE_COLORS[
                                index %
                                SOURCE_COLORS.length
                                ];

                            return (
                                <div
                                    key={source.id}
                                >
                                    <div className="mb-1 flex items-center justify-between gap-4 text-xs">
                                        <span className="min-w-0 truncate text-slate-700">
                                            {source.name}
                                        </span>

                                        <span className="shrink-0 text-slate-500">
                                            {source.mentions.toLocaleString()}{" "}
                                            (
                                            {percentage.toFixed(
                                                1,
                                            )}
                                            %)
                                        </span>
                                    </div>

                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className="h-full rounded-full"
                                            style={{
                                                width: `${Math.min(
                                                    percentage,
                                                    100,
                                                )}%`,

                                                backgroundColor:
                                                    color,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        },
                    )}
                </div>
            )}
        </div>
    );
}