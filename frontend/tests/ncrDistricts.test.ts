import assert from 'node:assert/strict'
import test from 'node:test'

import {
    getNCRDistrictLocalityCodes,
} from '../../shared/ncrDistricts'

test('maps every NCR statistical district to only its member localities', () => {
    assert.deepEqual(getNCRDistrictLocalityCodes('133900000'), [
        '1380600000',
    ])
    assert.deepEqual(getNCRDistrictLocalityCodes('137500000'), [
        '1380100000',
        '1380400000',
        '1380900000',
        '1381600000',
    ])
    assert.equal(getNCRDistrictLocalityCodes('invalid'), undefined)
})
