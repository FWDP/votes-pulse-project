import type {
    ElectionDetailResponse,
    ElectionDataStatus,
    ElectionListResponse,
    LegislativeDistrict,
    LegislativeDistrictMembership,
    PartyListResult,
} from '../types/elections'
import { getApiUrl } from '../utils/getApiUrl'
import type { BoundaryFeatureCollection } from '../types/geography'

export interface LegislativeDistrictQuery {
    year?: number
    region?: string
    province?: string
    locality?: string
    jurisdiction?: string
    q?: string
}

export interface PartyListQuery {
    year?: number
    q?: string
}

const buildQuery = <T extends object>(values: T) => {
    const query = new URLSearchParams()
    Object.entries(values as Record<string, string | number | undefined>).forEach(([name, value]) => {
        if (value !== undefined && value !== '') query.set(name, String(value))
    })
    const serialized = query.toString()
    return serialized ? `?${serialized}` : ''
}

const requestJson = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
    const response = await fetch(getApiUrl(path), {
        headers: { Accept: 'application/json' },
        signal,
    })

    if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(body?.message ?? `Election API returned ${response.status}`)
    }

    return response.json() as Promise<T>
}

export const getLegislativeDistricts = (
    query: LegislativeDistrictQuery = {},
    signal?: AbortSignal,
) => requestJson<ElectionListResponse<LegislativeDistrict>>(
    `/api/elections/legislative-districts${buildQuery(query)}`,
    signal,
)

export const getLegislativeDistrict = (
    id: string,
    year = 2025,
    signal?: AbortSignal,
) => requestJson<ElectionDetailResponse<LegislativeDistrict>>(
    `/api/elections/legislative-districts/${encodeURIComponent(id)}${buildQuery({ year })}`,
    signal,
)

export const getLegislativeDistrictLocalities = (
    id: string,
    year = 2025,
    signal?: AbortSignal,
) => requestJson<ElectionListResponse<LegislativeDistrictMembership>>(
    `/api/elections/legislative-districts/${encodeURIComponent(id)}/localities${buildQuery({ year })}`,
    signal,
)

export const getLegislativeDistrictBoundary = (
    id: string,
    year = 2025,
    signal?: AbortSignal,
) => requestJson<BoundaryFeatureCollection>(
    `/api/elections/legislative-districts/${encodeURIComponent(id)}/boundary${buildQuery({ year })}`,
    signal,
)

export const getPartyLists = (
    query: PartyListQuery = {},
    signal?: AbortSignal,
) => requestJson<ElectionListResponse<PartyListResult>>(
    `/api/elections/party-lists${buildQuery(query)}`,
    signal,
)

export const getPartyList = (
    id: string,
    year = 2025,
    signal?: AbortSignal,
) => requestJson<ElectionDetailResponse<PartyListResult>>(
    `/api/elections/party-lists/${encodeURIComponent(id)}${buildQuery({ year })}`,
    signal,
)

export const getElectionDataStatus = (
    year = 2025,
    signal?: AbortSignal,
) => requestJson<{ data: ElectionDataStatus }>(
    `/api/elections/status${buildQuery({ year })}`,
    signal,
)
