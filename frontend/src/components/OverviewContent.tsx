import { lazy } from "react";

import KPICard from "./dashboard/KPICard";
const SentimentPieChart = lazy(() => import("./dashboard/SentimentPieChart"));
const IssuesBarChart = lazy(() => import("./dashboard/IssuesBarChart"));
const AreaComparison = lazy(() => import("./dashboard/AreaComparison"));
const DataSourcesCard = lazy(() => import("./dashboard/DataSourcesCard"));

import { placeholderDashboard } from "../data/placeholderDashboard";
import { useDashboard } from "../hooks/useDashboard";

function toMeltwaterDate(
    date: Date,
    timeZone: string = "UTC",
): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function getCurrentMonthRange() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const lastDay = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    return {
        start: toMeltwaterDate(firstDay, "UTC"),
        end: toMeltwaterDate(lastDay, "UTC"),
    };
}


export default function OverviewContent() {
    const range = getCurrentMonthRange();
    const {
        data,
        loading,
        error,
        usingPlaceholder,
        refresh
    } = useDashboard(
        range.start,
        range.end
    );

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.kpiMetrics.map((kpi, index) => (
                    <KPICard key={index} {...kpi} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
                    <SentimentPieChart data={placeholderDashboard.sentiment} />
                </div>
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5">
                    <IssuesBarChart data={placeholderDashboard.issues} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <AreaComparison data={placeholderDashboard.areas} />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <DataSourcesCard sources={placeholderDashboard.sources} quickIssues={placeholderDashboard.quickIssues} />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                        <div className="text-sm font-semibold text-slate-800">Live Feed</div>
                    </div>
                </div>
                <div className="divide-y divide-slate-50">

                </div>
            </div>
        </>
    );
}