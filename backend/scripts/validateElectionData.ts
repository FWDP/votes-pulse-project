import {
  createHash,
} from 'node:crypto'
import {
  readFileSync,
} from 'node:fs'
import {
  dirname,
  resolve,
} from 'node:path'
import {
  fileURLToPath,
} from 'node:url'
import {
  findRingTopologyIssues,
  signedRingArea,
  type Position as TopologyPosition,
} from './lib/geometryTopology'

interface ValidationReport {
  summary: {
    errors: number
  }
}

type Position = [number, number, ...number[]]

interface BoundaryFeature {
  id?: string
  properties: {
    legislativeDistrictId?: string
    boundaryStatus?: string
    source?: string | null
    syncStatus?: string
  }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: unknown
  } | null
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../..')
const dataDirectory = resolve(repositoryRoot, 'backend/src/data')
const normalizedDirectory = resolve(dataDirectory, 'normalized')

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T

const sha256 = (path: string) => createHash('sha256')
  .update(readFileSync(path))
  .digest('hex')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const legislative = readJson<any>(resolve(
  normalizedDirectory,
  'legislative-districts-2025.json',
))
const partyLists = readJson<any>(resolve(
  normalizedDirectory,
  'party-lists-2025.json',
))
const legislativeValidation = readJson<ValidationReport>(resolve(
  normalizedDirectory,
  'validation/legislative-district-exceptions.json',
))
const partyListValidation = readJson<ValidationReport>(resolve(
  normalizedDirectory,
  'validation/party-list-exceptions.json',
))
const psgcReference = readJson<any>(resolve(
  dataDirectory,
  'reference/psgc-localities-2025.json',
))
const legislativeBoundaries = readJson<{
  type: string
  metadata: {
    electionYear: number
    coordinateReferenceSystem: string
    coordinateOrder: string[]
  }
  features: BoundaryFeature[]
}>(resolve(
  normalizedDirectory,
  'legislative-district-boundaries-2025.geojson',
))

assert(legislative.metadata.electionYear === 2025,
  'Legislative dataset must be for election year 2025.')
assert(legislative.metadata.sourceSha256 === sha256(resolve(
  dataDirectory,
  'LIST-CITIES-MUN-LEGDIST-2025.xls',
)), 'Legislative source checksum has changed; regenerate the dataset.')
assert(legislative.data.length === 254,
  `Expected 254 legislative districts, received ${legislative.data.length}.`)
assert(new Set(legislative.data.map((district: any) => district.id)).size ===
  legislative.data.length, 'Legislative district IDs must be unique.')
assert(legislativeValidation.summary.errors === 0,
  'Legislative import contains unresolved validation errors.')

const psgcCodes = new Set(
  psgcReference.data.map((node: any) => node.code),
)

for (const district of legislative.data) {
  assert(district.memberships.length > 0,
    `${district.id} must contain at least one locality membership.`)

  for (const membership of district.memberships) {
    assert(/^\d{10}$/.test(membership.localityCode),
      `${district.id} contains an invalid 10-digit PSGC code.`)
    assert(psgcCodes.has(membership.localityCode),
      `${district.id} references a locality absent from the PSGC snapshot.`)
    assert(['whole', 'partial'].includes(membership.coverage),
      `${district.id} contains an invalid membership coverage value.`)
    assert(membership.coverage !== 'partial' || membership.localityType === 'city',
      `${district.id} marks a non-city locality as partial.`)
  }
}

const validatePosition = (position: unknown, districtId: string) => {
  assert(Array.isArray(position) && position.length >= 2,
    `${districtId} contains an invalid GeoJSON position.`)
  const [longitude, latitude] = position as Position
  assert(Number.isFinite(longitude) && longitude >= -180 && longitude <= 180,
    `${districtId} contains a longitude outside -180 through 180.`)
  assert(Number.isFinite(latitude) && latitude >= -90 && latitude <= 90,
    `${districtId} contains a latitude outside -90 through 90.`)
}

const validateRing = (ring: unknown, districtId: string) => {
  assert(Array.isArray(ring) && ring.length >= 4,
    `${districtId} contains a polygon ring with fewer than four positions.`)
  ring.forEach(position => validatePosition(position, districtId))
  const first = ring[0] as Position
  const last = ring.at(-1) as Position
  assert(first[0] === last[0] && first[1] === last[1],
    `${districtId} contains an open polygon ring; first and last positions must match.`)
  const topologyRing = ring.map(position => [
    (position as Position)[0],
    (position as Position)[1],
  ] as TopologyPosition)
  const topologyIssues = findRingTopologyIssues(topologyRing)
  assert(topologyIssues.length === 0,
    `${districtId} contains invalid ring topology: ${topologyIssues[0]}.`)
  assert(Math.abs(signedRingArea(topologyRing)) > 0,
    `${districtId} contains a zero-area polygon ring.`)
}

const validatePolygon = (polygon: unknown, districtId: string) => {
  assert(Array.isArray(polygon) && polygon.length > 0,
    `${districtId} contains an empty polygon.`)
  polygon.forEach(ring => validateRing(ring, districtId))
  const outerRing = (polygon[0] as Position[]).map(position => [
    position[0],
    position[1],
  ] as TopologyPosition)
  assert(signedRingArea(outerRing) > 0,
    `${districtId} outer polygon ring must use counter-clockwise winding.`)
}

assert(legislativeBoundaries.type === 'FeatureCollection',
  'Legislative boundary file must be a GeoJSON FeatureCollection.')
assert(legislativeBoundaries.metadata.electionYear === 2025,
  'Legislative boundary file must be for election year 2025.')
assert(legislativeBoundaries.metadata.coordinateReferenceSystem === 'EPSG:4326',
  'Legislative boundaries must use EPSG:4326 coordinates.')
assert(JSON.stringify(legislativeBoundaries.metadata.coordinateOrder) ===
  JSON.stringify(['longitude', 'latitude']),
  'Legislative boundary coordinate order must be longitude, latitude.')

const expectedBoundaryIds = new Set<string>(
  legislative.data
    .filter((district: any) => district.status === 'partial-boundary')
    .map((district: any) => district.id),
)
const activeBoundaryFeatures = legislativeBoundaries.features.filter(
  feature => feature.properties.syncStatus !== 'stale',
)
const boundaryIds = activeBoundaryFeatures.map(feature =>
  feature.properties.legislativeDistrictId)

assert(new Set(boundaryIds).size === boundaryIds.length,
  'Legislative boundary feature IDs must be unique.')
assert(expectedBoundaryIds.size === activeBoundaryFeatures.length,
  'Legislative boundary file must contain one active feature per partial district.')

for (const districtId of expectedBoundaryIds) {
  assert(boundaryIds.includes(districtId),
    `Legislative boundary template is missing ${districtId}.`)
}

for (const feature of activeBoundaryFeatures) {
  const districtId = feature.properties.legislativeDistrictId
  assert(districtId && expectedBoundaryIds.has(districtId),
    `Boundary feature ${feature.id ?? '(missing id)'} is not a partial district.`)
  assert(feature.id === districtId,
    `${districtId} must use the legislative district ID as its GeoJSON feature ID.`)
  assert(['missing', 'draft', 'verified'].includes(
    feature.properties.boundaryStatus ?? '',
  ), `${districtId} has an invalid boundaryStatus.`)

  if (feature.geometry === null) {
    assert(feature.properties.boundaryStatus === 'missing',
      `${districtId} has no geometry and must have boundaryStatus "missing".`)
    continue
  }

  assert(feature.properties.boundaryStatus !== 'missing',
    `${districtId} has geometry and must be marked "draft" or "verified".`)
  assert(['Polygon', 'MultiPolygon'].includes(feature.geometry.type),
    `${districtId} geometry must be Polygon or MultiPolygon.`)

  if (feature.geometry.type === 'Polygon') {
    validatePolygon(feature.geometry.coordinates, districtId)
  } else {
    assert(Array.isArray(feature.geometry.coordinates) &&
      feature.geometry.coordinates.length > 0,
    `${districtId} contains an empty MultiPolygon.`)
    feature.geometry.coordinates.forEach((polygon: unknown) =>
      validatePolygon(polygon, districtId))
  }

  if (feature.properties.boundaryStatus === 'verified') {
    assert(typeof feature.properties.source === 'string' &&
      feature.properties.source.trim().length > 0,
    `${districtId} is verified but has no boundary source.`)
  }
}

assert(partyLists.metadata.electionYear === 2025,
  'Party-list dataset must be for election year 2025.')
assert(partyLists.metadata.geographicScope === 'national',
  'Party-list source must remain explicitly national in scope.')
assert(partyLists.metadata.sourceSha256 === sha256(resolve(
  dataDirectory,
  '2025 ELECTED PARTY LIST.pdf',
)), 'Party-list source checksum has changed; regenerate the dataset.')
assert(partyLists.data.length === 57,
  `Expected 57 party-list organizations, received ${partyLists.data.length}.`)
assert(partyLists.data.reduce(
  (total: number, record: any) => total + record.nominees.length,
  0,
) === 64, 'Expected 64 proclaimed nominees in the source PDF.')
assert(partyListValidation.summary.errors === 0,
  'Party-list import contains unresolved validation errors.')

const ranks = partyLists.data.map((record: any) => record.rank)
assert(ranks.every((rank: number, index: number) => rank === index + 1),
  'Party-list ranks must be the complete ordered sequence from 1 to 57.')
assert(partyLists.data.every((record: any, index: number, all: any[]) =>
  index === 0 || all[index - 1].totalVotes >= record.totalVotes),
  'Party-list vote totals must be non-increasing in rank order.')
assert(new Set(partyLists.data.map((record: any) => record.id)).size ===
  partyLists.data.length, 'Party-list IDs must be unique.')

for (const record of partyLists.data) {
  assert(record.geographicScope === 'national',
    `${record.id} must remain national in scope.`)
  assert(Number.isInteger(record.totalVotes) && record.totalVotes > 0,
    `${record.id} must contain a positive integer vote total.`)
  assert(record.nominees.length > 0,
    `${record.id} must contain at least one proclaimed nominee.`)
  assert(!new RegExp(`\\b${record.rank}\\b`).test(record.officialName),
    `${record.id} contains a leaked rank marker in its organization name.`)
}

console.log(JSON.stringify({
  legislativeDistricts: legislative.data.length,
  legislativeMemberships: legislative.data.reduce(
    (total: number, district: any) => total + district.memberships.length,
    0,
  ),
  partyListOrganizations: partyLists.data.length,
  proclaimedNominees: partyLists.data.reduce(
    (total: number, record: any) => total + record.nominees.length,
    0,
  ),
  legislativeBoundaryFeatures: activeBoundaryFeatures.length,
  legislativeBoundariesWithGeometry: activeBoundaryFeatures.filter(
    feature => feature.geometry !== null,
  ).length,
  status: 'valid',
}, null, 2))
