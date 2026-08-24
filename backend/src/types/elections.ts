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

export interface LegislativeDistrictSubdivisionSource {
    name: string
    url: string
    role: 'legislative-district-assignment' | 'unit-identity-and-hierarchy'
}

export interface LegislativeDistrictSubdivisionMembership {
    legislativeDistrictId: string
    electionYear: number
    membershipStatus: 'missing' | 'draft' | 'verified'
    units: LegislativeDistrictSubdivision[]
    sources: LegislativeDistrictSubdivisionSource[]
}

export interface LegislativeDistrictSubdivisionMetadata {
    datasetId: string
    electionYear: number
    psgcReferenceDate: string
    description: string
    notes: string[]
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

export interface ElectionDataset<T> {
    metadata: ElectionDatasetMetadata
    data: T[]
}

export interface PSGCLocality {
    name: string
    type: 'region' | 'province' | 'city' | 'municipality'
    code: string
    parentCode: string
    nicknames: string[]
}

export interface PSGCDataset {
    data: PSGCLocality[]
}

export interface LegislativeBoundaryFeature {
    type: 'Feature'
    id: string
    properties: {
        legislativeDistrictId: string
        electionYear: number
        label: string
        boundaryStatus: 'missing' | 'draft' | 'verified'
        [key: string]: unknown
    }
    geometry: {
        type: 'Polygon' | 'MultiPolygon'
        coordinates: unknown[]
    } | null
}

export interface LegislativeBoundaryCollection {
    type: 'FeatureCollection'
    features: LegislativeBoundaryFeature[]
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
