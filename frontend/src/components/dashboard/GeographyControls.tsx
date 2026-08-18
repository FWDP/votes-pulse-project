import {
    useEffect,
    useMemo,
    useState,
} from 'react'

import {
    SelectField,
} from '../dashboard/SelectField'

import {
    getDistricts,
    getMunicipalities,
    getProvinces,
    getRegions,
} from '../../services/geographyApi'

import {
    ALL_CITIES_FILTER,
    ALL_MUNICIPALITIES_FILTER,
    INDEPENDENT_CITIES_FILTER,
    type GeographySelection,
    type GeographyUnit,
    type ResolvedGeographySelection,
} from '../../types/geography'

interface GeographyControlsProps {
    value: GeographySelection

    onChange: (
        value: GeographySelection,
    ) => void

    onResolvedChange?: (
        value: ResolvedGeographySelection,
    ) => void

    disabled?: boolean
}

const sortGeographyUnits = (
    items: GeographyUnit[],
) => {
    return [...items].sort((a, b) =>
        a.area_name.localeCompare(
            b.area_name,
            undefined,
            {
                sensitivity: 'base',
            },
        )
    )
}

/**
 * Keep Unicode from the API intact.
 *
 * This preserves proper values such as:
 *
 * Parañaque
 * Las Piñas
 * Biñan
 */
const normalizeAreaName = (
    value: string,
) => {
    let repaired = value

    if (/[ÃÂ]/.test(repaired)) {
        try {
            repaired = new TextDecoder(
                'utf-8',
                { fatal: true },
            ).decode(
                Uint8Array.from(
                    repaired,
                    character =>
                        character.charCodeAt(0),
                ),
            )
        } catch {
            // Keep the API value when it is not Latin-1 mojibake.
        }
    }

    return repaired
        .replace(/Para[?�]aque/gi, 'Parañaque')
        .replace(/Pi[?�]as/gi, 'Piñas')
        .replace(/Bi[?�]an/gi, 'Biñan')
        .replace(/Mu[?�]oz/gi, 'Muñoz')
        .replace(/Pe[?�]aranda/gi, 'Peñaranda')
        .replace(/Do[?�]a/gi, 'Doña')
        .normalize('NFC')
}

const isAbortError = (error: unknown) =>
    error instanceof Error &&
    error.name === 'AbortError'

export function GeographyControls({
    value,
    onChange,
    onResolvedChange,
    disabled = false,
}: GeographyControlsProps) {
    const {
        region,
        province,
        district,
        locality
    } = value;

    const [regions, setRegions] = useState<GeographyUnit[]>([])
    const [provinces, setProvinces] = useState<GeographyUnit[]>([])
    const [districts, setDistricts] = useState<GeographyUnit[]>([])
    const [localities, setLocalities] = useState<GeographyUnit[]>([])

    const [isLoadingRegions, setIsLoadingRegions] = useState<boolean>(false)
    const [isLoadingProvinces, setIsLoadingProvinces] = useState<boolean>(false)
    const [isLoadingDistricts, setIsLoadingDistricts] = useState<boolean>(false)
    const [isLoadingLocalities, setIsLoadingLocalities] = useState<boolean>(false)

    const [regionError, setRegionError] = useState<string | null>(null)
    const [provinceError, setProvinceError] = useState<string | null>(null)
    const [districtError, setDistrictError] = useState<string | null>(null)
    const [localityError, setLocalityError] = useState<string | null>(null)

    /**
     * Selected official PSGC region.
     */
    const selectedRegion = useMemo(
        () => regions.find(
            (item) => item.code === region,
        ),
        [region, regions],
    )

    /**
     * NCR is region 13 in the PSGC.
     *
     * Using the numeric `reg` field is
     * cleaner than testing names.
     */
    const isNCR = selectedRegion?.reg === 13
    const isIndependentCitiesSelection =
        province === INDEPENDENT_CITIES_FILTER

    /**
     * Selected official PSGC province.
     */
    const selectedProvince = useMemo(() =>
                provinces.find(item =>
                        item.code === province,
                ),
            [provinces, province,],
        )

    const selectedDistrict = useMemo(
        () => districts.find(item => item.code === district),
        [district, districts],
    )

    const independentCities = useMemo(() => {
        const provinceCodes = new Set(
            provinces
                .map(item => item.prv)
                .filter(
                    (prv): prv is number =>
                        prv !== undefined,
                ),
        )

        return sortGeographyUnits(
            localities.filter(item =>
                item.geographic_level
                    .trim()
                    .toLowerCase() === 'city' &&
                (isNCR ||
                    item.prv === undefined ||
                    !provinceCodes.has(item.prv)),
            ),
        )
    }, [isNCR, localities, provinces])
    
    /**
     * PSA municipalities endpoint includes
     * municipalities and cities.
     *
     * Defensive filtering prevents SubMun
     * entries from appearing in the selector.
     */
    const filteredLocalities = useMemo(() => {
            const citiesAndMunicipalities = localities.filter(item => {
                const level = item.geographic_level
                    .trim()
                    .toLowerCase()

                return level === 'city' || level === 'mun'
            })

            if (isNCR) {
                const districtPrefix =
                    selectedDistrict?.code.slice(0, 4)

                return sortGeographyUnits(
                    districtPrefix
                        ? citiesAndMunicipalities.filter(item =>
                            item.correspondence_code?.startsWith(
                                districtPrefix,
                            ),
                        )
                        : citiesAndMunicipalities,
                )
            }

            if (isIndependentCitiesSelection) {
                return independentCities
            }

            if (selectedProvince) {
                return sortGeographyUnits(
                    citiesAndMunicipalities,
                )
            }

            return independentCities
        }, [independentCities, isIndependentCitiesSelection, isNCR, localities, selectedDistrict, selectedProvince])

    const selectedLocality = useMemo(
        () => filteredLocalities.find(item => item.code === locality),
        [filteredLocalities, locality],
    )

    useEffect(() => {
        onResolvedChange?.({
            region: selectedRegion,
            province: selectedProvince,
            district: selectedDistrict,
            locality: selectedLocality,
        })
    }, [onResolvedChange, selectedDistrict, selectedLocality, selectedProvince, selectedRegion])
    
    /**
     * Load regions once.
     */
    useEffect(() => {
        setIsLoadingRegions(true)
        setRegionError(null)

        const controller = new AbortController()

        const loadRegions = async () => {
            try {
                const data = await getRegions(controller.signal)

                setRegions(sortGeographyUnits(data))
            } catch (error) {
                if (isAbortError(error)) return

                console.error('Unable to load regions:',error,)

                setRegions([])

                setRegionError('Unable to load regions.',)
            } finally {
                if(!controller.signal.aborted) setIsLoadingRegions(false)
            }
        }

        loadRegions()

        return () => {
            controller.abort()
        }
    }, [])

    /**
     * Load provinces once.
     */
    useEffect(() => {
        const controller = new AbortController()
        
        setProvinces([])
        setProvinceError(null)

        if (!selectedRegion || isNCR) {
            setIsLoadingProvinces(false)
            return () => controller.abort()
        }

        const reg = selectedRegion.reg
        
        const loadProvinces = async () => {
            setIsLoadingProvinces(true)

            try {
                const data = await getProvinces(
                    reg,
                    controller.signal,
                )

                setProvinces(
                    sortGeographyUnits(
                        data.filter(item =>
                            item.geographic_level
                                .trim()
                                .toLowerCase() === 'prov',
                        ),
                    ),
                )
            } catch (error) {
                if (isAbortError(error)) return

                console.error('Unable to load provinces:',error,)

                setProvinces([])

                setProvinceError('Unable to load provinces.',)
            } finally {
                if(!controller.signal.aborted) setIsLoadingProvinces(false)
            }
        }

        loadProvinces()

        return () => {controller.abort()}
    }, [selectedRegion, isNCR])

    /**
     * NCR uses four official PSGC statistical districts instead of
     * provinces at the middle level of the administrative hierarchy.
     */
    useEffect(() => {
        const controller = new AbortController()

        setDistricts([])
        setDistrictError(null)

        if (!selectedRegion || !isNCR) {
            setIsLoadingDistricts(false)
            return () => controller.abort()
        }

        const loadDistricts = async () => {
            setIsLoadingDistricts(true)

            try {
                const data = await getDistricts(
                    selectedRegion.reg,
                    controller.signal,
                )

                setDistricts(data)
            } catch (error) {
                if (isAbortError(error)) return

                console.error('Unable to load NCR districts:', error)
                setDistricts([])
                setDistrictError('Unable to load NCR districts.')
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoadingDistricts(false)
                }
            }
        }

        void loadDistricts()

        return () => controller.abort()
    }, [selectedRegion, isNCR])

    /**
     * Load city / municipality.
     */
    useEffect(() => {
        const controller = new AbortController()
        
        setLocalities([])
        setLocalityError(null)

        if (
            !selectedRegion
        ) {
            setIsLoadingLocalities(false)
            return () => controller.abort()
        }

        const reg = selectedRegion.reg
        const prv = selectedProvince?.prv
        
        const loadLocalities = async () => {
            setIsLoadingLocalities(true)

            try {
                const data = await getMunicipalities({
                    reg,
                    prv: isNCR ? undefined : prv,
                }, controller.signal)

                setLocalities(sortGeographyUnits(data))
            } catch (error) {
                if (isAbortError(error)) return

                console.error('Unable to load localities:',error,)

                setLocalities([])

                setLocalityError(
                    'Unable to load cities and municipalities.',
                )
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoadingLocalities(false)
                }
            }
        }

        loadLocalities()

        return () => {controller.abort()}
    }, [selectedRegion, selectedProvince, isNCR])

    const handleRegionChange = (nextRegion: string) => {
        if (disabled) return
        onChange({
            region: nextRegion,
            province: "",
            district: "",
            locality: "",
        })
    }

    const handleProvinceChange = (nextProvince: string) => {
        if (disabled) return
        onChange({
            region,
            province: nextProvince,
            district: "",
            locality: "",
        })
    }

    const handleDistrictChange = (nextDistrict: string) => {
        if (disabled) return
        onChange({
            region,
            province: "",
            district: nextDistrict,
            locality: "",
        })
    }

    const handleLocalityChange = (nextLocality: string) => {
        if (disabled) return
        onChange({
            region,
            province,
            district,
            locality: nextLocality,
        })
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* REGION */}

                <SelectField
                    label="Region"
                    value={region}
                    disabled={
                        disabled || isLoadingRegions
                    }
                    onChange={event =>
                        handleRegionChange(
                            event.target
                                .value,
                        )
                    }
                >
                    <option value="">
                        {isLoadingRegions
                            ? 'Loading regions…'
                            : 'All regions'}
                    </option>

                    {regions.map(
                        item => (
                            <option
                                key={
                                    item.code
                                }
                                value={
                                    item.code
                                }
                            >
                                {normalizeAreaName(
                                    item.area_name,
                                )}
                            </option>
                        ),
                    )}
                </SelectField>

                {/* PROVINCE / NCR STATISTICAL DISTRICT */}

                <SelectField
                    label={isNCR ? 'District' : 'Province'}
                    value={isNCR ? district : province}
                    disabled={
                        disabled || !region ||
                        (isNCR
                            ? isLoadingDistricts
                            : isLoadingProvinces)
                    }
                    onChange={event => {
                        if (isNCR) {
                            handleDistrictChange(event.target.value)
                        } else {
                            handleProvinceChange(event.target.value)
                        }
                    }}
                >
                    <option value="">
                        {!region
                            ? 'Select region first'
                            : isNCR
                                ? isLoadingDistricts
                                    ? 'Loading districts…'
                                    : 'All districts'
                                : isLoadingProvinces
                                    ? 'Loading provinces…'
                                    : 'All provinces'}
                    </option>

                    {(isNCR ? districts : provinces).map(
                            item => (
                                <option
                                    key={
                                        item.code
                                    }
                                    value={
                                        item.code
                                    }
                                >
                                    {normalizeAreaName(
                                        item.area_name,
                                    )}
                                </option>
                            ),
                        )}

                    {!isNCR && independentCities.length > 0 && (
                        <option value={INDEPENDENT_CITIES_FILTER}>
                            Independent cities
                        </option>
                    )}

                </SelectField>

                {/* CITY / MUNICIPALITY */}

                <SelectField
                    label="City / Municipality"
                    value={locality}
                    disabled={
                        disabled || !region ||
                        (!isNCR &&
                            isLoadingProvinces) ||
                        isLoadingLocalities
                    }
                    onChange={event =>
                        handleLocalityChange(
                            event.target
                                .value,
                        )
                    }
                >
                    <option value="">
                        {!region
                            ? 'Select region first'
                            : isLoadingLocalities
                                    ? 'Loading cities & municipalities…'
                                    : !isNCR &&
                                        !province &&
                                        filteredLocalities.length === 0
                                        ? 'Select province first'
                                    : filteredLocalities.length ===
                                        0
                                        ? 'No cities & municipalities found'
                                    : !province && !isNCR
                                            ? 'Independent cities'
                                            : 'All cities & municipalities'}
                    </option>

                    {filteredLocalities.some(item =>
                        item.geographic_level.trim().toLowerCase() === 'city'
                    ) && (
                        <option value={ALL_CITIES_FILTER}>
                            All cities
                        </option>
                    )}

                    {filteredLocalities.some(item =>
                        item.geographic_level.trim().toLowerCase() === 'mun'
                    ) && (
                        <option value={ALL_MUNICIPALITIES_FILTER}>
                            All municipalities
                        </option>
                    )}

                    {filteredLocalities.map(
                        item => (
                            <option
                                key={
                                    item.code
                                }
                                value={
                                    item.code
                                }
                            >
                                {normalizeAreaName(
                                    item.area_name,
                                )}
                            </option>
                        ),
                    )}
                </SelectField>
            </div>

            {regionError && (
                <p className="text-xs text-red-600">
                    {regionError}
                </p>
            )}

            {provinceError && (
                <p className="text-xs text-red-600">
                    {provinceError}
                </p>
            )}

            {districtError && (
                <p className="text-xs text-red-600">
                    {districtError}
                </p>
            )}

            {localityError && (
                <p className="text-xs text-red-600">
                    {localityError}
                </p>
            )}
        </div>
    )
}
