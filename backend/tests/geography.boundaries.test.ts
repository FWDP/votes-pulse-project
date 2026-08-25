import assert from 'node:assert/strict'
import test from 'node:test'

import {
    getBoundaryWhereClause,
} from '../src/routes/geography'

test('resolves Manila city coverage through its submunicipality polygons', () => {
    assert.equal(
        getBoundaryWhereClause({
            region: '1300000000',
            district: '133900000',
            locality: '1380600000',
        }),
        "psgc_10d LIKE '13806%'",
    )
})

test('keeps exact boundary matching for ordinary locality features', () => {
    assert.equal(
        getBoundaryWhereClause({
            region: '0400000000',
            locality: '0431200000',
        }),
        "psgc_10d='0431200000'",
    )
})
