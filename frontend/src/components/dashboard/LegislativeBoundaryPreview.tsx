import { useEffect, useMemo, useState } from 'react'

import { getLegislativeDistrictBoundary } from '../../services/electionsApi'
import type { LegislativeDistrict } from '../../types/elections'
import type { BoundaryFeatureCollection } from '../../types/geography'
import GeoJsonMap from '../location/GeoJsonMap'

interface LegislativeBoundaryPreviewProps {
    district?: LegislativeDistrict
    electionYear: number
}

const isAbortError = (error: unknown) =>
    error instanceof Error && error.name === 'AbortError'

export default function LegislativeBoundaryPreview({
    district,
    electionYear,
}: LegislativeBoundaryPreviewProps) {
    const [boundary, setBoundary] = useState<BoundaryFeatureCollection | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        setBoundary(null)
        setError(null)

        if (!district || district.status !== 'partial-boundary') {
            setLoading(false)
            return () => controller.abort()
        }

        setLoading(true)
        void getLegislativeDistrictBoundary(district.id, electionYear, controller.signal)
            .then(setBoundary)
            .catch(requestError => {
                if (isAbortError(requestError)) return
                console.error('Unable to load legislative boundary:', requestError)
                setError('The boundary preview could not be loaded.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })

        return () => controller.abort()
    }, [district, electionYear])

    const feature = boundary?.features[0]
    const hasGeometry = Boolean(feature?.geometry)
    const membershipSummary = useMemo(() => {
        if (!district) return []
        return district.memberships.map(membership => ({
            code: membership.localityCode,
            label: membership.localityName,
            coverage: membership.coverage,
        }))
    }, [district])

    if (!district) return null

    return (
        <section className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Legislative coverage preview
                    </p>
                    <h3 className="mt-0.5 text-xs font-semibold text-slate-800">
                        {district.label}
                    </h3>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    feature?.properties.boundaryStatus === 'verified'
                        ? 'bg-emerald-100 text-emerald-700'
                        : hasGeometry
                            ? 'bg-amber-100 text-amber-700'
                            : district.status === 'locality-resolved'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-200 text-slate-600'
                }`}>
                    {feature?.properties.boundaryStatus === 'verified'
                        ? 'Verified boundary'
                        : hasGeometry
                            ? 'Draft boundary'
                            : district.status === 'locality-resolved'
                                ? 'Whole-locality coverage'
                                : 'Boundary pending'}
                </span>
            </div>

            {loading ? (
                <div className="flex min-h-36 items-center justify-center text-xs text-slate-500" role="status">
                    Loading legislative boundary…
                </div>
            ) : hasGeometry && boundary ? (
                <GeoJsonMap
                    data={boundary}
                    selectedKey={district.id}
                    height={180}
                    ariaLabel={`${district.label} boundary preview`}
                />
            ) : (
                <div className="space-y-2 px-3 py-3">
                    <p className="text-xs text-slate-600">
                        {district.status === 'locality-resolved'
                            ? 'This district is resolved from whole city and municipality memberships.'
                            : 'An internal city boundary has not been entered yet. The listed locality remains a partial coverage reference.'}
                    </p>
                    <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
                        {membershipSummary.map(membership => (
                            <span
                                key={`${membership.code}-${membership.coverage}`}
                                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                                title={`PSGC ${membership.code}`}
                            >
                                {membership.label}
                                {membership.coverage === 'partial' ? ' · partial' : ''}
                            </span>
                        ))}
                    </div>
                    {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
                </div>
            )}
        </section>
    )
}
