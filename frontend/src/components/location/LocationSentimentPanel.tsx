import {
    ArrowUp,
    MapPin,
} from 'lucide-react'
import {
    useEffect,
    useMemo,
    useState,
} from 'react'

import {
    getDistricts,
    getMunicipalities,
    getProvinces,
    getRegions,
} from '../../services/geographyApi'
import {
    getBoundaryGeoJson,
} from '../../services/boundaryApi'
import {
    getPlaceholderLocationMetrics,
} from '../../data/placeholderLocationMetrics'
import {
    getAssignedGeographySelection,
    useAuth,
} from '../../contexts/AuthContext'
import { isSameGeography } from '../../utils/geography'

import AdministrativeBreakdown, {
    type AdministrativeGroup,
} from './AdministrativeBreakdown'
import GeoJsonMap from './GeoJsonMap'
import LocationAnalyticsPanels from './LocationAnalyticsPanels'
import MapLegend from '../MapLegend'

import type {
    BoundaryFeatureCollection,
    GeographySelection,
    GeographyUnit,
} from '../../types/geography'
import {
    ALL_CITIES_FILTER,
    ALL_MUNICIPALITIES_FILTER,
    INDEPENDENT_CITIES_FILTER,
} from '../../types/geography'

interface LocationSentimentPanelProps {
    geography: GeographySelection
    onGeographyChange: (geography: GeographySelection) => void
    period: string
}

const PERIOD_LABELS: Record<string, string> = {
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    '1y': 'Last 12 months',
}

const sortUnits = (
    units: GeographyUnit[],
) => [...units].sort((a, b) =>
    a.area_name.localeCompare(
        b.area_name,
        undefined,
        { sensitivity: 'base' },
    ),
)

const isAbortError = (error: unknown) =>
    error instanceof Error &&
    error.name === 'AbortError'

export default function LocationSentimentPanel({
    geography,
    onGeographyChange,
    period,
}: LocationSentimentPanelProps) {
    const { user } = useAuth()
    const assignedGeography = useMemo(() => getAssignedGeographySelection(user), [user])
    const hasAssignedCoverageLock = Boolean(user?.homeLocation && !user.isSuperadmin)

    useEffect(() => {
        if (!hasAssignedCoverageLock) return
        if (!isSameGeography(geography, assignedGeography)) {
            onGeographyChange(assignedGeography)
        }
    }, [assignedGeography, geography, hasAssignedCoverageLock, onGeographyChange, user])

    const [scopeName, setScopeName] = useState('Philippines')
    const [units, setUnits] = useState<GeographyUnit[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [boundaryData, setBoundaryData] = useState<BoundaryFeatureCollection | null>(null)
    const [boundaryLoading, setBoundaryLoading] = useState(true)
    const [boundaryError, setBoundaryError] = useState<string | null>(null)
    const [administrativeGroups, setAdministrativeGroups] = useState<AdministrativeGroup[]>([])
    const [groupKind, setGroupKind] = useState<'district' | 'province' | 'locality-type'>('province')

    useEffect(() => {
        const controller = new AbortController()

        const loadCoverage = async () => {
            setLoading(true)
            setError(null)

            try {
                const regions = await getRegions(
                    controller.signal,
                )
                const selectedRegion = regions.find(
                    unit => unit.code === geography.region,
                )

                if (!selectedRegion) {
                    setScopeName('Philippines')
                    setUnits(sortUnits(regions))
                    setAdministrativeGroups([])
                    return
                }

                const isNCR = selectedRegion.reg === 13
                const [provinces, districts] = await Promise.all([
                    isNCR
                        ? Promise.resolve([] as GeographyUnit[])
                        : getProvinces(
                            selectedRegion.reg,
                            controller.signal,
                        ),
                    isNCR
                        ? getDistricts(
                            selectedRegion.reg,
                            controller.signal,
                        )
                        : Promise.resolve([] as GeographyUnit[]),
                ])
                const selectedProvince = provinces.find(
                    unit => unit.code === geography.province,
                )
                const isIndependentCitiesSelection =
                    geography.province === INDEPENDENT_CITIES_FILTER
                const localityType = geography.locality === ALL_CITIES_FILTER
                    ? 'city'
                    : geography.locality === ALL_MUNICIPALITIES_FILTER
                        ? 'mun'
                        : null
                const selectedDistrict = districts.find(
                    unit => unit.code === geography.district,
                )
                const localities = await getMunicipalities(
                    {
                        reg: selectedRegion.reg,
                        prv: selectedProvince?.prv,
                    },
                    controller.signal,
                )
                const districtPrefix =
                    selectedDistrict?.code.slice(0, 4)
                const provinceCodes = new Set(
                    provinces.map(provinceUnit => provinceUnit.prv),
                )
                const administrativeLocalities = isIndependentCitiesSelection
                    ? localities.filter(unit =>
                        unit.geographic_level.trim().toLowerCase() === 'city' &&
                        !provinceCodes.has(unit.prv),
                    )
                    : districtPrefix
                        ? localities.filter(unit =>
                        unit.correspondence_code?.startsWith(
                            districtPrefix,
                        ),
                    )
                        : localities
                const scopedLocalities = localityType
                    ? administrativeLocalities.filter(unit =>
                        unit.geographic_level.trim().toLowerCase() === localityType,
                    )
                    : administrativeLocalities
                const selectedLocality = scopedLocalities.find(
                    unit => unit.code === geography.locality,
                )

                if (
                    isNCR &&
                    !geography.district &&
                    !geography.locality
                ) {
                    setGroupKind('district')
                    setAdministrativeGroups(
                        districts.map(districtUnit => ({
                            code: districtUnit.code,
                            name: districtUnit.area_name,
                            units: sortUnits(
                                administrativeLocalities.filter(locality =>
                                    locality.correspondence_code?.startsWith(
                                        districtUnit.code.slice(0, 4),
                                    ),
                                ),
                            ),
                        })),
                    )
                } else if (
                    !isNCR &&
                    !geography.province &&
                    !geography.locality
                ) {
                    const provinceGroups: AdministrativeGroup[] =
                        provinces.map(provinceUnit => ({
                            code: provinceUnit.code,
                            name: provinceUnit.area_name,
                            units: sortUnits(
                                localities.filter(locality =>
                                    locality.prv === provinceUnit.prv,
                                ),
                            ),
                        }))
                    const provinceCodes = new Set(
                        provinces.map(provinceUnit => provinceUnit.prv),
                    )
                    const independentCities = sortUnits(
                        administrativeLocalities.filter(locality =>
                            !provinceCodes.has(locality.prv),
                        ),
                    )

                    if (independentCities.length > 0) {
                        provinceGroups.push({
                            code: INDEPENDENT_CITIES_FILTER,
                            name: 'Independent cities',
                            units: independentCities,
                        })
                    }

                    setGroupKind('province')
                    setAdministrativeGroups(provinceGroups)
                } else if (
                    isIndependentCitiesSelection &&
                    !geography.locality
                ) {
                    setGroupKind('locality-type')
                    setAdministrativeGroups([{
                        code: ALL_CITIES_FILTER,
                        name: 'Cities',
                        units: sortUnits(scopedLocalities),
                    }])
                } else if (
                    !geography.locality &&
                    (selectedDistrict || selectedProvince)
                ) {
                    const cities = sortUnits(
                        scopedLocalities.filter(locality =>
                            locality.geographic_level.trim().toLowerCase() === 'city',
                        ),
                    )
                    const municipalities = sortUnits(
                        scopedLocalities.filter(locality =>
                            locality.geographic_level.trim().toLowerCase() === 'mun',
                        ),
                    )

                    setGroupKind('locality-type')
                    setAdministrativeGroups([
                        {
                            code: ALL_CITIES_FILTER,
                            name: 'Cities',
                            units: cities,
                        },
                        {
                            code: ALL_MUNICIPALITIES_FILTER,
                            name: 'Municipalities',
                            units: municipalities,
                        },
                    ].filter(group => group.units.length > 0))
                } else {
                    setAdministrativeGroups([])
                }

                setScopeName(
                    selectedLocality?.area_name ??
                    (isIndependentCitiesSelection ? 'Independent cities' : undefined) ??
                    (localityType === 'city' ? 'Cities' : undefined) ??
                    (localityType === 'mun' ? 'Municipalities' : undefined) ??
                    selectedProvince?.area_name ??
                    selectedDistrict?.area_name ??
                    selectedRegion.area_name,
                )
                setUnits(
                    selectedLocality
                        ? [selectedLocality]
                        : sortUnits(scopedLocalities),
                )
            } catch (loadError) {
                if (isAbortError(loadError)) return

                console.error(
                    'Unable to load location coverage:',
                    loadError,
                )
                setUnits([])
                setAdministrativeGroups([])
                setError(
                    'Official location coverage could not be loaded.',
                )
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false)
                }
            }
        }

        void loadCoverage()

        return () => controller.abort()
    }, [geography])

    useEffect(() => {
        const controller = new AbortController()

        const loadBoundaries = async () => {
            setBoundaryLoading(true)
            setBoundaryError(null)

            try {
                const data = await getBoundaryGeoJson(
                    geography,
                    controller.signal,
                )

                setBoundaryData(data)
            } catch (loadError) {
                if (isAbortError(loadError)) return

                console.error(
                    'Unable to load boundary map:',
                    loadError,
                )
                setBoundaryData(null)
                setBoundaryError(
                    'The administrative boundary layer could not be loaded.',
                )
            } finally {
                if (!controller.signal.aborted) {
                    setBoundaryLoading(false)
                }
            }
        }

        void loadBoundaries()

        return () => controller.abort()
    }, [geography])

    const isLocalityTypeFilter =
        geography.locality === ALL_CITIES_FILTER ||
        geography.locality === ALL_MUNICIPALITIES_FILTER
    const unitLabel = geography.region
        ? geography.locality && !isLocalityTypeFilter
            ? 'Selected LGU'
            : geography.district
                ? 'District cities and municipality'
            : 'Cities and municipalities'
        : 'Administrative regions'

    const detailGroups = useMemo(() => {
        if (geography.region) return administrativeGroups

        const groupsByIsland = new Map<string, GeographyUnit[]>()

        units.forEach(unit => {
            const islandGroup = unit.island_region?.trim() || 'Unclassified'
            const groupUnits = groupsByIsland.get(islandGroup) ?? []

            groupUnits.push(unit)
            groupsByIsland.set(islandGroup, groupUnits)
        })

        const preferredOrder = ['Luzon', 'Visayas', 'Mindanao']

        return [...groupsByIsland.entries()]
            .sort(([a], [b]) => {
                const aIndex = preferredOrder.indexOf(a)
                const bIndex = preferredOrder.indexOf(b)

                if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
                if (aIndex === -1) return 1
                if (bIndex === -1) return -1

                return aIndex - bIndex
            })
            .map(([name, groupUnits]) => ({
                code: `island-group-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                name,
                units: sortUnits(groupUnits),
            }))
    }, [administrativeGroups, geography.region, units])

    const displayedBoundaryData = useMemo(() => {
        if (
            (
                geography.province !== INDEPENDENT_CITIES_FILTER &&
                !isLocalityTypeFilter
            ) ||
            !boundaryData
        ) return boundaryData

        const localityCodes = new Set(units.flatMap(unit => [
            unit.code,
            ...(unit.correspondence_code ? [unit.correspondence_code] : []),
        ]))

        return {
            ...boundaryData,
            features: boundaryData.features.filter(feature => {
                return [
                    feature.properties.psgc_10d,
                    feature.properties.psgc_code,
                    feature.properties.city_code,
                    feature.properties.prov_code,
                ].some(code => Boolean(code && localityCodes.has(code)))
            }),
        }
    }, [boundaryData, geography.province, isLocalityTypeFilter, units])
    const locationMetrics = useMemo(
        () => getPlaceholderLocationMetrics(units, period),
        [period, units],
    )
    const locationMetricByCode = useMemo(
        () => new Map(locationMetrics.map(metric => [metric.code, metric])),
        [locationMetrics],
    )

    const canMoveUp = !hasAssignedCoverageLock && Boolean(geography.locality || geography.district || geography.province)
    const upLevelLabel = canMoveUp
        ? geography.locality
            ? geography.district
                ? 'Up to district'
                : geography.province
                    ? 'Up to province'
                    : 'Up to region'
            : geography.district || geography.province
                ? 'Up to region'
                : null
        : null

    const moveUpOneLevel = () => {
        if (hasAssignedCoverageLock) return

        if (geography.locality) {
            onGeographyChange({
                ...geography,
                locality: '',
            })
            return
        }

        if (geography.district) {
            onGeographyChange({
                ...geography,
                district: '',
                locality: '',
            })
            return
        }

        if (geography.province) {
            onGeographyChange({
                ...geography,
                province: '',
                locality: '',
            })
            return
        }

        if (geography.region) {
            onGeographyChange({
                region: '',
                province: '',
                district: '',
                locality: '',
            })
        }
    }

    return (
        <div className="space-y-6">
            {upLevelLabel && (
                <nav aria-label="Location hierarchy navigation">
                    <button
                        type="button"
                        onClick={moveUpOneLevel}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-300 hover:text-blue-700 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        aria-label={`${upLevelLabel} in the location hierarchy`}
                    >
                        <ArrowUp size={14} aria-hidden="true" />
                        {upLevelLabel}
                    </button>
                </nav>
            )}

            <AdministrativeBreakdown
                groups={administrativeGroups}
                kind={groupKind}
                metrics={locationMetrics}
                onGroupSelect={group => {
                    if (hasAssignedCoverageLock) return

                    if (groupKind === 'district') {
                        onGeographyChange({
                            ...geography,
                            province: '',
                            district: group.code,
                            locality: '',
                        })
                    } else if (groupKind === 'province') {
                        onGeographyChange({
                            ...geography,
                            province: group.code,
                            district: '',
                            locality: '',
                        })
                    } else if (groupKind === 'locality-type') {
                        onGeographyChange({
                            ...geography,
                            locality: group.code,
                        })
                    }
                }}
            />

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-sm font-bold text-slate-800">
                        {scopeName} — Sentiment Map
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                        {PERIOD_LABELS[period] ?? 'Selected period'} · Official PSGC coverage
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">Simulation data</span>
                    <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-green-500" />Positive</span>
                    <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Mixed</span>
                    <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-red-500" />Negative</span>
                    {hasAssignedCoverageLock && (
                        <span className="ml-2 rounded-full bg-rose-50 text-rose-700 px-2 py-1 text-[11px] font-semibold">
                            Coverage locked to assigned area
                        </span>
                    )}
                </div>
            </header>

            <div className="grid min-h-[420px] grid-cols-1 lg:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.4fr)]">
                <div className="relative flex items-center justify-center border-b border-slate-100 bg-slate-50/60 p-8 lg:border-b-0 lg:border-r">
                    {boundaryLoading && (
                        <div className="text-sm text-slate-500" role="status">
                            Loading boundary map…
                        </div>
                    )}

                    {!boundaryLoading && boundaryError && (
                        <div className="max-w-sm rounded-lg border border-red-100 bg-red-50 p-5 text-center text-sm text-red-700" role="alert">
                            {boundaryError}
                        </div>
                    )}

                    {!boundaryLoading && !boundaryError && displayedBoundaryData?.features.length === 0 && (
                        <div className="max-w-sm rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center">
                            <h3 className="text-sm font-bold text-slate-700">
                                No boundary polygon available
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                The boundary source does not yet include this selected PSGC area.
                            </p>
                        </div>
                    )}

                    {!boundaryLoading && !boundaryError && displayedBoundaryData && displayedBoundaryData.features.length > 0 && (
                        <>
                            <GeoJsonMap data={displayedBoundaryData} metrics={locationMetrics} />
                            <MapLegend />
                        </>
                    )}

                    {boundaryLoading && (
                        <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
                            <svg className="h-10 w-10 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                        </div>
                    )}
                </div>

                <div className="min-w-0 p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                {unitLabel}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                                Names and codes are loaded from the PSA PSGC API.
                            </p>
                        </div>

                        {!loading && !error && (
                            <span className="shrink-0 text-xs font-semibold text-slate-500">
                                {units.length.toLocaleString()} listed
                            </span>
                        )}
                    </div>

                    {loading && (
                        <div className="flex min-h-64 items-center justify-center text-sm text-slate-500" role="status">
                            Loading official locations…
                        </div>
                    )}

                    {!loading && error && (
                        <div className="flex min-h-64 items-center justify-center rounded-lg border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700" role="alert">
                            {error}
                        </div>
                    )}

                    {!loading && !error && units.length === 0 && (
                        <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                            No official locations were returned for this coverage.
                        </div>
                    )}

                    {!loading && !error && units.length > 0 && (
                        <div className="max-h-[340px] overflow-y-auto pr-2">
                            {units.map(unit => {
                                const metric = locationMetricByCode.get(unit.code)

                                return (
                                <div
                                    key={unit.code}
                                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-slate-100 py-3 first:border-t-0"
                                >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <MapPin size={14} className="shrink-0 text-slate-700" />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-700">
                                                {unit.area_name}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                PSGC {unit.code}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <span className="block text-xs font-semibold tabular-nums text-slate-600">
                                            {metric?.mentions.toLocaleString() ?? '—'}
                                        </span>
                                        <span className="text-[10px] text-slate-400">simulated mentions</span>
                                    </div>
                                </div>
                                )
                            })}
                        </div>
                    )}

                    <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-400">
                        Boundary geometry: PSA/NAMRIA-derived national layer and GeoRiskPH PSA ArcGIS LGU layers. Location metrics are deterministic simulation data until a live PSGC-coded sentiment feed is connected.
                    </p>
                </div>
            </div>
            </section>

            <LocationAnalyticsPanels
                groups={detailGroups}
                loading={loading}
                metrics={locationMetrics}
                scopeName={scopeName}
                unitLevel={geography.region ? 'locality' : 'region'}
                units={units}
            />
        </div>
    )
}
