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
}
