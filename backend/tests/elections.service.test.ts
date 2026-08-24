import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
    ElectionQueryError,
    getElectionDataStatus,
    getLegislativeDistrict,
    getLegislativeDistrictBoundary,
    getLegislativeDistrictLocalities,
    getLegislativeDistrictSubdivisions,
    getPartyList,
    listLegislativeDistricts,
    listPartyLists,
} from '../src/services/elections.service'
import {
    findRingTopologyIssues,
    signedRingArea,
    type Position,
} from '../scripts/lib/geometryTopology'

test('lists the complete 2025 normalized election datasets', () => {
    assert.equal(listLegislativeDistricts().length, 254)
    assert.equal(listPartyLists().length, 57)
})

test('reports election dataset and boundary readiness', () => {
    const status = getElectionDataStatus(2025)
    assert.equal(status.legislativeDistricts, 254)
    assert.equal(status.legislativeMemberships, 1657)
    assert.equal(status.partyListOrganizations, 57)
    assert.equal(status.proclaimedNominees, 64)
    assert.deepEqual(status.boundaries, {
        totalRequired: 36,
        missing: 0,
        draft: 36,
        verified: 0,
        withGeometry: 36,
    })
    assert.deepEqual(status.subdivisions, {
        totalRequired: 36,
        missing: 0,
        draft: 0,
        verified: 36,
        units: 1824,
    })
})

test('filters legislative districts by locality and search text', () => {
    const manila = listLegislativeDistricts({ locality: '1380600000' })
    assert.equal(manila.length, 6)
    assert.ok(manila.every(district => district.label.includes('Manila')))

    const searched = listLegislativeDistricts({ q: 'Manila' })
    assert.ok(searched.length >= manila.length)
})

test('filters legislative districts through PSGC province ancestry', () => {
    const cavite = listLegislativeDistricts({ province: '0402100000' })
    assert.ok(cavite.length > 0)
    assert.ok(cavite.some(district => district.label.includes('Cavite')))
})

test('returns district details and their locality memberships', () => {
    const id = 'ld-2025-1380600000-1'
    assert.equal(getLegislativeDistrict(id)?.id, id)
    assert.deepEqual(
        getLegislativeDistrictLocalities(id),
        getLegislativeDistrict(id)?.memberships,
    )
    assert.equal(getLegislativeDistrict('missing'), undefined)
})

test('returns and filters verified barangay district memberships', () => {
    const firstDistrict = getLegislativeDistrictSubdivisions(
        'ld-2025-1381300000-1',
    )
    assert.equal(firstDistrict?.membershipStatus, 'verified')
    assert.equal(firstDistrict?.units.length, 37)
    assert.ok(firstDistrict?.units.some(unit =>
        unit.code === '1381300001' && unit.name === 'Alicia'
    ))
    assert.deepEqual(
        getLegislativeDistrict('ld-2025-1381300000-1')?.subdivisionMembership,
        { status: 'verified', unitCount: 37 },
    )

    const byBarangay = listLegislativeDistricts({ barangay: '1381300001' })
    assert.deepEqual(byBarangay.map(district => district.id), [
        'ld-2025-1381300000-1',
    ])

    const davaoFirstDistrict = getLegislativeDistrictSubdivisions(
        'ld-2025-1130700000-1',
    )
    assert.equal(davaoFirstDistrict?.membershipStatus, 'verified')
    assert.equal(davaoFirstDistrict?.units.length, 54)

    const manilaThirdDistrict = getLegislativeDistrictSubdivisions(
        'ld-2025-1380600000-3',
    )
    assert.ok(manilaThirdDistrict?.units.some(unit =>
        unit.code === '1380602000' && unit.type === 'submunicipality'
    ))
    assert.deepEqual(
        listLegislativeDistricts({ submunicipality: '1380602000' })
            .map(district => district.id),
        ['ld-2025-1380600000-3'],
    )
})

test('returns a closed polygon for the converted Quezon City boundary', () => {
    const boundary = getLegislativeDistrictBoundary('ld-2025-1381300000-1')
    assert.equal(boundary?.geometry?.type, 'Polygon')
    if (!boundary?.geometry || boundary.geometry.type !== 'Polygon') return

    const ring = boundary.geometry.coordinates[0] as number[][]
    assert.deepEqual(ring[0], ring.at(-1))
})

test('all entered legislative polygons have valid topology and winding', () => {
    const collection = JSON.parse(readFileSync(
        'backend/src/data/normalized/legislative-district-boundaries-2025.geojson',
        'utf8',
    )) as {
        features: Array<{
            id: string
            geometry: {
                type: 'Polygon' | 'MultiPolygon'
                coordinates: Position[][] | Position[][][]
            } | null
        }>
    }

    for (const feature of collection.features) {
        if (!feature.geometry) continue
        const polygons = feature.geometry.type === 'Polygon'
            ? [feature.geometry.coordinates as Position[][]]
            : feature.geometry.coordinates as Position[][][]

        for (const polygon of polygons) {
            const outerRing = polygon[0]
            assert.deepEqual(
                findRingTopologyIssues(outerRing),
                [],
                `${feature.id} contains intersecting or overlapping segments`,
            )
            assert.ok(
                signedRingArea(outerRing) > 0,
                `${feature.id} must use counter-clockwise outer-ring winding`,
            )
        }
    }
})

test('searches party-list names, acronyms, and nominees', () => {
    const results = listPartyLists({ q: 'AKBAYAN' })
    assert.equal(results.length, 1)
    assert.equal(results[0].acronym, 'AKBAYAN')
    assert.equal(getPartyList(results[0].id)?.rank, 1)

    assert.ok(listPartyLists({ q: 'DIOKNO' }).some(item => item.id === results[0].id))
})

test('rejects unsupported years and malformed PSGC filters', () => {
    assert.throws(
        () => listPartyLists({ year: '2022' }),
        ElectionQueryError,
    )
    assert.throws(
        () => listLegislativeDistricts({ region: '13' }),
        ElectionQueryError,
    )
    assert.throws(
        () => listLegislativeDistricts({ barangay: '13813' }),
        ElectionQueryError,
    )
})
