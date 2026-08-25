import { useEffect, useMemo, useState } from 'react'

import {
    getLegislativeDistricts,
    getPartyLists,
} from '../../services/electionsApi'
import type {
    ElectionSelection,
    LegislativeDistrict,
    PartyListResult,
} from '../../types/elections'
import type { GeographySelection } from '../../types/geography'
import {
    ALL_CITIES_FILTER,
    ALL_MUNICIPALITIES_FILTER,
    INDEPENDENT_CITIES_FILTER,
} from '../../types/geography'
import { SelectField } from './SelectField'

interface ElectionCoverageControlsProps {
    geography: GeographySelection
    value: ElectionSelection
    onChange: (value: ElectionSelection) => void
    onResolvedChange?: (
        district?: LegislativeDistrict,
        partyList?: PartyListResult,
    ) => void
}

const isAbortError = (error: unknown) =>
    error instanceof Error && error.name === 'AbortError'

export default function ElectionCoverageControls({
    geography,
    value,
    onChange,
    onResolvedChange,
}: ElectionCoverageControlsProps) {
    const [districts, setDistricts] = useState<LegislativeDistrict[]>([])
    const [partyLists, setPartyLists] = useState<PartyListResult[]>([])
    const [districtError, setDistrictError] = useState<string | null>(null)
    const [partyListError, setPartyListError] = useState<string | null>(null)
    const [loadingDistricts, setLoadingDistricts] = useState(false)
    const [loadingPartyLists, setLoadingPartyLists] = useState(false)
    const hasSpecificLocality = Boolean(
        geography.locality &&
        geography.locality !== ALL_CITIES_FILTER &&
        geography.locality !== ALL_MUNICIPALITIES_FILTER,
    )
    const isNCR = geography.region === '1300000000'
    const hasGeographicCoverage = Boolean(
        geography.region ||
        geography.province ||
        geography.district ||
        geography.locality,
    )

    const selectedDistrict = useMemo(
        () => districts.find(item => item.id === value.legislativeDistrictId),
        [districts, value.legislativeDistrictId],
    )
    const selectedPartyList = useMemo(
        () => partyLists.find(item => item.id === value.partyListId),
        [partyLists, value.partyListId],
    )

    useEffect(() => {
        onResolvedChange?.(selectedDistrict, selectedPartyList)
    }, [onResolvedChange, selectedDistrict, selectedPartyList])

    useEffect(() => {
        const controller = new AbortController()

        if (hasGeographicCoverage) {
            setPartyLists([])
            setPartyListError(null)
            setLoadingPartyLists(false)
            if (value.partyListId) {
                onChange({ ...value, partyListId: '' })
            }
            return () => controller.abort()
        }

        setLoadingPartyLists(true)
        setPartyListError(null)

        void getPartyLists({ year: value.electionYear }, controller.signal)
            .then(response => setPartyLists(response.data))
            .catch(error => {
                if (isAbortError(error)) return
                console.error('Unable to load party-list organizations:', error)
                setPartyLists([])
                setPartyListError('Unable to load party-list organizations.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingPartyLists(false)
            })

        return () => controller.abort()
    }, [hasGeographicCoverage, value.electionYear])

    useEffect(() => {
        const controller = new AbortController()
        setDistrictError(null)

        const locality = geography.locality &&
            geography.locality !== ALL_CITIES_FILTER &&
            geography.locality !== ALL_MUNICIPALITIES_FILTER
            ? geography.locality
            : undefined

        if (
            (value.coverageMode !== 'legislative' && !locality) ||
            (isNCR && !locality)
        ) {
            setDistricts([])
            setLoadingDistricts(false)

            if (value.legislativeDistrictId) {
                onChange({ ...value, legislativeDistrictId: '' })
            }

            return () => controller.abort()
        }

        setDistricts([])
        setLoadingDistricts(true)
        const province = geography.province &&
            geography.province !== INDEPENDENT_CITIES_FILTER
            ? geography.province
            : undefined

        void getLegislativeDistricts({
            year: value.electionYear,
            region: geography.region || undefined,
            ncrDistrict: geography.district || undefined,
            province,
            locality,
        }, controller.signal)
            .then(response => {
                setDistricts(response.data)

                if (
                    value.coverageMode === 'legislative' &&
                    locality &&
                    response.data.length === 1
                ) {
                    const [district] = response.data
                    if (value.legislativeDistrictId !== district.id) {
                        onChange({
                            ...value,
                            legislativeDistrictId: district.id,
                        })
                    }
                    return
                }

                if (
                    value.legislativeDistrictId &&
                    !response.data.some(item => item.id === value.legislativeDistrictId)
                ) {
                    onChange({ ...value, legislativeDistrictId: '' })
                }
            })
            .catch(error => {
                if (isAbortError(error)) return
                console.error('Unable to load legislative districts:', error)
                setDistricts([])
                setDistrictError('Unable to load legislative districts.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingDistricts(false)
            })

        return () => controller.abort()
    }, [
        geography.locality,
        geography.district,
        geography.province,
        geography.region,
        isNCR,
        value.coverageMode,
        value.electionYear,
    ])

    return (
        <div className="space-y-2">
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
                hasGeographicCoverage ? 'xl:grid-cols-3' : 'xl:grid-cols-4'
            }`}>
                <SelectField
                    label="Coverage basis"
                    value={value.coverageMode}
                    onChange={event => onChange({
                        ...value,
                        coverageMode: event.target.value as ElectionSelection['coverageMode'],
                        legislativeDistrictId: '',
                    })}
                >
                    <option value="administrative">Administrative coverage</option>
                    <option value="legislative">Legislative district</option>
                </SelectField>

                <SelectField
                    label="Election year"
                    value={value.electionYear}
                    onChange={event => onChange({
                        ...value,
                        electionYear: Number(event.target.value),
                        legislativeDistrictId: '',
                        partyListId: '',
                    })}
                >
                    <option value={2025}>2025 national and local elections</option>
                </SelectField>

                <SelectField
                    label="Legislative district"
                    value={value.legislativeDistrictId}
                    disabled={
                        value.coverageMode !== 'legislative' ||
                        loadingDistricts ||
                        districts.length === 0 ||
                        (
                            hasSpecificLocality &&
                            districts.length === 1 &&
                            Boolean(value.legislativeDistrictId)
                        )
                    }
                    onChange={event => onChange({
                        ...value,
                        legislativeDistrictId: event.target.value,
                    })}
                >
                    <option value="">
                        {value.coverageMode !== 'legislative'
                            ? 'Choose legislative coverage first'
                            : isNCR && !geography.district
                                ? 'Select NCR district first'
                            : isNCR && !hasSpecificLocality
                                ? 'Select city or municipality first'
                            : loadingDistricts
                                ? 'Loading districts…'
                                : districts.length === 0
                                    ? 'No matching districts'
                                    : 'Select legislative district'}
                    </option>
                    {districts.map(district => (
                        <option key={district.id} value={district.id}>
                            {district.label}
                        </option>
                    ))}
                </SelectField>

                {!hasGeographicCoverage && (
                    <SelectField
                        label="Party-list focus"
                        value={value.partyListId}
                        disabled={loadingPartyLists}
                        onChange={event => onChange({
                            ...value,
                            partyListId: event.target.value,
                        })}
                    >
                        <option value="">
                            {loadingPartyLists ? 'Loading party lists…' : 'All party-list organizations'}
                        </option>
                        {partyLists.map(partyList => (
                            <option key={partyList.id} value={partyList.id}>
                                {partyList.rank}. {partyList.acronym || partyList.officialName}
                            </option>
                        ))}
                    </SelectField>
                )}
            </div>

            {(districtError || partyListError) && (
                <p className="text-xs text-red-600" role="alert">
                    {districtError ?? partyListError}
                </p>
            )}
        </div>
    )
}
