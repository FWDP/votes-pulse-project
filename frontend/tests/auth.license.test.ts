import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TEST_USERS,
  getAssignedGeographySelection,
  getCoverageRestriction,
  getUserLicenseLabel,
  getUserLicenseTier,
  hasCoverageLock,
} from '../src/contexts/AuthContext'

const userById = (id: string) => {
  const user = TEST_USERS.find(candidate => candidate.id === id)
  assert.ok(user, `Missing test user ${id}`)
  return user
}

test('maps current users to the configured license tiers', () => {
  assert.equal(
    getUserLicenseLabel(userById('user-superadmin-local')),
    'NATIONAL',
  )
  assert.equal(
    getUserLicenseLabel(userById('user-cavite-local')),
    'PROVINCIAL/PARTYLIST',
  )

  for (const id of [
    'user-navotas-local',
    'user-lucena-local',
    'user-marilao-local',
    'user-quezon-city-local',
  ]) {
    assert.equal(
      getUserLicenseLabel(userById(id)),
      'CITY/DISTRICT/MUNICIPALITY',
    )
  }
})

test('infers a tier for legacy persisted users without a license field', () => {
  assert.equal(
    getUserLicenseTier({ coverageScope: 'region' }),
    'national',
  )
  assert.equal(
    getUserLicenseTier({ coverageScope: 'province' }),
    'provincial-partylist',
  )
  assert.equal(
    getUserLicenseTier({ coverageScope: 'locality' }),
    'city-district-municipality',
  )
})

test('uses license tiers to enforce geographic coverage', () => {
  const national = userById('user-superadmin-local')
  const provincial = userById('user-cavite-local')
  const local = userById('user-marilao-local')

  assert.equal(getCoverageRestriction(national), null)
  assert.equal(hasCoverageLock(national), false)

  assert.deepEqual(getCoverageRestriction(provincial), {
    field: 'province',
    value: '0402100000',
    provinceValue: undefined,
    regionValue: '0400000000',
  })
  assert.equal(hasCoverageLock(provincial), true)

  assert.equal(getCoverageRestriction(local)?.field, 'locality')
  assert.deepEqual(getAssignedGeographySelection(local), {
    region: '0300000000',
    province: '0301400000',
    district: '',
    locality: '0301411000',
  })
})
