import { readFileSync } from 'node:fs'
import path from 'node:path'

import type {
    ElectionDataset,
    ElectionDatasetMetadata,
    ElectionDataStatus,
    LegislativeDistrict,
    LegislativeDistrictMembership,
    LegislativeDistrictSubdivisionMembership,
    LegislativeDistrictSubdivisionMetadata,
    LegislativeBoundaryCollection,
    LegislativeBoundaryFeature,
    PartyListResult,
    PSGCDataset,
    PSGCLocality,
} from '../types/elections'

export const DEFAULT_ELECTION_YEAR = 2025
export const AVAILABLE_ELECTION_YEARS = [DEFAULT_ELECTION_YEAR] as const

export class ElectionQueryError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ElectionQueryError'
    }
}

const readJson = <T>(relativePath: string): T => JSON.parse(
    readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'),
) as T

type StoredLegislativeDistrict = Omit<LegislativeDistrict, 'subdivisionMembership'>

const legislativeDataset = readJson<ElectionDataset<StoredLegislativeDistrict>>(
    'backend/src/data/normalized/legislative-districts-2025.json',
)
const partyListDataset = readJson<ElectionDataset<PartyListResult>>(
    'backend/src/data/normalized/party-lists-2025.json',
)
const psgcDataset = readJson<PSGCDataset>(
    'backend/src/data/reference/psgc-localities-2025.json',
)
const legislativeBoundaryCollection = readJson<LegislativeBoundaryCollection>(
    'backend/src/data/normalized/legislative-district-boundaries-2025.geojson',
)
const legislativeSubdivisionDataset = readJson<{
    metadata: LegislativeDistrictSubdivisionMetadata
    data: LegislativeDistrictSubdivisionMembership[]
}>(
    'backend/src/data/normalized/legislative-district-subdivisions-2025.json',
)

const subdivisionsByDistrictId = new Map(
    legislativeSubdivisionDataset.data.map(item => [item.legislativeDistrictId, item]),
)

const withSubdivisionSummary = (
    district: StoredLegislativeDistrict,
): LegislativeDistrict => {
    const membership = subdivisionsByDistrictId.get(district.id)

    return {
        ...district,
        subdivisionMembership: membership ? {
            status: membership.membershipStatus,
            unitCount: membership.units.length,
        } : {
            status: 'not-required',
            unitCount: 0,
        },
    }
}

const psgcByCode = new Map<string, PSGCLocality>(
    psgcDataset.data.map(unit => [unit.code, unit]),
)

const normalizeSearch = (value: string) => value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-PH')
    .trim()

const isWithin = (code: string, ancestorCode: string): boolean => {
    let currentCode = code
    const visited = new Set<string>()

    while (currentCode && !visited.has(currentCode)) {
        if (currentCode === ancestorCode) return true
        visited.add(currentCode)
        currentCode = psgcByCode.get(currentCode)?.parentCode ?? ''
    }

    return false
}

export const resolveElectionYear = (value: unknown): number => {
    if (value === undefined || value === '') return DEFAULT_ELECTION_YEAR
    if (
        (typeof value !== 'string' && typeof value !== 'number') ||
        !/^\d{4}$/.test(String(value))
    ) {
        throw new ElectionQueryError('year must be a four-digit election year')
    }

    const year = Number(value)
    if (!(AVAILABLE_ELECTION_YEARS as readonly number[]).includes(year)) {
        throw new ElectionQueryError(
            `Election year ${year} is unavailable. Available years: ${AVAILABLE_ELECTION_YEARS.join(', ')}`,
        )
    }

    return year
}

const assertPSGCCode = (name: string, value?: string) => {
    if (value !== undefined && !/^\d{10}$/.test(value)) {
        throw new ElectionQueryError(`${name} must be a 10-digit PSGC code`)
    }
}

export interface LegislativeDistrictFilters {
    year?: unknown
    region?: string
    province?: string
    locality?: string
    jurisdiction?: string
    barangay?: string
    submunicipality?: string
    q?: string
}

export const listLegislativeDistricts = (
    filters: LegislativeDistrictFilters = {},
): LegislativeDistrict[] => {
    const year = resolveElectionYear(filters.year)
    assertPSGCCode('region', filters.region)
    assertPSGCCode('province', filters.province)
    assertPSGCCode('locality', filters.locality)
    assertPSGCCode('jurisdiction', filters.jurisdiction)
    assertPSGCCode('barangay', filters.barangay)
    assertPSGCCode('submunicipality', filters.submunicipality)
    const query = normalizeSearch(filters.q ?? '')

    return legislativeDataset.data.filter(district => {
        if (district.electionYear !== year) return false
        if (filters.region && district.region.code !== filters.region) return false
        if (
            filters.province &&
            !district.memberships.some(item => isWithin(item.localityCode, filters.province!)) &&
            !(district.jurisdiction && isWithin(district.jurisdiction.code, filters.province))
        ) return false
        if (
            filters.locality &&
            !district.memberships.some(item => item.localityCode === filters.locality)
        ) return false
        if (
            filters.jurisdiction &&
            district.jurisdiction?.code !== filters.jurisdiction
        ) return false
        const subdivisions = subdivisionsByDistrictId.get(district.id)?.units ?? []
        if (
            filters.barangay &&
            !subdivisions.some(item =>
                item.type === 'barangay' && item.code === filters.barangay
            )
        ) return false
        if (
            filters.submunicipality &&
            !subdivisions.some(item =>
                item.type === 'submunicipality' &&
                item.code === filters.submunicipality
            )
        ) return false
        if (query) {
            const searchable = [
                district.label,
                district.sourceLabel,
                district.region.name,
                district.jurisdiction?.name ?? '',
                ...district.memberships.flatMap(item => [item.localityName, item.sourceName]),
                ...subdivisions.map(item => item.name),
            ].map(normalizeSearch)

            if (!searchable.some(value => value.includes(query))) return false
        }

        return true
    }).map(withSubdivisionSummary)
}

export const getLegislativeDistrict = (
    id: string,
    yearValue?: unknown,
): LegislativeDistrict | undefined => {
    const year = resolveElectionYear(yearValue)
    const district = legislativeDataset.data.find(
        district => district.id === id && district.electionYear === year,
    )
    return district ? withSubdivisionSummary(district) : undefined
}

export const getLegislativeDistrictLocalities = (
    id: string,
    yearValue?: unknown,
): LegislativeDistrictMembership[] | undefined => getLegislativeDistrict(
    id,
    yearValue,
)?.memberships

export const getLegislativeDistrictSubdivisions = (
    id: string,
    yearValue?: unknown,
): LegislativeDistrictSubdivisionMembership | undefined => {
    const district = getLegislativeDistrict(id, yearValue)
    if (!district) return undefined

    return subdivisionsByDistrictId.get(district.id)
}

export const getLegislativeDistrictBoundary = (
    id: string,
    yearValue?: unknown,
): LegislativeBoundaryFeature | undefined => {
    const district = getLegislativeDistrict(id, yearValue)
    if (!district) return undefined

    return legislativeBoundaryCollection.features.find(
        feature => feature.id === district.id,
    )
}

export interface PartyListFilters {
    year?: unknown
    q?: string
}

export const listPartyLists = (
    filters: PartyListFilters = {},
): PartyListResult[] => {
    const year = resolveElectionYear(filters.year)
    const query = normalizeSearch(filters.q ?? '')

    return partyListDataset.data.filter(partyList => {
        if (partyList.electionYear !== year) return false
        if (!query) return true

        return [
            partyList.officialName,
            partyList.acronym,
            ...partyList.nominees.map(nominee => nominee.officialName),
        ].some(value => normalizeSearch(value).includes(query))
    })
}

export const getPartyList = (
    id: string,
    yearValue?: unknown,
): PartyListResult | undefined => {
    const year = resolveElectionYear(yearValue)
    return partyListDataset.data.find(
        partyList => partyList.id === id && partyList.electionYear === year,
    )
}

export const getLegislativeDatasetMetadata = (): ElectionDatasetMetadata =>
    legislativeDataset.metadata

export const getLegislativeSubdivisionDatasetMetadata = (
): LegislativeDistrictSubdivisionMetadata => legislativeSubdivisionDataset.metadata

export const getPartyListDatasetMetadata = (): ElectionDatasetMetadata =>
    partyListDataset.metadata

export const getElectionDataStatus = (
    yearValue?: unknown,
): ElectionDataStatus => {
    const year = resolveElectionYear(yearValue)
    const districts = legislativeDataset.data.filter(
        district => district.electionYear === year,
    )
    const partyLists = partyListDataset.data.filter(
        partyList => partyList.electionYear === year,
    )
    const boundaries = legislativeBoundaryCollection.features.filter(
        feature =>
            feature.properties.electionYear === year &&
            feature.properties.syncStatus !== 'stale',
    )
    const subdivisionMemberships = legislativeSubdivisionDataset.data.filter(
        item => item.electionYear === year,
    )

    return {
        electionYear: year,
        legislativeDistricts: districts.length,
        legislativeMemberships: districts.reduce(
            (total, district) => total + district.memberships.length,
            0,
        ),
        localityResolvedDistricts: districts.filter(
            district => district.status === 'locality-resolved',
        ).length,
        partialBoundaryDistricts: districts.filter(
            district => district.status === 'partial-boundary',
        ).length,
        partyListOrganizations: partyLists.length,
        proclaimedNominees: partyLists.reduce(
            (total, partyList) => total + partyList.nominees.length,
            0,
        ),
        boundaries: {
            totalRequired: boundaries.length,
            missing: boundaries.filter(
                feature => feature.properties.boundaryStatus === 'missing',
            ).length,
            draft: boundaries.filter(
                feature => feature.properties.boundaryStatus === 'draft',
            ).length,
            verified: boundaries.filter(
                feature => feature.properties.boundaryStatus === 'verified',
            ).length,
            withGeometry: boundaries.filter(feature => feature.geometry !== null).length,
        },
        subdivisions: {
            totalRequired: subdivisionMemberships.length,
            missing: subdivisionMemberships.filter(
                item => item.membershipStatus === 'missing',
            ).length,
            draft: subdivisionMemberships.filter(
                item => item.membershipStatus === 'draft',
            ).length,
            verified: subdivisionMemberships.filter(
                item => item.membershipStatus === 'verified',
            ).length,
            units: subdivisionMemberships.reduce(
                (total, item) => total + item.units.length,
                0,
            ),
        },
    }
}
