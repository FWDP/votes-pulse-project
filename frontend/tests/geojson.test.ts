import assert from 'node:assert/strict'
import test from 'node:test'

import { getGeoJsonBounds } from '../src/utils/geojson'
import type { GeoJsonPosition } from '../src/types/geography'

test('calculates bounds without spreading large coordinate arrays', () => {
  const points: GeoJsonPosition[] = Array.from(
    { length: 200_000 },
    (_, index) => [120 + index / 1_000_000, 14 - index / 2_000_000],
  )

  assert.deepEqual(getGeoJsonBounds(points), {
    minLongitude: 120,
    maxLongitude: 120.199999,
    minLatitude: 13.9000005,
    maxLatitude: 14,
  })
})

test('returns null for empty or non-finite coordinate collections', () => {
  assert.equal(getGeoJsonBounds([]), null)
  assert.equal(getGeoJsonBounds([[Number.NaN, Number.NaN]]), null)
})
