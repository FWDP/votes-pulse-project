import { lazy, useMemo } from "react";

const SentimentPieChart = lazy(() => import("../dashboard/SentimentPieChart"));
const IssuesBarChart = lazy(() => import("../dashboard/IssuesBarChart"));
const AreaComparison = lazy(() => import("../dashboard/AreaComparison"));
const DataSourcesCard = lazy(() => import("../dashboard/DataSourcesCard"));

import { /* placeholderDashboard */ } from "../../data/placeholderDashboard";
import { useCallback } from 'react'
import { timeAgo } from '../../utils/time'
import { useDashboard } from "../../hooks/useDashboard";
import FiltersBar from '../../components/FiltersBar'
import MapPanelPlaceholder from '../../components/MapPanelPlaceholder'
import GeoJsonMap from '../location/GeoJsonMap'
import { getBoundaryGeoJson } from '../../services/boundaryApi'
import { useEffect, useState } from 'react'
import { getAssignedGeographySelection, useAuth, getCoverageRestriction, getCoverageLabel } from '../../contexts/AuthContext'
import { isSameGeography } from '../../utils/geography'

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
    const { user } = useAuth()
    const restrictedCoverage = useMemo(() => getCoverageRestriction(user), [user])
    const assignedGeography = useMemo(() => getAssignedGeographySelection(user), [user])
    const [period, setPeriod] = useState<string>('30d')
    const [severity, setSeverity] = useState<string>('all')
    const [selectedArea, setSelectedArea] = useState<string | null>(restrictedCoverage?.value ?? null)
    const [geography, setGeography] = useState(assignedGeography)
    const selectedAreaLabel = useMemo(() => {
        if (user?.isSuperadmin) return 'National coverage'
        return getCoverageLabel(user) || 'Selected area'
    }, [user])

    const getRangeForPeriod = (period: string) => {
        const now = new Date()
        let startDate = new Date(now)

        if (period === '24h') startDate.setUTCDate(now.getUTCDate() - 1)
        else if (period === '7d') startDate.setUTCDate(now.getUTCDate() - 7)
        else if (period === '30d') startDate.setUTCDate(now.getUTCDate() - 30)
        else if (period === '90d') startDate.setUTCDate(now.getUTCDate() - 90)
        else startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

        return { start: toMeltwaterDate(startDate), end: toMeltwaterDate(now) }
    }

    const range = getRangeForPeriod(period)

    const {
        data,
        loading,
        error,
        usingPlaceholder,
        refresh
    } = useDashboard(
        range.start,
        range.end,
        { severity, area: selectedArea ?? undefined }
    );

    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const handleRefresh = useCallback(async () => {
        try {
            await refresh()
            setLastUpdated(new Date())
        } catch (err) {
            // ignore
        }
    }, [refresh])

    const [boundaryData, setBoundaryData] = useState<any | null>(null)
    useEffect(() => {
        const controller = new AbortController()
        let mounted = true

        void (async () => {
            try {
                const payload = await getBoundaryGeoJson(geography, controller.signal)
                if (mounted) setBoundaryData(payload)
            } catch (err) {
                // silently fail and keep placeholder
                if (mounted) setBoundaryData(null)
            }
        })()

        return () => { mounted = false; controller.abort() }
    }, [geography])

    useEffect(() => {
        if (!restrictedCoverage) return

        setGeography(current => isSameGeography(current, assignedGeography) ? current : assignedGeography)

        setSelectedArea(current => {
            const next = restrictedCoverage.value ?? restrictedCoverage.provinceValue ?? null
            return current === next ? current : next
        })
    }, [assignedGeography, restrictedCoverage])

    return (
        <>
            <FiltersBar onChange={({ period: p, severity: s }) => { if (p) setPeriod(p); if (s) setSeverity(s) }} />

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-medium text-slate-500">Total Mentions</div>
                    <div className="mt-2 text-2xl font-bold text-slate-800">{data.totalMentions.toLocaleString()}</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-medium text-slate-500">Positive Sentiment</div>
                    <div className="mt-2 text-2xl font-bold text-slate-800">{data.positiveSentiment}%</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-medium text-slate-500">Unique Contributors</div>
                    <div className="mt-2 text-2xl font-bold text-slate-800">{data.uniqueContributors ?? '—'}</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-medium text-slate-500">Active Locations</div>
                    <div className="mt-2 text-2xl font-bold text-slate-800">{data.activeLocations ?? '—'}</div>
                </div>
            </div>

            {/* KPI cards removed to avoid duplicate static content; summary row above presents key metrics */}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 relative">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slate-700" />
                        </div>
                    )}
                    <SentimentPieChart data={data.sentiment} />
                </div>
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5 relative">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slate-700" />
                        </div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-800">Top Issues</h3>
                        <div className="text-xs text-slate-500">Showing {data.issues.length} issues</div>
                    </div>
                    <IssuesBarChart data={data.issues} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <AreaComparison data={data.areas} selectedAreaName={selectedAreaLabel} />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <DataSourcesCard sources={data.sources} quickIssues={data.quickIssues} />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                        <div className="text-sm font-semibold text-slate-800">Live Feed</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="text-sm text-slate-600 hover:text-slate-800 bg-slate-50 border border-slate-100 rounded px-3 py-1"
                        >
                            {loading ? 'Refreshing…' : 'Refresh'}
                        </button>
                        {lastUpdated && (
                            <div className="text-xs text-slate-500" title={lastUpdated.toLocaleString()}>Last updated {timeAgo(lastUpdated)}</div>
                        )}
                    </div>
                </div>
                <div className="divide-y divide-slate-50">
                        <div className="p-5 relative">
                            {loading && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slate-700" />
                                </div>
                            )}
                            {boundaryData ? (
                                <GeoJsonMap data={boundaryData} selectedKey={selectedArea} onAreaClick={(key) => setSelectedArea(prev => prev === key ? null : key)} />
                            ) : (
                                <MapPanelPlaceholder />
                            )}
                        </div>
                </div>
            </div>
        </>
    );
}