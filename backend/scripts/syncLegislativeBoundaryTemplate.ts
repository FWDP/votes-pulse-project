import {
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import {
  dirname,
  resolve,
} from 'node:path'
import {
  fileURLToPath,
} from 'node:url'

interface District {
  id: string
  electionYear: number
  label: string
  status: string
  region: {
    code: string
    name: string
  }
  jurisdiction: {
    code: string | null
    name: string
    type: string
  } | null
  memberships: Array<{
    localityCode: string
    localityName: string
  }>
}

interface BoundaryFeature {
  type: 'Feature'
  id: string
  properties: Record<string, unknown>
  geometry: unknown | null
}

interface BoundaryCollection {
  type: 'FeatureCollection'
  metadata?: Record<string, unknown>
  features: BoundaryFeature[]
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../..')
const normalizedDirectory = resolve(
  repositoryRoot,
  'backend/src/data/normalized',
)
const districtPath = resolve(
  normalizedDirectory,
  'legislative-districts-2025.json',
)
const boundaryPath = resolve(
  normalizedDirectory,
  'legislative-district-boundaries-2025.geojson',
)

const districts = (JSON.parse(readFileSync(districtPath, 'utf8')) as {
  data: District[]
}).data.filter(district => district.status === 'partial-boundary')

const existingCollection = existsSync(boundaryPath)
  ? JSON.parse(readFileSync(boundaryPath, 'utf8')) as BoundaryCollection
  : undefined
const existingById = new Map(
  (existingCollection?.features ?? []).map(feature => [
    String(feature.properties.legislativeDistrictId ?? feature.id),
    feature,
  ]),
)

const features: BoundaryFeature[] = districts.map(district => {
  const existing = existingById.get(district.id)
  existingById.delete(district.id)

  return {
    type: 'Feature',
    id: district.id,
    properties: {
      ...(existing?.properties ?? {}),
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
      boundaryStatus:
        existing?.properties.boundaryStatus ??
        (existing?.geometry ? 'draft' : 'missing'),
      source: existing?.properties.source ?? null,
      sourceUrl: existing?.properties.sourceUrl ?? null,
      notes: existing?.properties.notes ?? null,
    },
    geometry: existing?.geometry ?? null,
  }
})

// Preserve hand-entered features that no longer correspond to a current
// partial-boundary warning. This avoids deleting manual geometry during sync.
for (const staleFeature of existingById.values()) {
  features.push({
    ...staleFeature,
    properties: {
      ...staleFeature.properties,
      syncStatus: 'stale',
    },
  })
}

const collection: BoundaryCollection = {
  type: 'FeatureCollection',
  metadata: {
    datasetId: 'manual-legislative-district-boundaries-2025',
    electionYear: 2025,
    coordinateReferenceSystem: 'EPSG:4326',
    coordinateOrder: ['longitude', 'latitude'],
    purpose:
      'Manual Polygon or MultiPolygon boundaries for cities split across legislative districts.',
    synchronization:
      'Run npm run data:sync:election-boundaries after regenerating the legislative district dataset. Existing geometry and manual properties are preserved.',
  },
  features,
}

writeFileSync(boundaryPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({
  output: boundaryPath,
  expectedDistricts: districts.length,
  features: features.length,
  withGeometry: features.filter(feature => feature.geometry !== null).length,
  staleFeatures: existingById.size,
}, null, 2))
