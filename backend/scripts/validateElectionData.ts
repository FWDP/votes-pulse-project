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
import polygonClipping, {
  type MultiPolygon as ClippingMultiPolygon,
  type Polygon as ClippingPolygon,
} from 'polygon-clipping'
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
    sourceSha256?: string
    syncStatus?: string
    localityCodes?: string[]
    inputBarangayCount?: number
    inputWholeLocalityCount?: number
    inputAreaSquareDegrees?: number
    dissolvedAreaSquareDegrees?: number
    overlapRemovedSquareDegrees?: number
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
    sourceSha256?: string
  }
  features: BoundaryFeature[]
}>(resolve(
  normalizedDirectory,
  'legislative-district-boundaries-2025.geojson',
))
const legislativeSubdivisions = readJson<any>(resolve(
  normalizedDirectory,
  'legislative-district-subdivisions-2025.json',
))
const boundaryReferencePath = resolve(
  dataDirectory,
  'reference/legislative-barangay-boundaries-2025.geojson',
)
const boundaryReference = readJson<any>(boundaryReferencePath)
const boundaryReferenceManifest = readJson<any>(resolve(
  dataDirectory,
  'reference/legislative-barangay-boundaries-2025.manifest.json',
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

assert(legislativeSubdivisions.metadata.electionYear === 2025,
  'Legislative subdivision dataset must be for election year 2025.')
assert(legislativeSubdivisions.metadata.psgcReferenceDate === '2025-07-08',
  'Legislative subdivisions must use the election dataset PSGC snapshot.')

const expectedSubdivisionDistrictIds = new Set<string>(
  legislative.data
    .filter((district: any) => district.status === 'partial-boundary')
    .map((district: any) => district.id),
)
const subdivisionDistrictIds = legislativeSubdivisions.data.map(
  (item: any) => item.legislativeDistrictId,
)
assert(new Set(subdivisionDistrictIds).size === subdivisionDistrictIds.length,
  'Legislative subdivision district IDs must be unique.')
assert(subdivisionDistrictIds.length === expectedSubdivisionDistrictIds.size,
  'Subdivision dataset must contain one entry per partial district.')
assert(legislativeSubdivisions.data.every(
  (item: any) => item.membershipStatus === 'verified',
), 'Every partial legislative district must have verified subdivision coverage.')

const assignedSubdivisionCodes = new Set<string>()
for (const membership of legislativeSubdivisions.data) {
  assert(expectedSubdivisionDistrictIds.has(membership.legislativeDistrictId),
    `${membership.legislativeDistrictId} is not a partial legislative district.`)
  assert(['missing', 'draft', 'verified'].includes(membership.membershipStatus),
    `${membership.legislativeDistrictId} has an invalid subdivision status.`)
  assert(Array.isArray(membership.units) && Array.isArray(membership.sources),
    `${membership.legislativeDistrictId} has invalid subdivision arrays.`)
  assert(membership.membershipStatus !== 'missing' ||
    (membership.units.length === 0 && membership.sources.length === 0),
  `${membership.legislativeDistrictId} is missing but contains subdivision data.`)
  assert(membership.membershipStatus !== 'verified' ||
    (membership.units.length > 0 && membership.sources.length > 0),
  `${membership.legislativeDistrictId} is verified without units and sources.`)

  const district = legislative.data.find(
    (item: any) => item.id === membership.legislativeDistrictId,
  )
  const localityCodes = new Set(
    district.memberships.map((item: any) => item.localityCode),
  )
  for (const unit of membership.units) {
    assert(/^\d{10}$/.test(unit.code) && /^\d{10}$/.test(unit.parentCode),
      `${membership.legislativeDistrictId} contains an invalid subdivision PSGC code.`)
    assert(['barangay', 'submunicipality'].includes(unit.type),
      `${membership.legislativeDistrictId} contains an invalid subdivision type.`)
    if (unit.type === 'submunicipality') {
      assert(localityCodes.has(unit.parentCode),
        `${unit.code} has no parent locality in ${membership.legislativeDistrictId}.`)
    }
    assert(!assignedSubdivisionCodes.has(unit.code),
      `${unit.code} is assigned to more than one legislative district.`)
    assignedSubdivisionCodes.add(unit.code)
  }
  for (const source of membership.sources) {
    assert(typeof source.name === 'string' && source.name.trim().length > 0,
      `${membership.legislativeDistrictId} contains an unnamed source.`)
    assert(/^https:\/\//.test(source.url),
      `${membership.legislativeDistrictId} contains an invalid source URL.`)
    assert([
      'legislative-district-assignment',
      'unit-identity-and-hierarchy',
    ].includes(source.role),
    `${membership.legislativeDistrictId} contains an invalid source role.`)
  }
}
assert(assignedSubdivisionCodes.size === 1824,
  'Legislative subdivision dataset must contain 1,814 barangays and 10 whole submunicipalities.')

assert(boundaryReferenceManifest.sha256 === sha256(boundaryReferencePath),
  'Cached legislative boundary input checksum does not match its manifest.')
assert(boundaryReference.type === 'FeatureCollection' &&
  Array.isArray(boundaryReference.features),
  'Legislative boundary inputs must be a GeoJSON FeatureCollection.')
const expectedBoundaryBarangayCodes = new Set<string>(
  legislativeSubdivisions.data.flatMap((membership: any) =>
    membership.units
      .filter((unit: any) => unit.type === 'barangay')
      .map((unit: any) => unit.code),
  ),
)
const expectedWholeLocalityCodes = new Set<string>(
  legislative.data
    .filter((district: any) => district.status === 'partial-boundary')
    .flatMap((district: any) => district.memberships
      .filter((membership: any) => membership.coverage === 'whole')
      .map((membership: any) => membership.localityCode)),
)
const coveredBoundaryBarangayCodes = new Set<string>()
const coveredWholeLocalityCodes = new Set<string>()
for (const feature of boundaryReference.features) {
  assert(feature.geometry && ['Polygon', 'MultiPolygon'].includes(feature.geometry.type),
    `Boundary input ${feature.id ?? '(missing id)'} has invalid geometry.`)
  assert(['barangay', 'locality'].includes(feature.properties.geometryLevel),
    `Boundary input ${feature.id ?? '(missing id)'} has an invalid level.`)
  for (const code of feature.properties.coveredPsgcCodes ?? []) {
    assert(expectedBoundaryBarangayCodes.has(code),
      `Boundary input unexpectedly covers barangay ${code}.`)
    assert(!coveredBoundaryBarangayCodes.has(code),
      `Boundary input covers barangay ${code} more than once.`)
    coveredBoundaryBarangayCodes.add(code)
  }
  for (const code of feature.properties.coveredLocalityCodes ?? []) {
    assert(expectedWholeLocalityCodes.has(code),
      `Boundary input unexpectedly covers whole locality ${code}.`)
    assert(!coveredWholeLocalityCodes.has(code),
      `Boundary input covers whole locality ${code} more than once.`)
    coveredWholeLocalityCodes.add(code)
  }
}
assert(coveredBoundaryBarangayCodes.size === expectedBoundaryBarangayCodes.size,
  'Boundary inputs must cover every assigned barangay exactly once.')
assert(coveredWholeLocalityCodes.size === expectedWholeLocalityCodes.size,
  'Boundary inputs must cover every whole locality in a partial district.')

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
assert(legislativeBoundaries.metadata.sourceSha256 ===
  boundaryReferenceManifest.sha256,
  'Legislative boundaries must record the cached input checksum.')

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

  const subdivisionMembership = legislativeSubdivisions.data.find(
    (item: any) => item.legislativeDistrictId === districtId,
  )
  const district = legislative.data.find((item: any) => item.id === districtId)
  assert(feature.properties.sourceSha256 === boundaryReferenceManifest.sha256,
    `${districtId} does not record the cached boundary input checksum.`)
  assert(feature.properties.inputBarangayCount ===
    subdivisionMembership.units.filter((unit: any) => unit.type === 'barangay').length,
  `${districtId} has an incorrect input barangay count.`)
  assert(feature.properties.inputWholeLocalityCount ===
    district.memberships.filter((item: any) => item.coverage === 'whole').length,
  `${districtId} has an incorrect whole-locality input count.`)
  assert(typeof feature.properties.inputAreaSquareDegrees === 'number' &&
    feature.properties.inputAreaSquareDegrees > 0 &&
    typeof feature.properties.dissolvedAreaSquareDegrees === 'number' &&
    feature.properties.dissolvedAreaSquareDegrees > 0,
  `${districtId} has invalid generation area metrics.`)
  const overlapRatio = (feature.properties.overlapRemovedSquareDegrees ?? Infinity) /
    feature.properties.inputAreaSquareDegrees
  assert(overlapRatio <= 1e-6,
    `${districtId} removed too much overlapping input area (${overlapRatio}).`)

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

const asClippingMultiPolygon = (feature: BoundaryFeature): ClippingMultiPolygon => {
  assert(feature.geometry !== null,
    `${feature.id ?? '(missing id)'} has no geometry for overlap validation.`)
  return feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as ClippingPolygon]
    : feature.geometry.coordinates as ClippingMultiPolygon
}
const clippingArea = (geometry: ClippingMultiPolygon) => geometry.reduce(
  (total, polygon) => total + polygon.reduce(
    (polygonTotal, ring, index) => polygonTotal +
      Math.abs(signedRingArea(ring as TopologyPosition[])) *
      (index === 0 ? 1 : -1),
    0,
  ),
  0,
)

for (let first = 0; first < activeBoundaryFeatures.length; first += 1) {
  for (let second = first + 1; second < activeBoundaryFeatures.length; second += 1) {
    const firstFeature = activeBoundaryFeatures[first]
    const secondFeature = activeBoundaryFeatures[second]
    if (!(firstFeature.properties.localityCodes ?? []).some(code =>
      secondFeature.properties.localityCodes?.includes(code)
    )) continue

    const overlap = polygonClipping.intersection(
      asClippingMultiPolygon(firstFeature),
      asClippingMultiPolygon(secondFeature),
    )
    assert(clippingArea(overlap) <= 1e-10,
      `${firstFeature.id} and ${secondFeature.id} have overlapping district area.`)
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
