import {
    DEFAULT_ELECTION_SELECTION,
    type CoverageSelection,
    type ElectionSelection,
} from '../types/elections'
import type { GeographySelection } from '../types/geography'

export const createElectionSelection = (
    overrides: Partial<ElectionSelection> = {},
): ElectionSelection => ({
    ...DEFAULT_ELECTION_SELECTION,
    ...overrides,
})

export const createCoverageSelection = (
    geography: GeographySelection,
    election: Partial<ElectionSelection> = {},
): CoverageSelection => ({
    geography,
    election: createElectionSelection(election),
})

export const isSameElectionSelection = (
    first: ElectionSelection,
    second: ElectionSelection,
): boolean => (
    first.electionYear === second.electionYear &&
    first.coverageMode === second.coverageMode &&
    first.legislativeDistrictId === second.legislativeDistrictId &&
    first.partyListId === second.partyListId
)

export const selectAdministrativeCoverage = (
    selection: ElectionSelection,
): ElectionSelection => ({
    ...selection,
    coverageMode: 'administrative',
    legislativeDistrictId: '',
})

export const selectLegislativeCoverage = (
    selection: ElectionSelection,
    legislativeDistrictId: string,
): ElectionSelection => ({
    ...selection,
    coverageMode: 'legislative',
    legislativeDistrictId,
})

export const parseElectionSelection = (
    search: string,
): ElectionSelection => {
    const params = new URLSearchParams(search)
    const coverageMode = params.get('coverageMode') === 'legislative'
        ? 'legislative'
        : 'administrative'
    const electionYear = Number(params.get('electionYear')) === 2025
        ? 2025
        : DEFAULT_ELECTION_SELECTION.electionYear
    const districtId = params.get('legislativeDistrict') ?? ''
    const partyListId = params.get('partyList') ?? ''

    return createElectionSelection({
        electionYear,
        coverageMode,
        legislativeDistrictId: coverageMode === 'legislative'
            ? (/^ld-2025-[a-z0-9-]+$/i.test(districtId) ? districtId : '')
            : '',
        partyListId: /^party-list-2025-[a-z0-9-]+$/i.test(partyListId)
            ? partyListId
            : '',
    })
}

export const applyElectionSelectionToSearch = (
    search: string,
    selection: ElectionSelection,
): string => {
    const params = new URLSearchParams(search)

    if (selection.electionYear === DEFAULT_ELECTION_SELECTION.electionYear) {
        params.delete('electionYear')
    } else {
        params.set('electionYear', String(selection.electionYear))
    }

    if (selection.coverageMode === 'administrative') {
        params.delete('coverageMode')
        params.delete('legislativeDistrict')
    } else {
        params.set('coverageMode', selection.coverageMode)
        if (selection.legislativeDistrictId) {
            params.set('legislativeDistrict', selection.legislativeDistrictId)
        } else {
            params.delete('legislativeDistrict')
        }
    }

    if (selection.partyListId) {
        params.set('partyList', selection.partyListId)
    } else {
        params.delete('partyList')
    }

    const serialized = params.toString()
    return serialized ? `?${serialized}` : ''
}
