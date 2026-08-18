import {
    Router,
    type Request,
    type Response,
} from 'express'

const router = Router()

const PSA_BASE_URL =
    'https://classification.psa.gov.ph/psgc'

const BOUNDARY_SERVICE_BASE_URL =
    'https://ulap-nga.georisk.gov.ph/arcgis/rest/services/PSA'

const NATIONAL_BOUNDARY_URL =
    'https://github.com/bendlikeabamboo/barangay-boundaries-repository/releases/download/v2026.4.13.0/regions.geojson'

const PSA_VERSION =
    process.env.PSA_PSGC_VERSION ??
    'Q2_2024'

const REQUEST_TIMEOUT_MS = 15_000
const BOUNDARY_REQUEST_TIMEOUT_MS = 30_000
const PSA_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const BOUNDARY_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CLIENT_CACHE_SECONDS = 60 * 60

const NCR_REGION_CODE = '1300000000'

const NCR_DISTRICTS = [
    {
        code: '133900000',
        area_name: 'NCR, First District',
        geographic_level: 'Dist',
        reg: 13,
    },
    {
        code: '137400000',
        area_name: 'NCR, Second District',
        geographic_level: 'Dist',
        reg: 13,
    },
    {
        code: '137500000',
        area_name: 'NCR, Third District',
        geographic_level: 'Dist',
        reg: 13,
    },
    {
        code: '137600000',
        area_name: 'NCR, Fourth District',
        geographic_level: 'Dist',
        reg: 13,
    },
] as const

const NCR_DISTRICT_CODES = new Set(
    NCR_DISTRICTS.map(district => district.code),
)

interface PopulationData {
    code: string
    population: string
    year: number
}

export interface PSGCRecord {
    psgc_code?: string
    code?: string
    area_name: string
    correspondence_code: string

    geographic_level: string

    reg: number
    prv: number
    mun: number
    bgy: number

    old_name: string
    city_class: string
    income_classification: string
    urban_rural: string
    island_region: string
    status: string
    version: string

    population_data?: PopulationData[]
}

interface PSAResponse {
    count?: number
    next?: string | null
    previous?: string | null

    results?:
    | {
        psgc_data?: PSGCRecord[]
    }
    | PSGCRecord[]

    psgc_data?: PSGCRecord[]
}

interface CachedPSAResponse {
    expiresAt: number
    payload: PSAResponse
}

const psaResponseCache =
    new Map<string, CachedPSAResponse>()

const pendingPSARequests =
    new Map<string, Promise<PSAResponse>>()

interface GeoJsonFeatureCollection {
    type: 'FeatureCollection'
    features: unknown[]
}

interface CachedBoundaryResponse {
    expiresAt: number
    payload: GeoJsonFeatureCollection
}

const boundaryResponseCache =
    new Map<string, CachedBoundaryResponse>()

const pendingBoundaryRequests =
    new Map<string, Promise<GeoJsonFeatureCollection>>()

class PSARequestError extends Error {
    constructor(
        message: string,
        readonly status?: number,
    ) {
        super(message)
        this.name = 'PSARequestError'
    }
}

const extractPSGCData = (
    payload: PSAResponse | PSGCRecord[],
): PSGCRecord[] => {
    if (Array.isArray(payload)) {
        return payload
    }

    if (Array.isArray(payload.psgc_data)) {
        return payload.psgc_data
    }

    if (Array.isArray(payload.results)) {
        return payload.results
    }

    if (
        payload.results &&
        !Array.isArray(payload.results) &&
        Array.isArray(
            payload.results.psgc_data,
        )
    ) {
        return payload.results.psgc_data
    }

    return []
}

const normalizeAreaName = (value: string) => {
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
            // Keep the original value when it is not Latin-1 mojibake.
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

const toRegionResponse = (
    region: PSGCRecord,
) => ({
    code:
        region.code ??
        region.psgc_code ??
        region.population_data?.[0]?.code ??
        region.correspondence_code ??
        null,
    area_name: normalizeAreaName(region.area_name),
    geographic_level:
        region.geographic_level,
    reg: region.reg,
    island_region: region.island_region,
})

const toProvinceResponse = (
    province: PSGCRecord,
) => ({
    code:
        province.code ??
        province.psgc_code ??
        province.population_data?.[0]?.code ??
        province.correspondence_code ??
        null,
    area_name: normalizeAreaName(province.area_name),
    geographic_level:
        province.geographic_level,
    reg: province.reg,
    prv: province.prv,
    island_region: province.island_region,
})

const isProvince = (
    record: PSGCRecord,
) => record.geographic_level
    .trim()
    .toLowerCase() === 'prov'

const isMunicipalityOrCity = (
    locality: PSGCRecord,
) => {
    const level = locality.geographic_level
        .trim()
        .toLowerCase()

    return level === 'city' || level === 'mun'
}

const toMunicipalityResponse = (
    locality: PSGCRecord,
) => ({
    code:
        locality.code ??
        locality.psgc_code ??
        locality.population_data?.[0]?.code ??
        locality.correspondence_code ??
        null,
    area_name: normalizeAreaName(locality.area_name),
    geographic_level:
        locality.geographic_level,
    reg: locality.reg,
    prv: locality.prv,
    mun: locality.mun,
    correspondence_code:
        locality.correspondence_code,
    island_region: locality.island_region,
})

const getPSACacheKey = (url: URL) => {
    const cacheUrl = new URL(url)

    cacheUrl.searchParams.delete('token')

    return cacheUrl.toString()
}

const setGeographyCacheHeader = (
    response: Response,
) => {
    response.set(
        'Cache-Control',
        `public, max-age=${CLIENT_CACHE_SECONDS}, stale-while-revalidate=86400`,
    )
}

const getPSGCData = async (
    level:
        | 'all'
        | 'regions'
        | 'provinces'
        | 'municipalities',
    filters: Record<string, string> = {},
): Promise<PSAResponse> => {
    const token =
        process.env.PSA_PSGC_TOKEN ??
        process.env.PSA_PSGC_API_TOKEN

    if (!token) {
        throw new PSARequestError(
            'PSA PSGC token is not configured',
        )
    }

    const url = new URL(
        `${PSA_BASE_URL}/${PSA_VERSION}/${level}`,
    )

    url.searchParams.set('token', token)

    // Allow the caller to control pagination; default to 100
    if (!url.searchParams.has('page_size')) {
        url.searchParams.set('page_size', '100')
    }

    Object.entries(filters).forEach(
        ([key, value]) => {
            if (value) {
                url.searchParams.set(
                    key,
                    value,
                )
            }
        },
    )

    const cacheKey = getPSACacheKey(url)
    const cached = psaResponseCache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
        return cached.payload
    }

    const pending = pendingPSARequests.get(cacheKey)

    if (pending) return pending

    const request = (async () => {
        let response: globalThis.Response

        try {
            response = await fetch(url, {
                headers: {
                    Accept: 'application/json',
                },
                signal: AbortSignal.timeout(
                    REQUEST_TIMEOUT_MS,
                ),
            })
        } catch (error) {
            const reason =
                error instanceof Error
                    ? error.message
                    : String(error)

            throw new PSARequestError(
                `Unable to reach PSA PSGC: ${reason}`,
            )
        }

        if (!response.ok) {
            const body = await response.text()

            console.error(
                'PSA PSGC request failed:',
                response.status,
                body.slice(0, 500),
            )

            throw new PSARequestError(
                `PSA PSGC returned ${response.status}`,
                response.status,
            )
        }

        let payload: PSAResponse | PSGCRecord[]
        try {
            payload = (await response.json()) as PSAResponse | PSGCRecord[]
        } catch {
            throw new PSARequestError(
                'PSA PSGC returned an invalid JSON response',
                response.status,
            )
        }

        const normalizedPayload = payload as PSAResponse

        psaResponseCache.set(cacheKey, {
            expiresAt: Date.now() + PSA_CACHE_TTL_MS,
            payload: normalizedPayload,
        })

        return normalizedPayload
    })().finally(() => {
        pendingPSARequests.delete(cacheKey)
    })

    pendingPSARequests.set(cacheKey, request)

    return request
}

const getAllPSGCRecords = async (
    level:
        | 'all'
        | 'regions'
        | 'provinces'
        | 'municipalities',
    filters: Record<string, string>,
): Promise<PSGCRecord[]> => {
    const records: PSGCRecord[] = []
    let page = 1

    while (true) {
        const payload = await getPSGCData(level, {
            ...filters,
            page: String(page),
            page_size: '1000',
        })

        const pageRecords = extractPSGCData(payload)

        records.push(...pageRecords)

        if (
            pageRecords.length === 0 ||
            !payload.next ||
            (payload.count !== undefined &&
                records.length >= payload.count)
        ) {
            return records
        }

        page += 1
    }
}

const sendGeographyError = (
    response: Response,
    message: string,
    error: unknown,
) => {
    console.error(message, error)

    if (
        error instanceof PSARequestError &&
        error.message.includes('not configured')
    ) {
        return response.status(503).json({
            message: 'Geography service is not configured',
        })
    }

    return response.status(502).json({
        message,
        ...(error instanceof PSARequestError &&
        error.status
            ? { upstreamStatus: error.status }
            : {}),
    })
}

const isNumericCode = (
    value: unknown,
): value is string => {
    return (
        typeof value === 'string' &&
        /^\d+$/.test(value)
    )
}

const isPSGCCode = (
    value: unknown,
): value is string =>
    typeof value === 'string' &&
    /^\d{10}$/.test(value)

const getBoundaryData = async (
    {
        region,
        province,
        district,
        locality,
    }: {
        region?: string
        province?: string
        district?: string
        locality?: string
    },
): Promise<GeoJsonFeatureCollection> => {
    const url = region
        ? new URL(
            `${BOUNDARY_SERVICE_BASE_URL}/MunicipalPopMF/MapServer/2/query`,
        )
        : new URL(NATIONAL_BOUNDARY_URL)

    let where = '1=1'

    if (locality) {
        where = `psgc_10d='${locality}'`
    } else if (district) {
        where = `prov_code='${district}'`
    } else if (province) {
        where = `psgc_10d LIKE '${province.slice(0, 5)}%'`
    } else if (region) {
        where = `psgc_10d LIKE '${region.slice(0, 2)}%'`
    }

    if (region) {
        url.searchParams.set('where', where)
        url.searchParams.set(
            'outFields',
            'reg_name,prov_name,city_name,reg_code,prov_code,city_code,psgc_10d,geographic_level',
        )
        url.searchParams.set('returnGeometry', 'true')
        url.searchParams.set('outSR', '4326')
        url.searchParams.set('geometryPrecision', '5')
        url.searchParams.set('maxAllowableOffset', '0.002')
        url.searchParams.set('resultRecordCount', '5000')
        url.searchParams.set('f', 'geojson')
    }

    const cacheKey = url.toString()
    const cached = boundaryResponseCache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
        return cached.payload
    }

    const pending = pendingBoundaryRequests.get(cacheKey)

    if (pending) return pending

    const request = (async () => {
        let response: globalThis.Response

        try {
            response = await fetch(url, {
                headers: {
                    Accept: 'application/geo+json, application/json',
                },
                signal: AbortSignal.timeout(
                    BOUNDARY_REQUEST_TIMEOUT_MS,
                ),
            })
        } catch (error) {
            const reason = error instanceof Error
                ? error.message
                : String(error)

            throw new Error(
                `Unable to reach boundary service: ${reason}`,
            )
        }

        if (!response.ok) {
            throw new Error(
                `Boundary service returned ${response.status}`,
            )
        }

        const payload = await response.json() as Partial<GeoJsonFeatureCollection> & {
            error?: unknown
        }

        if (
            payload.error ||
            payload.type !== 'FeatureCollection' ||
            !Array.isArray(payload.features)
        ) {
            throw new Error(
                'Boundary service returned an invalid GeoJSON response',
            )
        }

        const featureCollection = payload as GeoJsonFeatureCollection

        boundaryResponseCache.set(cacheKey, {
            expiresAt: Date.now() + BOUNDARY_CACHE_TTL_MS,
            payload: featureCollection,
        })

        return featureCollection
    })().finally(() => {
        pendingBoundaryRequests.delete(cacheKey)
    })

    pendingBoundaryRequests.set(cacheKey, request)

    return request
}

/**
 * GET /api/geography/boundaries
 *
 * Returns neutral administrative boundary polygons. National geometry uses
 * a version-pinned PSA/NAMRIA-derived release; scoped LGU geometry comes from
 * the GeoRiskPH PSA ArcGIS service. Both expose 10-digit PSGC codes.
 */
router.get(
    '/boundaries',
    async (
        request: Request,
        response: Response,
    ) => {
        const region = request.query.region
        const province = request.query.province
        const district = request.query.district
        const locality = request.query.locality

        if (region !== undefined && !isPSGCCode(region)) {
            return response.status(400).json({
                message: 'Invalid region PSGC code',
            })
        }

        if (province !== undefined && !isPSGCCode(province)) {
            return response.status(400).json({
                message: 'Invalid province PSGC code',
            })
        }

        if (locality !== undefined && !isPSGCCode(locality)) {
            return response.status(400).json({
                message: 'Invalid locality PSGC code',
            })
        }

        if (
            district !== undefined &&
            (
                typeof district !== 'string' ||
                !NCR_DISTRICT_CODES.has(
                    district as typeof NCR_DISTRICTS[number]['code'],
                )
            )
        ) {
            return response.status(400).json({
                message: 'Invalid NCR district code',
            })
        }

        if ((province || district || locality) && !region) {
            return response.status(400).json({
                message: 'Region is required for nested boundary filters',
            })
        }


        if (
            typeof district === 'string' &&
            region !== NCR_REGION_CODE
        ) {
            return response.status(400).json({
                message: 'NCR district requires the NCR region',
            })
        }

        if (
            typeof region === 'string' &&
            typeof province === 'string' &&
            !province.startsWith(region.slice(0, 2))
        ) {
            return response.status(400).json({
                message: 'Province does not belong to the selected region',
            })
        }

        try {
            const payload = await getBoundaryData({
                region: typeof region === 'string' ? region : undefined,
                province: typeof province === 'string' ? province : undefined,
                district: typeof district === 'string' ? district : undefined,
                locality: typeof locality === 'string' ? locality : undefined,
            })

            setGeographyCacheHeader(response)
            return response.json(payload)
        } catch (error) {
            console.error('Unable to load boundary map', error)

            return response.status(502).json({
                message: 'Unable to load boundary map',
            })
        }
    },
)

/**
 * GET /api/geography/districts?reg=13
 *
 * NCR's four PSGC statistical districts occupy the province-level slot in
 * the administrative hierarchy. They are not congressional districts.
 */
router.get(
    '/districts',
    (
        request: Request,
        response: Response,
    ) => {
        if (String(request.query.reg) !== '13') {
            return response.status(400).json({
                message: 'NCR region code 13 is required',
            })
        }

        setGeographyCacheHeader(response)
        return response.json({
            count: NCR_DISTRICTS.length,
            next: null,
            previous: null,
            data: NCR_DISTRICTS,
        })
    },
)

/**
 * GET /api/geography/regions
 */
router.get(
    '/regions',
    async (
        _request: Request,
        response: Response,
    ) => {
        try {
            const payload = await getPSGCData('regions')

            setGeographyCacheHeader(response)
            response.json({
                count: payload.count ?? null,
                next: payload.next ?? null,
                previous: payload.previous ?? null,
                data: extractPSGCData(payload).map(
                    toRegionResponse,
                ),
            })
        } catch (error) {
            return sendGeographyError(
                response,
                'Unable to load regions',
                error,
            )
        }
    },
)

/**
 * GET /api/geography/provinces?reg=4
 */
router.get(
    '/provinces',
    async (
        request: Request,
        response: Response,
    ) => {
        const { reg } =
            request.query

        if (!isNumericCode(reg)) {
            return response
                .status(400)
                .json({
                    message:
                        'Valid reg parameter is required',
                })
        }

        try {
            const payload = await getPSGCData('provinces', {
                reg,
                page: String(request.query.page ?? ''),
                page_size: String(request.query.page_size ?? ''),
            })
            const data = extractPSGCData(payload)
                .filter(isProvince)
                .map(toProvinceResponse)

            setGeographyCacheHeader(response)
            response.json({
                count: data.length,
                next: payload.next ?? null,
                previous: payload.previous ?? null,
                data,
            })
        } catch (error) {
            return sendGeographyError(
                response,
                'Unable to load provinces',
                error,
            )
        }
    },
)

/**
 * GET
 * /api/geography/municipalities?reg=4&prv=34
 *
 * NCR:
 *
 * /api/geography/municipalities?reg=13
 */
router.get(
    '/municipalities',
    async (
        request: Request,
        response: Response,
    ) => {
        const {
            reg,
            prv,
        } = request.query

        if (!isNumericCode(reg)) {
            return response
                .status(400)
                .json({
                    message:
                        'Valid reg parameter is required',
                })
        }

        if (
            prv !== undefined &&
            !isNumericCode(prv)
        ) {
            return response
                .status(400)
                .json({
                    message:
                        'Invalid prv parameter',
                })
        }

        try {
            const records = await getAllPSGCRecords(
                'all',
                { reg },
            )
            const selectedProvince =
                typeof prv === 'string'
                    ? records.find(
                        record =>
                            isProvince(record) &&
                            String(record.prv) === prv,
                    )
                    : undefined
            const localityRecords = selectedProvince
                ? records.filter(
                    record =>
                        isMunicipalityOrCity(record) &&
                        record.prv ===
                            selectedProvince.prv,
                )
                : records.filter(isMunicipalityOrCity)
            const data = localityRecords
                .map(toMunicipalityResponse)

            setGeographyCacheHeader(response)
            response.json({
                count: data.length,
                next: null,
                previous: null,
                data,
            })
        } catch (error) {
            return sendGeographyError(
                response,
                'Unable to load cities and municipalities',
                error,
            )
        }
    },
)

export default router
