import { getApiUrl } from '../utils/getApiUrl'

import type {
    GeographyApiResponse,
    GeographyUnit,
} from '../types/geography'

const responseCache =
    new Map<string, GeographyUnit[]>()

const pendingRequests =
    new Map<string, Promise<GeographyUnit[]>>()

const requestGeography = async (
    url: string,
): Promise<GeographyUnit[]> => {
    const response = await fetch(
        getApiUrl(url),
        {
            headers: {
                Accept: 'application/json',
            },
        },
    )

    if (!response.ok) {
        throw new Error(
            `Geography API returned ${response.status}`,
        )
    }

    const json =
        (await response.json()) as GeographyApiResponse

    const data = json.data ?? []

    responseCache.set(url, data)

    return data
}

const waitForRequest = <T,>(
    request: Promise<T>,
    signal?: AbortSignal,
): Promise<T> => {
    if (!signal) return request

    if (signal.aborted) {
        return Promise.reject(
            new DOMException(
                'The request was aborted',
                'AbortError',
            ),
        )
    }

    return new Promise((resolve, reject) => {
        const handleAbort = () => {
            reject(
                new DOMException(
                    'The request was aborted',
                    'AbortError',
                ),
            )
        }

        signal.addEventListener(
            'abort',
            handleAbort,
            { once: true },
        )

        request.then(
            value => {
                signal.removeEventListener(
                    'abort',
                    handleAbort,
                )
                resolve(value)
            },
            error => {
                signal.removeEventListener(
                    'abort',
                    handleAbort,
                )
                reject(error)
            },
        )
    })
}

const fetchGeography = (
    url: string,
    signal?: AbortSignal,
): Promise<GeographyUnit[]> => {
    const cached = responseCache.get(url)

    if (cached) {
        return waitForRequest(
            Promise.resolve(cached),
            signal,
        )
    }

    let request = pendingRequests.get(url)

    if (!request) {
        request = requestGeography(url)
            .finally(() => {
                pendingRequests.delete(url)
            })

        pendingRequests.set(url, request)
    }

    return waitForRequest(request, signal)
}

export const getRegions = (
    signal?: AbortSignal,
) => {
    return fetchGeography(
        '/api/geography/regions?view=unicode-v1',
        signal,
    )
}

export const getDistricts = (
    reg: number,
    signal?: AbortSignal,
) => {
    const params = new URLSearchParams({
        reg: String(reg),
    })

    return fetchGeography(
        `/api/geography/districts?${params}`,
        signal,
    )
}

export const getProvinces = (
    reg: number,
    signal?: AbortSignal,
) => {
    const params =
        new URLSearchParams({
            reg: String(reg),
            view: 'provinces-only-unicode-v1',
        })

    return fetchGeography(
        `/api/geography/provinces?${params}`,
        signal,
    )
}

export const getMunicipalities = (
    {
        reg,
        prv,
    }: {
        reg: number
        prv?: number
    },
    signal?: AbortSignal,
) => {
    const params =
        new URLSearchParams({
            reg: String(reg),
            view: 'independent-cities-unicode-v1',
        })

    if (prv !== undefined && prv !== 0) {
        params.set(
            'prv',
            String(prv),
        )
    }

    return fetchGeography(
        `/api/geography/municipalities?${params}`,
        signal,
    )
}
