import {
    CircleDot,
    GraduationCap,
    HeartPulse,
    Landmark,
    Leaf,
    Minus,
    Shield,
    Sprout,
    TrendingDown,
    TrendingUp,
    Waves,
    Wrench,
    type LucideIcon,
} from "lucide-react";

import type {
    IssueTrend,
    QuickIssue,
} from "../../types/dashboard";

interface TopIssuesQuickViewProps {
    data: QuickIssue[];
}

const ISSUE_ICONS: Record<
    string,
    LucideIcon
> = {
    infrastructure: Wrench,

    agriculture: Sprout,

    health: HeartPulse,

    education: GraduationCap,

    flooding: Waves,

    safety: Shield,

    tourism: Landmark,

    environment: Leaf,

    topic: CircleDot,
};

function TrendIndicator({
    trend,
}: {
    trend: IssueTrend;
}) {
    switch (trend) {
        case "up":
            return (
                <TrendingUp
                    size={14}
                    className="shrink-0 text-orange-500"
                />
            );

        case "down":
            return (
                <TrendingDown
                    size={14}
                    className="shrink-0 text-green-600"
                />
            );

        default:
            return (
                <Minus
                    size={14}
                    className="shrink-0 text-slate-400"
                />
            );
    }
}

export default function TopIssuesQuickView({
    data,
}: TopIssuesQuickViewProps) {
    return (
        <div className="border-t border-slate-200 pt-4">
            <h4 className="mb-3 text-sm font-bold text-slate-700">
                Top Issues — Quick View
            </h4>

            {!data.length ? (
                <div className="py-4 text-sm text-slate-500">
                    No issue data available.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                    {data.map((issue) => {

                        return (
                            <div
                                key={issue.id}
                                className="flex min-w-0 items-center gap-2"
                            >
                                <span className="truncate text-xs text-slate-600">
                                    {issue.name}
                                </span>

                                <TrendIndicator
                                    trend={issue.trend}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}