import type {
    AreaItem,
} from "../../types/dashboard";

interface AreaComparisonProps {
    data: AreaItem[];
}

const AREA_COLORS: Record<
    string,
    string
> = {
    north: "#3b82f6",
    central: "#8b5cf6",
    south: "#f59e0b",
};

export default function AreaComparison({
    data,
}: AreaComparisonProps) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4">
                <h3 className="font-bold text-slate-800">
                    Area Comparison
                </h3>

                <p className="text-sm text-slate-500">
                    North / Central / South —
                    Oriental Mindoro
                </p>
            </div>

            {!data.length ? (
                <div className="py-10 text-center text-sm text-slate-500">
                    No area comparison data
                    configured.
                </div>
            ) : (
                <div className="space-y-3">
                    {data.map((area) => {
                        const color =
                            AREA_COLORS[area.id] ??
                            "#64748b";

                        return (
                            <div
                                key={area.id}
                                className="rounded-lg border border-slate-200 p-4"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex min-w-0 gap-2">
                                        <span
                                            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                                            style={{
                                                backgroundColor:
                                                    color,
                                            }}
                                        />

                                        <div className="min-w-0">
                                            <div className="font-semibold text-slate-800">
                                                {area.name}
                                            </div>

                                            <div className="text-xs text-slate-500">
                                                {
                                                    area.count
                                                }{" "}
                                                municipalities
                                                {area.topTopics
                                                    .length >
                                                    0 && (
                                                        <>
                                                            {" "}
                                                            · Top:{" "}
                                                            {area.topTopics.join(
                                                                " & ",
                                                            )}
                                                        </>
                                                    )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="shrink-0 text-right">
                                        <div className="font-bold text-slate-800">
                                            {area.mentions.toLocaleString()}
                                        </div>

                                        <div className="text-xs text-slate-500">
                                            mentions
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                        className="bg-green-500"
                                        style={{
                                            width: `${area.sentiment.positive}%`,
                                        }}
                                    />

                                    <div
                                        className="bg-slate-400"
                                        style={{
                                            width: `${area.sentiment.neutral}%`,
                                        }}
                                    />

                                    <div
                                        className="bg-red-500"
                                        style={{
                                            width: `${area.sentiment.negative}%`,
                                        }}
                                    />
                                </div>

                                <div className="mt-2 flex gap-5 text-xs">
                                    <span className="text-green-600">
                                        {
                                            area.sentiment
                                                .positive
                                        }
                                        % pos
                                    </span>

                                    <span className="text-slate-500">
                                        {
                                            area.sentiment
                                                .neutral
                                        }
                                        % neu
                                    </span>

                                    <span className="text-red-500">
                                        {
                                            area.sentiment
                                                .negative
                                        }
                                        % neg
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}