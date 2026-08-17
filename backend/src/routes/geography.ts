import {
    Router,
    type Request,
    type Response,
} from 'express'

const router = Router()

const PSA_BASE_URL =
    'https://classification.psa.gov.ph/psgc'

const PSA_VERSION =
    process.env.PSA_PSGC_VERSION ??
    'Q2_2024'

const REQUEST_TIMEOUT_MS = 15_000
const PSA_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CLIENT_CACHE_SECONDS = 60 * 60

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
