import type { GeographySelection } from './geography'

export const DEFAULT_ELECTION_YEAR = 2025

export type CoverageMode = 'administrative' | 'legislative'

export interface ElectionSelection {
    electionYear: number
    coverageMode: CoverageMode
    legislativeDistrictId: string
    partyListId: string
}

export interface CoverageSelection {
    geography: GeographySelection
    election: ElectionSelection
}

export const DEFAULT_ELECTION_SELECTION: ElectionSelection = {
    electionYear: DEFAULT_ELECTION_YEAR,
    coverageMode: 'administrative',
    legislativeDistrictId: '',
    partyListId: '',
}

export interface ElectionDatasetMetadata {
    datasetId: string
    electionYear: number
    electionDate: string
    geographicScope: string
    sourceFile: string
    sourceSha256: string
    notes: string[]
    psgcReferenceDate?: string
}

export interface LegislativeDistrictMembership {
    localityCode: string
    localityName: string
    localityType: 'city' | 'municipality'
    coverage: 'whole' | 'partial'
    sourceRow: number
    sourceName: string
}

export interface LegislativeDistrictSubdivision {
    code: string
    name: string
    type: 'barangay' | 'submunicipality'
    parentCode: string
}

export interface LegislativeSubdivisionListMetadata {
    datasetId: string
    electionYear: number
    psgcReferenceDate: string
    description: string
    notes: string[]
    membershipStatus: 'missing' | 'draft' | 'verified'
    sources: Array<{
        name: string
        url: string
        role: 'legislative-district-assignment' | 'unit-identity-and-hierarchy'
    }>
}

export interface LegislativeDistrict {
    id: string
    electionYear: number
    electionDate: string
    label: string
    sourceLabel: string
    region: {
        code: string
        name: string
    }
    jurisdiction: {
        code: string
        name: string
        type: 'city' | 'province' | 'multi-locality'
    } | null
    status: 'locality-resolved' | 'partial-boundary'
    subdivisionMembership: {
        status: 'not-required' | 'missing' | 'draft' | 'verified'
        unitCount: number
    }
    memberships: LegislativeDistrictMembership[]
    sourceRows: number[]
}

export interface PartyListNominee {
    order: number
    officialName: string
}

export interface PartyListResult {
    id: string
    electionYear: number
    electionDate: string
    rank: number
    officialName: string
    acronym: string
    totalVotes: number
    geographicScope: 'national'
    nominees: PartyListNominee[]
    sourcePage: number
}

export interface ElectionListResponse<T> {
    count: number
    next: null
    previous: null
    metadata: ElectionDatasetMetadata
    data: T[]
}

export interface ElectionDetailResponse<T> {
    metadata: ElectionDatasetMetadata
    data: T
}

export interface ElectionDataStatus {
    electionYear: number
    legislativeDistricts: number
    legislativeMemberships: number
    localityResolvedDistricts: number
    partialBoundaryDistricts: number
    partyListOrganizations: number
    proclaimedNominees: number
    boundaries: {
        totalRequired: number
        missing: number
        draft: number
        verified: number
        withGeometry: number
    }
    subdivisions: {
        totalRequired: number
        missing: number
        draft: number
        verified: number
        units: number
    }
}
