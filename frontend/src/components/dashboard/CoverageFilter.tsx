import {
    useEffect,
    useMemo,
    useState,
} from 'react'
import {
    CalendarDays,
} from 'lucide-react'

import {
    GeographyControls,
} from './GeographyControls'
import ElectionCoverageControls from './ElectionCoverageControls'
import LegislativeBoundaryPreview from './LegislativeBoundaryPreview'

import {
    useAuth,
    getCoverageRestriction,
    getAssignedGeographySelection,
    hasCoverageLock,
} from '../../contexts/AuthContext'
import { isSameGeography } from '../../utils/geography'

import type {
    GeographySelection,
    ResolvedGeographySelection,
} from '../../types/geography'
import {
    type ElectionSelection,
    type LegislativeDistrict,
    type PartyListResult,
} from '../../types/elections'
import { usePersistedElectionSelection } from '../../hooks/usePersistedElectionSelection'
import {
    ALL_CITIES_FILTER,
    ALL_MUNICIPALITIES_FILTER,
    INDEPENDENT_CITIES_FILTER,
} from '../../types/geography'

type CoverageFilterProps = {
    period?: string

    onPeriodChange?: (
        value: string,
    ) => void

    geography: GeographySelection

    onGeographyChange: (
        value: GeographySelection,
    ) => void

    onResolvedGeographyChange?: (
        value: ResolvedGeographySelection,
    ) => void

    election?: ElectionSelection

    onElectionChange?: (
        value: ElectionSelection,
    ) => void

    onResolvedElectionChange?: (
        district?: LegislativeDistrict,
        partyList?: PartyListResult,
    ) => void
}

export default function CoverageFilter({
    period = '30d',
    onPeriodChange,
    geography,
    onGeographyChange,
    onResolvedGeographyChange,
    election,
    onElectionChange,
    onResolvedElectionChange,
}: CoverageFilterProps) {
    const { user } = useAuth()
    const isSuperadmin = Boolean(user?.isSuperadmin)
    const restrictedCoverage = getCoverageRestriction(user)
    const [internalElection, setInternalElection] = usePersistedElectionSelection(
        election === undefined,
    )
    const [resolvedDistrict, setResolvedDistrict] = useState<LegislativeDistrict>()
    const [resolvedPartyList, setResolvedPartyList] = useState<PartyListResult>()
    const activeElection = election ?? internalElection
    const handleElectionChange = onElectionChange ?? setInternalElection

    useEffect(() => {
        if (isSuperadmin || !restrictedCoverage) return

        const assigned = getAssignedGeographySelection(user)

        const nextGeography: GeographySelection = {
            region: restrictedCoverage.field === 'region' ? restrictedCoverage.value : (
                restrictedCoverage.field === 'province' || restrictedCoverage.field === 'locality'
                    ? assigned.region
                    : ''
            ),
            province: restrictedCoverage.field === 'province'
                ? restrictedCoverage.value
                : (
                    restrictedCoverage.field === 'locality'
                        ? (restrictedCoverage.provinceValue ?? assigned.province)
                        : ''
                ),
            district: '',
            locality: restrictedCoverage.field === 'locality' ? restrictedCoverage.value : '',
        }

        if (!isSameGeography(nextGeography, geography)) {
            onGeographyChange(nextGeography)
        }
    }, [geography, isSuperadmin, onGeographyChange, restrictedCoverage, user])

    const coverageLocked = hasCoverageLock(user)
    const assignedAreaSummary = useMemo(() => {
        if (!user?.homeLocation || user.isSuperadmin) return null

        switch (user.homeLocation) {
            case 'Navotas':
                return 'Assigned area: National Capital Region · Navotas'
            case 'Cavite':
                return 'Assigned area: CALABARZON · Cavite'
            case 'Lucena City':
                return 'Assigned area: CALABARZON · Lucena City (independent city)'
            case 'Marilao, Bulacan':
                return 'Assigned area: Central Luzon · Bulacan · Marilao'
            case 'Quezon City':
                return 'Assigned area: National Capital Region · Quezon City'
            default:
                return null
        }
    }, [user])

    const getDescription = () => {
        if (activeElection.coverageMode === 'legislative') {
            const districtLabel = resolvedDistrict?.label ?? 'a legislative district'
            const partyListLabel = resolvedPartyList?.acronym || resolvedPartyList?.officialName
            return `Showing ${districtLabel}${partyListLabel ? ` with ${partyListLabel} as the party-list focus` : ''}.`
        }

        if (resolvedPartyList) {
            return `Showing administrative coverage with ${resolvedPartyList.acronym || resolvedPartyList.officialName} as the party-list focus.`
        }

        if (geography.locality) {
            if (geography.locality === ALL_CITIES_FILTER) {
                return 'Showing all cities within the selected administrative coverage.'
            }

            if (geography.locality === ALL_MUNICIPALITIES_FILTER) {
                return 'Showing all municipalities within the selected administrative coverage.'
            }

            return 'Showing data for the selected city or municipality.'
        }

        if (geography.province) {
            if (geography.province === INDEPENDENT_CITIES_FILTER) {
                return 'Showing independently administered cities in the selected region.'
            }

            return 'Showing data for the selected province.'
        }

        if (geography.district) {
            return 'Showing data for the selected NCR statistical district.'
        }

        if (geography.region) {
            return 'Showing data for the selected region.'
        }

        return 'Showing national aggregate data.'
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-5 p-4 sm:p-5">
                <div className="
                    flex
                    flex-col
                    gap-4
                    xl:flex-row
                    xl:items-end
                    xl:justify-between
                ">
                    {/* Geography */}

                    <div className="min-w-0 flex-1">
                        <div className="mb-2">
                            <span className="
                                text-xs
                                font-semibold
                                uppercase
                                tracking-wide
                                text-slate-400
                            ">
                                Coverage
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <GeographyControls
                                value={geography}
                                onChange={
                                    onGeographyChange
                                }
                                onResolvedChange={
                                    onResolvedGeographyChange
                                }
                                disabled={coverageLocked}
                            />

                            {coverageLocked && (
                                <div className="ml-4 flex flex-col gap-1 text-xs font-semibold text-rose-700" role="status" aria-live="polite">
                                    <span>Coverage locked to assigned area</span>
                                    {assignedAreaSummary && (
                                        <span className="text-[11px] font-medium text-slate-600">{assignedAreaSummary}</span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 border-t border-slate-100 pt-4">
                            <ElectionCoverageControls
                                geography={geography}
                                value={activeElection}
                                onChange={handleElectionChange}
                                onResolvedChange={(district, partyList) => {
                                    setResolvedDistrict(district)
                                    setResolvedPartyList(partyList)
                                    onResolvedElectionChange?.(district, partyList)
                                }}
                            />
                        </div>

                        {activeElection.coverageMode === 'legislative' &&
                            activeElection.legislativeDistrictId && (
                                <div className="mt-4">
                                    <LegislativeBoundaryPreview
                                        district={resolvedDistrict}
                                        electionYear={activeElection.electionYear}
                                    />
                                </div>
                            )}
                    </div>

                    {/* Date Range */}

                    <div className="shrink-0">
                        <label
                            htmlFor="dashboard-period"
                            className="
                                mb-2
                                block
                                text-xs
                                font-semibold
                                uppercase
                                tracking-wide
                                text-slate-400
                            "
                        >
                            Date Range
                        </label>

                        <div className="relative">
                            <CalendarDays
                                size={16}
                                className="
                                    pointer-events-none
                                    absolute
                                    left-3
                                    top-1/2
                                    -translate-y-1/2
                                    text-slate-700
                                "
                            />

                            <select
                                id="dashboard-period"
                                value={period}
                                onChange={event =>
                                    onPeriodChange?.(
                                        event.target
                                            .value,
                                    )
                                }
                                className="
                                    h-10
                                    min-w-[170px]
                                    appearance-none
                                    rounded-lg
                                    border
                                    border-slate-200
                                    bg-white
                                    pl-9
                                    pr-9
                                    text-sm
                                    font-medium
                                    text-slate-700
                                    outline-none
                                    transition
                                    hover:border-slate-300
                                    focus:border-emerald-500
                                    focus:ring-2
                                    focus:ring-emerald-100
                                "
                            >
                                <option value="7d">
                                    Last 7 days
                                </option>

                                <option value="30d">
                                    Last 30 days
                                </option>

                                <option value="90d">
                                    Last 90 days
                                </option>

                                <option value="1y">
                                    Last 12 months
                                </option>
                            </select>

                            <svg
                                className="
                                    pointer-events-none
                                    absolute
                                    right-3
                                    top-1/2
                                    h-4
                                    w-4
                                    -translate-y-1/2
                                    text-slate-400
                                "
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="
                                        M5.23 7.21
                                        a.75.75 0 011.06.02
                                        L10 11.168
                                        l3.71-3.938
                                        a.75.75 0 111.08 1.04
                                        l-4.25 4.51
                                        a.75.75 0 01-1.08 0
                                        l-4.25-4.51
                                        a.75.75 0 01.02-1.06z
                                    "
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Description */}

            <div className="
                border-t
                border-slate-100
                bg-slate-50/70
                px-4
                py-3
                sm:px-5
            ">
                <p className="text-xs text-slate-500 sm:text-sm">
                    {getDescription()}

                    {!geography.region && (
                        <span className="ml-1 text-slate-400">
                            Select a region to narrow
                            the coverage.
                        </span>
                    )}
                </p>
            </div>
        </div>
    )
}
