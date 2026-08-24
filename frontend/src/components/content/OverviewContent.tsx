import { lazy, useMemo } from "react";

const SentimentPieChart = lazy(() => import("../dashboard/SentimentPieChart"));
const IssuesBarChart = lazy(() => import("../dashboard/IssuesBarChart"));
const AreaComparison = lazy(() => import("../dashboard/AreaComparison"));
const DataSourcesCard = lazy(() => import("../dashboard/DataSourcesCard"));
const AiInsightPanel = lazy(() => import("../dashboard/AiInsightPanel"));

import { /* placeholderDashboard */ } from "../../data/placeholderDashboard";
import { useCallback } from 'react'
import { timeAgo } from '../../utils/time'
import { useDashboard } from "../../hooks/useDashboard";
import FiltersBar from '../../components/FiltersBar'
import MapPanelPlaceholder from '../../components/MapPanelPlaceholder'
import GeoJsonMap from '../location/GeoJsonMap'
import { getBoundaryGeoJson } from '../../services/boundaryApi'
import { getLegislativeDistrictBoundary } from '../../services/electionsApi'
import { useEffect, useState } from 'react'
import { getAssignedGeographySelection, useAuth, getCoverageRestriction, getCoverageLabel } from '../../contexts/AuthContext'
import { isSameGeography } from '../../utils/geography'
import CoverageFilter from '../dashboard/CoverageFilter'
import {
    type LegislativeDistrict,
    type PartyListResult,
} from '../../types/elections'
import { usePersistedElectionSelection } from '../../hooks/usePersistedElectionSelection'

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
    const [election, setElection] = usePersistedElectionSelection()
    const [selectedLegislativeDistrict, setSelectedLegislativeDistrict] = useState<LegislativeDistrict>()
    const [selectedPartyList, setSelectedPartyList] = useState<PartyListResult>()
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
        {
            severity,
            area: election.coverageMode === 'administrative'
                ? selectedArea ?? undefined
                : undefined,
            electionYear: election.electionYear,
            coverageMode: election.coverageMode,
            legislativeDistrictId: election.legislativeDistrictId || undefined,
            partyListId: election.partyListId || undefined,
        },
        geography,
    );

    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const coverageTitle = useMemo(() => {
        const baseName = election.coverageMode === 'legislative' && selectedLegislativeDistrict
            ? selectedLegislativeDistrict.label
            : user?.isSuperadmin ? 'National coverage' : (user?.homeLocation || 'Assigned area')
        return baseName.replace(/^Coverage:\s*/i, '')
    }, [election.coverageMode, selectedLegislativeDistrict, user])

    const liveFeedItems = useMemo(() => {
        const locationLabel = user?.isSuperadmin ? 'National coverage' : (user?.homeLocation || coverageTitle || 'Assigned area')
        const issueFocus = user?.homeLocation === 'Marilao, Bulacan'
            ? 'Flood control'
            : user?.homeLocation === 'Cavite'
                ? 'Traffic management'
                : user?.homeLocation === 'Lucena City'
                    ? 'Public safety'
                    : 'Local service delivery'

        const fallbackLocation = coverageTitle || 'Selected area'

        return [
            {
                time: '09:42 AM',
                location: locationLabel,
                channel: 'Facebook',
                sentiment: 'Positive',
                sentimentTone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                tag: issueFocus,
                magnitude: '+12%',
                title: `${issueFocus} trend up across ${fallbackLocation}`,
                summary: `${locationLabel} is seeing stronger engagement around ${issueFocus.toLowerCase()} as residents share more active updates and local response reports.`,
            },
            {
                time: '09:18 AM',
                location: locationLabel,
                channel: 'News portal',
                sentiment: 'Neutral',
                sentimentTone: 'text-amber-700 bg-amber-50 border-amber-200',
                tag: 'Public sentiment',
                magnitude: '+4%',
                title: 'Local sentiment remains stable with more civic reporting',
                summary: `Coverage in ${fallbackLocation} shows a steady cadence of updates from public institutions, local media, and community discussion threads.`,
            },
            {
                time: '08:56 AM',
                location: locationLabel,
                channel: 'Community forum',
                sentiment: 'Negative',
                sentimentTone: 'text-rose-700 bg-rose-50 border-rose-200',
                tag: 'Service issues',
                magnitude: '-7%',
                title: 'Service complaints trending higher in the last hour',
                summary: `Residents are highlighting delays and operational pain points tied to public service delivery in ${fallbackLocation}.`,
            },
        ]
    }, [coverageTitle, user])

    const assignedAreaLabel = useMemo(() => {
        if (user?.isSuperadmin) return 'National'
        if (restrictedCoverage?.field === 'province') return 'Province'
        if (restrictedCoverage?.field === 'locality') return 'Municipality'
        if (restrictedCoverage?.field === 'region') return 'Region'
        return 'Area'
    }, [restrictedCoverage, user])

    const sentimentTitle = useMemo(() => {
        if (user?.isSuperadmin) return 'National Sentiment Distribution'
        return `${coverageTitle} Sentiment Distribution`
    }, [coverageTitle, user])

    const sentimentSubtitle = useMemo(() => {
        if (user?.isSuperadmin) return 'All topics and regions, full period'
        return `${coverageTitle} sentiment mix across the assigned scope and active issues`
    }, [coverageTitle, user])

    const issuesTitle = useMemo(() => {
        if (user?.isSuperadmin) return 'Top Issues by Mention Volume'
        return `Top Issues in ${coverageTitle}`
    }, [coverageTitle, user])

    const issuesSubtitle = useMemo(() => {
        if (user?.isSuperadmin) return '{total} total mentions across {count} recorded themes'
        return `${coverageTitle} issue ranking by volume`
    }, [coverageTitle, user])

    const comparisonTitle = useMemo(() => {
        if (user?.isSuperadmin) return 'Area Comparison'
        return `${coverageTitle} Comparison`
    }, [coverageTitle, user])

    const comparisonSubtitle = useMemo(() => {
        if (user?.isSuperadmin) return undefined
        return `${coverageTitle} benchmark against comparable areas in the same scope`
    }, [coverageTitle, user])

    const sourcesTitle = useMemo(() => {
        if (user?.isSuperadmin) return 'National Data Sources Breakdown'
        return `${coverageTitle} Data Sources Breakdown`
    }, [coverageTitle, user])

    const quickIssuesTitle = useMemo(() => {
        if (user?.isSuperadmin) return 'National Top Issues — Quick View'
        return `${coverageTitle} Top Issues — Quick View`
    }, [coverageTitle, user])

    const handleRefresh = useCallback(async () => {
        try {
            await refresh()
            setLastUpdated(new Date())
        } catch (err) {
            // ignore
        }
    }, [refresh])

    const aiInsightContext = useMemo(() => {
        const overallSentiment = data.sentiment.reduce(
            (totals, item) => {
                const key = item.name.toLowerCase()
                if (key === 'positive') totals.positive += item.value
                if (key === 'neutral') totals.neutral += item.value
                if (key === 'negative') totals.negative += item.value
                return totals
            },
            { positive: 0, neutral: 0, negative: 0 },
        )

        const issueTopics = data.issues.slice(0, 5).map((issue, index) => ({
            name: issue.name,
            mentions: issue.mentions,
            positive: Math.max(8, 42 - index * 6),
            neutral: Math.max(18, 34 - index * 4),
            negative: Math.max(28, 52 - index * 5),
        }))

        return {
            coverageLabel: selectedAreaLabel || coverageTitle || 'Selected coverage',
            periodLabel: period,
            sentiment: {
                positive: overallSentiment.positive || data.positiveSentiment,
                neutral: overallSentiment.neutral || 0,
                negative: overallSentiment.negative || 100 - (overallSentiment.positive || data.positiveSentiment),
            },
            topics: issueTopics,
            insights: [{
                title: 'Coverage pulse',
                description: 'Top issues are being tracked against the selected area and recent reporting period.',
            }],
        }
    }, [coverageTitle, data.issues, data.positiveSentiment, data.sentiment, period, selectedAreaLabel])

    const [boundaryData, setBoundaryData] = useState<any | null>(null)
    useEffect(() => {
        const controller = new AbortController()
        let mounted = true

        void (async () => {
            try {
                const payload = election.coverageMode === 'legislative' && election.legislativeDistrictId
                    ? await getLegislativeDistrictBoundary(
                        election.legislativeDistrictId,
                        election.electionYear,
                        controller.signal,
                    )
                    : await getBoundaryGeoJson(geography, controller.signal)
                if (mounted) {
                    setBoundaryData(payload.features.some(feature => feature.geometry) ? payload : null)
                }
            } catch (err) {
                // silently fail and keep placeholder
                if (mounted) setBoundaryData(null)
            }
        })()

        return () => { mounted = false; controller.abort() }
    }, [election.coverageMode, election.electionYear, election.legislativeDistrictId, geography])

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
            <CoverageFilter
                geography={geography}
                onGeographyChange={next => {
                    setGeography(next)
                    setSelectedArea(
                        next.locality || next.district || next.province || next.region || null,
                    )
                }}
                election={election}
                onElectionChange={setElection}
                onResolvedElectionChange={(district, partyList) => {
                    setSelectedLegislativeDistrict(district)
                    setSelectedPartyList(partyList)
                }}
                period={period}
                onPeriodChange={setPeriod}
            />

            <div className="mt-4">
                <FiltersBar
                    showPeriod={false}
                    onChange={({ severity: nextSeverity }) => {
                        if (nextSeverity) setSeverity(nextSeverity)
                    }}
                />
            </div>

            {selectedPartyList && (
                <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs text-indigo-800">
                    Party-list focus: <strong>{selectedPartyList.officialName}</strong>
                </div>
            )}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-medium text-slate-500">{user?.isSuperadmin ? 'National Mentions' : `${coverageTitle} Mentions`}</div>
                    <div className="mt-2 text-2xl font-bold text-slate-800">{data.totalMentions.toLocaleString()}</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-medium text-slate-500">{user?.isSuperadmin ? 'National Positive Sentiment' : `${coverageTitle} Positive Sentiment`}</div>
                    <div className="mt-2 text-2xl font-bold text-slate-800">{data.positiveSentiment}%</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-medium text-slate-500">{user?.isSuperadmin ? 'National Contributors' : `${coverageTitle} Contributors`}</div>
                    <div className="mt-2 text-2xl font-bold text-slate-800">{data.uniqueContributors ?? '—'}</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-medium text-slate-500">{user?.isSuperadmin ? 'National Active Locations' : `${coverageTitle} Active Locations`}</div>
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
                    <SentimentPieChart data={data.sentiment} title={sentimentTitle} subtitle={sentimentSubtitle} />
                </div>
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5 relative">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slate-700" />
                        </div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-800">{issuesTitle}</h3>
                        <div className="text-xs text-slate-500">Showing {data.issues.length} issues</div>
                    </div>
                    <IssuesBarChart data={data.issues} title={issuesTitle} subtitle={issuesSubtitle} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <AreaComparison data={data.areas} selectedAreaName={selectedAreaLabel} title={comparisonTitle} subtitle={comparisonSubtitle} />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <DataSourcesCard sources={data.sources} quickIssues={data.quickIssues} sourcesTitle={sourcesTitle} issuesTitle={quickIssuesTitle} />
                </div>
            </div>

            <div className="mt-6">
                <AiInsightPanel
                    title="Overview AI Brief"
                    context={aiInsightContext}
                />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-6">
                <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="relative flex h-3 w-3 items-center justify-center">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-slate-800">Live Feed</div>
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                                LIVE
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="text-sm text-slate-600 hover:text-slate-800 bg-slate-50 border border-slate-100 rounded px-3 py-1"
                        >
                            {loading ? 'Refreshing…' : 'Refresh'}
                        </button>
                        {lastUpdated ? (
                            <div className="text-xs text-slate-500" title={lastUpdated.toLocaleString()}>Updated {timeAgo(lastUpdated)}</div>
                        ) : (
                            <div className="text-xs text-slate-500">Updated just now</div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="border-b border-slate-100 xl:border-b-0 xl:border-r xl:border-slate-100">
                        <div className="space-y-3 p-5">
                            {liveFeedItems.map((item, index) => (
                                <div
                                    key={`${item.time}-${item.tag}-${index}`}
                                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                            {item.time}
                                        </div>
                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.sentimentTone}`}>
                                            {item.sentiment}
                                        </span>
                                    </div>

                                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                                        <span className="font-semibold uppercase tracking-wide text-slate-600">{item.location}</span>
                                        <span>•</span>
                                        <span>{item.channel}</span>
                                    </div>

                                    <p className="mt-2 text-sm font-semibold text-slate-800">{item.title}</p>
                                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.summary}</p>

                                    <div className="mt-3 flex items-center justify-between gap-3">
                                        <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                                            {item.tag}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-600">{item.magnitude}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Coverage map</div>
                                <div className="mt-1 text-sm font-semibold text-slate-800">{coverageTitle}</div>
                            </div>
                            <div className="text-[11px] text-slate-500">{assignedAreaLabel}</div>
                        </div>

                        <div className="relative min-h-[260px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            {loading && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slate-700" />
                                </div>
                            )}
                            {boundaryData ? (
                                <GeoJsonMap
                                    data={boundaryData}
                                    selectedKey={election.coverageMode === 'legislative'
                                        ? election.legislativeDistrictId
                                        : selectedArea}
                                    onAreaClick={election.coverageMode === 'administrative'
                                        ? (key) => setSelectedArea(prev => prev === key ? null : key)
                                        : undefined}
                                />
                            ) : (
                                <MapPanelPlaceholder />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
