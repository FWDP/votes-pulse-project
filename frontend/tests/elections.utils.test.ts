import assert from 'node:assert/strict'
import test from 'node:test'

import {
    applyElectionSelectionToSearch,
    parseElectionSelection,
} from '../src/utils/elections'

test('round-trips a shareable election selection while preserving other query values', () => {
    const search = applyElectionSelectionToSearch('?workspace=candidate', {
        electionYear: 2025,
        coverageMode: 'legislative',
        legislativeDistrictId: 'ld-2025-1381300000-1',
        partyListId: 'party-list-2025-01-akbayan',
    })

    assert.match(search, /workspace=candidate/)
    assert.deepEqual(parseElectionSelection(search), {
        electionYear: 2025,
        coverageMode: 'legislative',
        legislativeDistrictId: 'ld-2025-1381300000-1',
        partyListId: 'party-list-2025-01-akbayan',
    })
})

test('removes default election filters and rejects malformed identifiers', () => {
    const selection = parseElectionSelection(
        '?coverageMode=legislative&legislativeDistrict=../../etc&partyList=invalid',
    )
    assert.equal(selection.legislativeDistrictId, '')
    assert.equal(selection.partyListId, '')

    assert.equal(applyElectionSelectionToSearch('?coverageMode=legislative', {
        electionYear: 2025,
        coverageMode: 'administrative',
        legislativeDistrictId: '',
        partyListId: '',
    }), '')
})
