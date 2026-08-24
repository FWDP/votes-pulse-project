import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import polygonClipping, {
  type MultiPolygon,
  type Polygon,
  type Ring,
} from 'polygon-clipping'

import {
  closeAndDedupeRing,
  signedRingArea,
  type Position,
} from './lib/geometryTopology'

interface District {
  id: string
  electionYear: number
  label: string
  region: { code: string; name: string }
  jurisdiction: { code: string | null; name: string; type: string } | null
  memberships: Array<{
    localityCode: string
    localityName: string
    coverage: 'whole' | 'partial'
  }>
}

interface SubdivisionDataset {
  data: Array<{
    legislativeDistrictId: string
    membershipStatus: 'missing' | 'draft' | 'verified'
    units: Array<{
      code: string
      type: 'barangay' | 'submunicipality'
    }>
  }>
}

interface BoundaryGeometryFeature {
  type: 'Feature'
  id: string
  properties: {
    sourcePsgcCode: string
    coveredPsgcCodes: string[]
    coveredLocalityCodes: string[]
    geometryLevel: 'barangay' | 'locality'
    boundaryResolution: 'exact' | 'legacy-code' | 'aggregate-predecessor'
  }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: Polygon | MultiPolygon
  }
}

interface BoundaryReference {
  metadata: {
    source: string
    sourceUrl: string
    retrievedAt: string
  }
  features: BoundaryGeometryFeature[]
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../..')
const normalizedDirectory = resolve(repositoryRoot, 'backend/src/data/normalized')
const referenceDirectory = resolve(repositoryRoot, 'backend/src/data/reference')

const argument = (name: string) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const districtPath = resolve(
  normalizedDirectory,
  'legislative-districts-2025.json',
)
const subdivisionPath = resolve(
  normalizedDirectory,
  'legislative-district-subdivisions-2025.json',
)
const referencePath = resolve(
  argument('--barangays') ?? resolve(
    referenceDirectory,
    'legislative-barangay-boundaries-2025.geojson',
  ),
)
const referenceManifestPath = resolve(
  argument('--manifest') ?? resolve(
    referenceDirectory,
    'legislative-barangay-boundaries-2025.manifest.json',
  ),
)
const outputPath = resolve(
  argument('--output') ?? resolve(
    normalizedDirectory,
    'legislative-district-boundaries-2025.geojson',
  ),
)

const districts = (JSON.parse(readFileSync(districtPath, 'utf8')) as {
  data: District[]
}).data.filter(district => district.jurisdiction?.type === 'city' ||
  district.jurisdiction?.type === 'multi-locality')
const subdivisions = (JSON.parse(
  readFileSync(subdivisionPath, 'utf8'),
) as SubdivisionDataset).data
const reference = JSON.parse(
  readFileSync(referencePath, 'utf8'),
) as BoundaryReference
const referenceManifest = JSON.parse(
  readFileSync(referenceManifestPath, 'utf8'),
) as { sha256: string }

const subdivisionByDistrictId = new Map(
  subdivisions.map(item => [item.legislativeDistrictId, item]),
)
const geometryFeatureByBarangayCode = new Map<string, BoundaryGeometryFeature>()
const geometryFeatureByLocalityCode = new Map<string, BoundaryGeometryFeature>()
for (const feature of reference.features) {
  for (const code of feature.properties.coveredPsgcCodes) {
    if (geometryFeatureByBarangayCode.has(code)) {
      throw new Error(`Boundary reference covers PSGC code ${code} more than once.`)
    }
    geometryFeatureByBarangayCode.set(code, feature)
  }
  for (const code of feature.properties.coveredLocalityCodes ?? []) {
    if (geometryFeatureByLocalityCode.has(code)) {
      throw new Error(`Boundary reference covers locality ${code} more than once.`)
    }
    geometryFeatureByLocalityCode.set(code, feature)
  }
}

const asMultiPolygon = (
  geometry: BoundaryGeometryFeature['geometry'],
): MultiPolygon => geometry.type === 'Polygon'
  ? [geometry.coordinates as Polygon]
  : geometry.coordinates as MultiPolygon

const polygonArea = (polygon: Polygon) => polygon.reduce(
  (total, ring, index) => total +
    Math.abs(signedRingArea(ring as Position[])) * (index === 0 ? 1 : -1),
  0,
)
const multiPolygonArea = (geometry: MultiPolygon) => geometry.reduce(
  (total, polygon) => total + polygonArea(polygon),
  0,
)

const removeTinyBacktracks = (input: Position[]): Position[] => {
  const positions = closeAndDedupeRing(input).slice(0, -1)
  let changed = true

  while (changed && positions.length >= 3) {
    changed = false
    for (let index = 0; index < positions.length; index += 1) {
      const previous = positions[(index - 1 + positions.length) % positions.length]
      const current = positions[index]
      const next = positions[(index + 1) % positions.length]
      const incoming: Position = [
        current[0] - previous[0],
        current[1] - previous[1],
      ]
      const outgoing: Position = [
        next[0] - current[0],
        next[1] - current[1],
      ]
      const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0]
      const dot = incoming[0] * outgoing[0] + incoming[1] * outgoing[1]

      if (dot < 0 && Math.abs(cross) <= 1e-10) {
        positions.splice(index, 1)
        changed = true
        break
      }
    }
  }

  return closeAndDedupeRing(positions)
}

const normalizeRing = (ring: Ring, counterClockwise: boolean): Ring => {
  const normalized = removeTinyBacktracks(ring as Position[])
  const shouldReverse = counterClockwise
    ? signedRingArea(normalized) < 0
    : signedRingArea(normalized) > 0
  return (shouldReverse ? [...normalized].reverse() : normalized) as Ring
}

const normalizeMultiPolygon = (geometry: MultiPolygon): MultiPolygon =>
  geometry.map(polygon => polygon.map((ring, index) =>
    normalizeRing(ring, index === 0)
  ).filter(ring => ring.length >= 4))
    .filter(polygon => polygon.length > 0)

const features = subdivisions.map(membership => {
  if (membership.membershipStatus !== 'verified') {
    throw new Error(`${membership.legislativeDistrictId} is not verified.`)
  }
  const district = districts.find(item => item.id === membership.legislativeDistrictId)
  if (!district) {
    throw new Error(`Missing district ${membership.legislativeDistrictId}.`)
  }

  const barangayCodes = membership.units
    .filter(unit => unit.type === 'barangay')
    .map(unit => unit.code)
  const barangayFeatures = barangayCodes.map(code => {
    const feature = geometryFeatureByBarangayCode.get(code)
    if (!feature) throw new Error(`${district.id} has no geometry for ${code}.`)
    return feature
  })
  const wholeLocalityCodes = district.memberships
    .filter(item => item.coverage === 'whole')
    .map(item => item.localityCode)
  const localityFeatures = wholeLocalityCodes.map(code => {
    const feature = geometryFeatureByLocalityCode.get(code)
    if (!feature) {
      throw new Error(`${district.id} has no whole-locality geometry for ${code}.`)
    }
    return feature
  })
  const inputFeatures = [...new Set([...barangayFeatures, ...localityFeatures])]
  if (inputFeatures.length === 0) {
    throw new Error(`${district.id} has no barangay geometry.`)
  }

  const inputGeometries = inputFeatures.map(feature => asMultiPolygon(feature.geometry))
  const dissolved = normalizeMultiPolygon(polygonClipping.union(
    inputGeometries[0],
    ...inputGeometries.slice(1),
  ))
  if (dissolved.length === 0) {
    throw new Error(`${district.id} produced an empty dissolved geometry.`)
  }

  const geometry = dissolved.length === 1
    ? { type: 'Polygon' as const, coordinates: dissolved[0] }
    : { type: 'MultiPolygon' as const, coordinates: dissolved }
  const resolutions = new Set(
    inputFeatures.map(feature => feature.properties.boundaryResolution),
  )
  const inputArea = inputGeometries.reduce(
    (total, item) => total + multiPolygonArea(item),
    0,
  )
  const dissolvedArea = multiPolygonArea(dissolved)

  return {
    type: 'Feature' as const,
    id: district.id,
    properties: {
      legislativeDistrictId: district.id,
      electionYear: district.electionYear,
      label: district.label,
      regionCode: district.region.code,
      regionName: district.region.name,
      jurisdictionCode: district.jurisdiction?.code ?? null,
      jurisdictionName: district.jurisdiction?.name ?? null,
      jurisdictionType: district.jurisdiction?.type ?? null,
      localityCodes: district.memberships.map(item => item.localityCode),
      localityNames: district.memberships.map(item => item.localityName),
      boundaryStatus: 'draft',
      source: reference.metadata.source,
      sourceUrl: reference.metadata.sourceUrl,
      sourceRetrievedAt: reference.metadata.retrievedAt,
      sourceSha256: referenceManifest.sha256,
      generationMethod: 'Dissolve verified barangay polygons with polygon-clipping union.',
      inputBarangayCount: barangayCodes.length,
      inputWholeLocalityCount: wholeLocalityCodes.length,
      inputGeometryCount: inputFeatures.length,
      boundaryResolution: resolutions.size === 1 && resolutions.has('exact')
        ? 'exact'
        : 'reconciled',
      inputAreaSquareDegrees: inputArea,
      dissolvedAreaSquareDegrees: dissolvedArea,
      overlapRemovedSquareDegrees: Math.max(0, inputArea - dissolvedArea),
      notes: resolutions.has('aggregate-predecessor')
        ? 'Uses the legacy Barangay 176 footprint for its six Caloocan successor barangays.'
        : resolutions.has('legacy-code')
          ? 'Includes EMBO geometry exposed under its former Makati PSGC code.'
          : null,
    },
    geometry,
  }
})

const collection = {
  type: 'FeatureCollection',
  metadata: {
    datasetId: 'generated-legislative-district-boundaries-2025',
    electionYear: 2025,
    coordinateReferenceSystem: 'EPSG:4326',
    coordinateOrder: ['longitude', 'latitude'],
    source: reference.metadata.source,
    sourceUrl: reference.metadata.sourceUrl,
    sourceRetrievedAt: reference.metadata.retrievedAt,
    sourceSha256: referenceManifest.sha256,
    purpose:
      'Legislative district polygons generated by dissolving verified barangay membership.',
  },
  features,
}

const formattedCollection = JSON.stringify(collection, null, 2).replace(
  /\[\n\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?),\n\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\n\s+\]/g,
  '[$1, $2]',
)
writeFileSync(outputPath, `${formattedCollection}\n`, 'utf8')
console.log(JSON.stringify({
  output: outputPath,
  districts: features.length,
  polygons: features.filter(feature => feature.geometry.type === 'Polygon').length,
  multiPolygons: features.filter(
    feature => feature.geometry.type === 'MultiPolygon',
  ).length,
}, null, 2))
