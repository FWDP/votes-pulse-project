import {
    type ReactNode,
    type SelectHTMLAttributes,
    useEffect,
    useMemo,
    useState,
} from 'react'

import { Globe2, MapPin, ChevronDown, Loader2 } from 'lucide-react'
import { json } from 'express'

type Scope = 'national' | 'provincial' | 'congressional' | 'partylist'

type GeographyUnit = {
    code: string,
    name: string,
    provinceCode?: string
}

type ScopeOption = {
    id: Scope
    label: string
    icon: typeof Globe2
}

const scopes: ScopeOption[] = [
    {
        id: 'national',
        label: 'National',
        icon: Globe2,
    },
    {
        id: 'provincial',
        label: 'Provincial',
        icon: MapPin,
    }
]

const getApiBaseUrl = () => {
    const apiBaseUrl = (
        import.meta as ImportMeta & {
            env?: {
                VITE_API_BASE_URL?: string;
            };
        }
    ).env?.VITE_API_BASE_URL ?? '';

    return apiBaseUrl.replace(/\/+$/, '');
};

const getApiUrl = (path: string) => {
    const apiBaseUrl = getApiBaseUrl();

    return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
};

export default function GeographyControls() {
    /*
    * Scope
    */
    const [scope, setScope] = useState<Scope>('national')

    /*
    * Normaliser
    */

    const normalizeText = (value?: string) => {
        if (!value) return ''

        return value
            .replaceAll('Ã±', 'ñ')
    }

    /*
     * Geographic data
     */
    const [regions, setRegions] = useState<GeographyUnit[]>([])
    const [provinces, setProvinces] = useState<GeographyUnit[]>([])
    const [localities, setLocalities] = useState<GeographyUnit[]>([])

    /*
     * Geographic selections
     */
    const [region, setRegion] = useState('')
    const [province, setProvince] = useState('')
    const [locality, setLocality] = useState('')

    /*
    * ============================================
    * Loading
    * ============================================
    */

    const [regionLoading, setRegionLoading] =
        useState(true)

    const [provinceLoading, setProvinceLoading] =
        useState(true)

    const [localityLoading, setLocalityLoading] =
        useState(true)

    /*
    * ============================================
    * Load regions
    * ============================================
    */

    useEffect(() => {

        const regions = async () => {
            try {
                const response = await fetch(getApiUrl('/regions'), {
                    headers: {
                        Accept: 'application/json',
                    },
                })
                const json = await response.json()
                setRegions(json.data)
            } catch (error) {
                console.error('Unable to load regions:', error)

                setRegions([])
            } finally {
                setRegionLoading(false)
            }
        }
        regions()
    }, [])

    /*
    * ============================================
    * Load provinces + cities/municipalities
    * ============================================
    */

    // Provinces
    useEffect(() => {
        if (region.length === 0) return
        const provinces = async () => {
            try {
                const response = await fetch(getApiUrl(`/regions/${encodeURIComponent(region)}/provinces`), {
                    headers: {
                        Accept: 'application/json',
                    },
                })

                const json = await response.json()

                setProvinces(json.data)
            } catch (error) {
                console.error('Unable to load provinces:', error)

                setProvinces([])
            } finally {
                setProvinceLoading(false)
            }
        }
        provinces()
    }, [region])

    const isNCR = useMemo(() => region === '1300000000', [region])
    // Cities/Municipalities - Provinces exist
    useEffect(() => {
        const selectedProvince = province?.trim()
        const selectedRegion = region?.trim()

        // Nothing selected yet
        if (!selectedProvince && !selectedRegion) return setLocalities([])

        if (isNCR) {
            setProvince('')
            setProvinces([])
            setProvinceLoading(false)
        }

        const localities = async () => {
            setLocalityLoading(true)

            try {
                const endpoint = selectedProvince && !isNCR
                    ? `/provinces/${encodeURIComponent(selectedProvince)}/cities-municipalities`
                    : `/regions/${encodeURIComponent(selectedRegion)}/cities-municipalities`

                const response = await fetch(getApiUrl(endpoint), {
                    headers: {
                        Accept: 'application/json',
                    },
                })

                if (!response.ok) {
                    throw new Error(
                        `Unable to load localities: ${response.status} ${response.statusText}`
                    )
                }

                const json = await response.json()

                const filteredLocalities = json.data.filter((
                    item: any) => {
                    if (item.type === "SubMun" && isNCR) return false
                    if (province === "1208000000" && !item.code.startsWith("1208")) return false
                    return true
                })
                    .map((item: { code: string; name: string; }) => {
                        return {
                            ...item,
                            name: normalizeText(item.name),
                        }
                    })

                setLocalities(filteredLocalities ?? [])
            } catch (error) {
                console.error('Unable to load localities:', error)

                setLocalities([])
            } finally {
                setLocalityLoading(false)
            }
        }
        localities()
    }, [province, region, isNCR])

    /*
    * ============================================
    * Scope changes
    * ============================================
    */

    const handleScopeChange = (
        newScope: Scope,
    ) => {
        setScope(newScope)

        /*
        * We deliberately keep selections when tabs
        * change so users don't lose their previous
        * filtering state.
        */
    }

    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* ===================================== */}
            {/* Header */}
            {/* ===================================== */}

            <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                        <MapPin size={19} />
                    </div>

                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-slate-800 sm:text-base">
                            Coverage Scope
                        </h2>

                        <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-slate-500 sm:text-sm">
                            Choose how dashboard data should
                            be segmented across national,
                            geographic, Party-list, and
                            congressional coverage.
                        </p>
                    </div>
                </div>

                {/* =================================== */}
                {/* Scope tabs */}
                {/* =================================== */}

                <div className="mt-4 overflow-x-auto rounded-xl bg-slate-100 p-1">
                    <div
                        className="
                        grid
                        min-w-full
                        grid-flow-col
                        auto-cols-[minmax(150px,1fr)]
                        gap-1
                        "
                        role="tablist"
                        aria-label="Coverage scope"
                    >
                        {scopes.map(item => {
                            const Icon = item.icon
                            const selected = scope === item.id

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={selected}
                                    onClick={() => handleScopeChange(item.id)}
                                    className={`
                                flex
                                min-h-10
                                items-center
                                justify-center
                                gap-2
                                whitespace-nowrap
                                rounded-lg
                                px-3
                                py-2
                                text-xs
                                font-medium
                                transition-all
                                duration-150
                                sm:text-sm

                                ${selected
                                            ? `
                                    bg-white
                                    text-emerald-700
                                    shadow-sm
                                    ring-1
                                    ring-slate-200
                                    `
                                            : `
                                    text-slate-500
                                    hover:bg-white/60
                                    hover:text-slate-700
                                    `
                                        }
                            `}
                                >
                                    <Icon
                                        size={15}
                                        className="shrink-0"
                                    />

                                    <span>{item.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* =================================== */}
                {/* National */}
                {/* =================================== */}

                {scope === 'national' && (
                    <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm">
                                <Globe2 size={17} />
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-slate-700">
                                    National Coverage
                                </h3>

                                <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
                                    Dashboard metrics currently
                                    represent nationwide aggregate
                                    data. No additional location
                                    filters are applied.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* =================================== */}
                {/* Provincial */}
                {/* =================================== */}

                {scope === 'provincial' && (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <PanelHeading
                            icon={MapPin}
                            title="Provincial & Local Filters"
                            description="Narrow dashboard results by region, province, city, or municipality."
                        />

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <SelectField
                                label="Region"
                                value={region}
                                disabled={regionLoading}
                                onChange={event => {
                                    setRegion(
                                        event.target.value,
                                    )

                                    setProvince('')
                                }}
                            >
                                <option value="">
                                    {regionLoading
                                        ? 'Loading regions…'
                                        : 'All 18 regions'}
                                </option>
                                {regions.map(item => (
                                    <option
                                        key={item.code}
                                        value={item.code}
                                    >
                                        {item.name}
                                    </option>
                                ))}
                            </SelectField>

                            <SelectField
                                label="Province"
                                value={province}
                                disabled={
                                    !region ||
                                    provinceLoading ||
                                    isNCR
                                }
                                onChange={event => {
                                    setProvince(
                                        event.target.value,
                                    )
                                }}
                            >
                                <option value="">
                                    {!region
                                        ? 'Select region first'
                                        : provinceLoading && provinces.length !== 0
                                            ? 'Loading provinces…'
                                            : provinces.length === 0 ? 'No province in NCR' : 'All provinces'
                                    }
                                </option>

                                {provinces.map(item => (
                                    <option
                                        key={item.code}
                                        value={item.code}
                                    >
                                        {item.name}
                                    </option>
                                ))}
                            </SelectField>

                            <SelectField
                                label="City / Municipality"
                                value={locality}
                                disabled={
                                    !region ||
                                    (!isNCR && !province) ||
                                    localityLoading
                                }
                                onChange={event =>
                                    setLocality(
                                        event.target.value,
                                    )
                                }
                            >
                                <option value="">
                                    {!region
                                        ? 'Select region first'
                                        : !isNCR && !province
                                            ? 'Select province first'
                                            : localityLoading
                                                ? 'Loading cities & municipalities…'
                                                : localities.length === 0
                                                    ? 'No cities & municipalities found'
                                                    : 'All cities & municipalities'
                                    }
                                </option>

                                {localities.map(item => (
                                    <option
                                        key={item.code}
                                        value={item.code}
                                    >
                                        {item.name}
                                    </option>
                                ))}
                            </SelectField>
                        </div>
                    </div>
                )}
            </div>

            {/* ===================================== */}
            {/* Status footer */}
            {/* ===================================== */}

            <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
                <div className="flex items-start gap-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />

                    <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">
                        Showing National Data
                    </p>
                </div>
            </div>
        </section>
    )
}

/*
 * ============================================
 * Select
 * ============================================
 */

type SelectFieldProps =
    SelectHTMLAttributes<HTMLSelectElement> & {
        label: string
        children: ReactNode
    }

function SelectField({
    label,
    children,
    className = '',
    ...props
}: SelectFieldProps) {
    return (
        <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
                {label}
            </label>

            <div className="relative">
                <select
                    {...props}
                    className={`
            h-10
            w-full
            appearance-none
            truncate
            rounded-lg
            border
            border-slate-200
            bg-white
            px-3
            pr-9
            text-sm
            text-slate-700
            outline-none
            transition-all
            duration-150

            hover:border-slate-300

            focus:border-emerald-500
            focus:ring-2
            focus:ring-emerald-100

            disabled:cursor-not-allowed
            disabled:border-slate-200
            disabled:bg-slate-100
            disabled:text-slate-400

            ${className}
          `}
                >
                    {children}
                </select>

                <ChevronDown
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
            </div>
        </div>
    )
}

/*
 * ============================================
 * Panel heading
 * ============================================
 */

type PanelHeadingProps = {
    icon: typeof Globe2
    title: string
    description: string
    loading?: boolean
}

function PanelHeading({
    icon: Icon,
    title,
    description,
    loading = false,
}: PanelHeadingProps) {
    return (
        <div className="mb-4 flex items-start justify-between gap-4">
            <div>
                <div className="flex items-center gap-2">
                    <Icon
                        size={16}
                        className="text-emerald-600"
                    />

                    <h3 className="text-sm font-semibold text-slate-700">
                        {title}
                    </h3>
                </div>

                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                    {description}
                </p>
            </div>

            {loading && <LoadingBadge />}
        </div>
    )
}

/*
 * ============================================
 * Loading badge
 * ============================================
 */

function LoadingBadge() {
    return (
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-400">
            <Loader2
                size={12}
                className="animate-spin"
            />

            <span>Loading</span>
        </div>
    )
}