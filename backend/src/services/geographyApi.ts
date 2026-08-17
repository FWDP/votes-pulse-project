import {
    getApiUrl,
} from '../utils/getApiUrl'

import type {
    GeographyApiResponse,
    GeographyUnit,
} from '../types/geography'

const fetchGeography = async (
    url: string,
    signal?: AbortSignal,
): Promise<GeographyUnit[]> => {
    const response = await fetch(
        getApiUrl(url),
        {
            headers: {
                Accept:
                    'application/json',
            },

            signal,
        },
    )

    if (!response.ok) {
        throw new Error(
            `Geography API returned ${response.status}`,
        )
    }

    const json =
        (await response.json()) as
        GeographyApiResponse

    return json.data ?? []
}

export const getRegions = (
    signal?: AbortSignal,
) => {
    return fetchGeography(
        '/api/geography/regions',
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
        })

    return fetchGeography(
        `/api/geography/provinces?${params.toString()}`,
        signal,
    )
}

interface MunicipalityParams {
    reg: number
    prv?: number
}

export const getMunicipalities = (
    {
        reg,
        prv,
    }: MunicipalityParams,
    signal?: AbortSignal,
) => {
    const params =
        new URLSearchParams({
            reg: String(reg),
        })

    if (
        prv !== undefined &&
        prv !== 0
    ) {
        params.set(
            'prv',
            String(prv),
        )
    }

    return fetchGeography(
        `/api/geography/municipalities?${params.toString()}`,
        signal,
    )
}