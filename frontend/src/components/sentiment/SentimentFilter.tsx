import { CalendarDays } from "lucide-react";
import GeographyControls from "../shared/GeographyControls";

type SentimentFilterProps = {
    period?: string;
    onPeriodChange?: (value: string) => void;
    activeScope?: string;
};

export default function SentimentFilter({
    period = "30d",
    onPeriodChange,
    activeScope = "national"
}: SentimentFilterProps) {
    const getDescription = () => {
        switch (activeScope) {
            case "provincial":
                return "Select a province or party-list to filter the dashboard data.";

            case "local":
                return "Select a city, municipality, or congressional district to filter the dashboard data.";

            default:
                return "Showing national aggregate data.";
        }
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Main filter row */}
            <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                {/* Scope */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
                            <GeographyControls />
                        </div>
                    </div>
                </div>

                {/* Date range */}
                <div className="flex shrink-0 items-end gap-2">
                    <div>
                        <label
                            htmlFor="dashboard-period"
                            className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400"
                        >
                            Date Range
                        </label>

                        <div className="relative">
                            <CalendarDays
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <select
                                id="dashboard-period"
                                value={period}
                                onChange={(e) => onPeriodChange?.(e.target.value)}
                                className="
                                            h-10 min-w-[160px]
                                            appearance-none rounded-lg
                                            border border-slate-200
                                            bg-white
                                            pl-9 pr-9
                                            text-sm font-medium text-slate-700
                                            outline-none
                                            transition
                                            hover:border-slate-300
                                            focus:border-emerald-500
                                            focus:ring-2 focus:ring-emerald-100
                                            "
                            >
                                <option value="7d">Last 7 days</option>
                                <option value="30d">Last 30 days</option>
                                <option value="90d">Last 90 days</option>
                                <option value="1y">Last 12 months</option>
                            </select>

                            <svg
                                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Helper / current selection */}
            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
                <p className="text-xs text-slate-500 sm:text-sm">
                    {getDescription()}
                    {activeScope === "national" && (
                        <span className="ml-1 text-slate-400">
                            Select Provincial or Congressional mode to filter by location.
                        </span>
                    )}
                </p>
            </div>
        </div>
    );
}