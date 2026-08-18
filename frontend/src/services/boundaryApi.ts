import {
    getApiUrl,
} from '../utils/getApiUrl'

import type {
    BoundaryFeatureCollection,
    GeographySelection,
} from '../types/geography'
import {
    ALL_CITIES_FILTER,
    ALL_MUNICIPALITIES_FILTER,
    INDEPENDENT_CITIES_FILTER,
} from '../types/geography'

const responseCache =
    new Map<string, BoundaryFeatureCollection>()

const pendingRequests =
    new Map<string, Promise<BoundaryFeatureCollection>>()
const requestAttempts = new Map<string, { count: number; windowStart: number }>()
const REQUEST_WINDOW_MS = 10_000
const MAX_REQUESTS_PER_WINDOW = 10

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

export const getBoundaryGeoJson = async (
    geography: GeographySelection,
    signal?: AbortSignal,
): Promise<BoundaryFeatureCollection> => {
    const params = new URLSearchParams()

    if (geography.region) {
        params.set('region', geography.region)
    }

    if (
        geography.province &&
        geography.province !== INDEPENDENT_CITIES_FILTER
    ) {
        params.set('province', geography.province)
    }

    if (geography.district) {
        params.set('district', geography.district)
    }

    if (
        geography.locality &&
        geography.locality !== ALL_CITIES_FILTER &&
        geography.locality !== ALL_MUNICIPALITIES_FILTER
    ) {
        params.set('locality', geography.locality)
    }

    const query = params.toString()
    const url = `/api/geography/boundaries${query ? `?${query}` : ''}`
    const cached = responseCache.get(url)

    if (cached) return cached

    let request = pendingRequests.get(url)

    // Rate-limit rapid repeated requests for the same URL to avoid client-side loops
    const now = Date.now()
    const attempts = requestAttempts.get(url) ?? { count: 0, windowStart: now }
    if (now - attempts.windowStart > REQUEST_WINDOW_MS) {
        attempts.count = 0
        attempts.windowStart = now
    }
    attempts.count += 1
    requestAttempts.set(url, attempts)

    if (attempts.count > MAX_REQUESTS_PER_WINDOW) {
        const cachedNow = responseCache.get(url)
        if (cachedNow) return cachedNow
        throw new Error(`Too many boundary requests for ${url}`)
    }

    if (!request) {
        request = (async () => {
            const response = await fetch(
                getApiUrl(url),
                {
                    headers: {
                        Accept: 'application/geo+json, application/json',
                    },
                    signal,
                },
            )

            if (!response.ok) {
                throw new Error(
                    `Boundary API returned ${response.status}`,
                )
            }

            const payload = await response.json() as BoundaryFeatureCollection

            responseCache.set(url, payload)

            return payload
        })().finally(() => {
            pendingRequests.delete(url)
            requestAttempts.delete(url)
        })

        pendingRequests.set(url, request)
    }

    return waitForRequest(request, signal)
}
