import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface SubdivisionDataset {
  metadata: {
    electionYear: number
    psgcReferenceDate: string
  }
  data: Array<{
    legislativeDistrictId: string
    units: Array<{
      code: string
      name: string
      type: 'barangay' | 'submunicipality'
    }>
  }>
}

interface LegislativeDistrictDataset {
  data: Array<{
    status: string
    memberships: Array<{
      localityCode: string
      coverage: 'whole' | 'partial'
    }>
  }>
}

interface GeoJsonFeature {
  type: 'Feature'
  id?: string | number
  properties: Record<string, unknown>
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: unknown
  } | null
}

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
  error?: unknown
}

const SOURCE_URL =
  'https://ulap-nga.georisk.gov.ph/arcgis/rest/services/PSA/BarangayPopMF/MapServer/0/query'
const LOCALITY_SOURCE_URL =
  'https://ulap-nga.georisk.gov.ph/arcgis/rest/services/PSA/MunicipalPopMF/MapServer/2/query'
const BATCH_SIZE = 50
const MAX_ATTEMPTS = 3

// GeoRiskPH currently exposes the ten EMBO polygons under their former Makati
// PSGC codes. Geometry is unchanged by the administrative transfer to Taguig.
const LEGACY_CODE_BY_CURRENT_CODE: Record<string, string> = {
  '1381500029': '1380300003',
  '1381500030': '1380300004',
  '1381500031': '1380300007',
  '1381500032': '1380300016',
  '1381500033': '1380300019',
  '1381500034': '1380300021',
  '1381500035': '1380300022',
  '1381500036': '1380300033',
  '1381500037': '1380300028',
  '1381500038': '1380300032',
}

// The service still has the undivided Barangay 176 polygon. Its six successor
// barangays all belong to the same legislative district, so the predecessor
// footprint is valid for district dissolving even though it cannot draw their
// internal boundaries.
const CALOOCAN_176_SUCCESSOR_CODES = [
  '1380100189',
  '1380100190',
  '1380100191',
  '1380100192',
  '1380100193',
  '1380100194',
]
const CALOOCAN_176_LEGACY_CODE = '1380100176'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../..')
const referenceDirectory = resolve(repositoryRoot, 'backend/src/data/reference')
const subdivisionPath = resolve(
  repositoryRoot,
  'backend/src/data/normalized/legislative-district-subdivisions-2025.json',
)
const districtPath = resolve(
  repositoryRoot,
  'backend/src/data/normalized/legislative-districts-2025.json',
)

const argument = (name: string) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const outputPath = resolve(
  argument('--output') ??
    resolve(referenceDirectory, 'legislative-barangay-boundaries-2025.geojson'),
)
const manifestPath = resolve(
  argument('--manifest') ??
    resolve(referenceDirectory, 'legislative-barangay-boundaries-2025.manifest.json'),
)

const subdivisionDataset = JSON.parse(
  readFileSync(subdivisionPath, 'utf8'),
) as SubdivisionDataset
const districtDataset = JSON.parse(
  readFileSync(districtPath, 'utf8'),
) as LegislativeDistrictDataset
const expectedByCode = new Map<string, string>()

for (const membership of subdivisionDataset.data) {
  for (const unit of membership.units) {
    if (unit.type !== 'barangay') continue
    const existing = expectedByCode.get(unit.code)
    if (existing && existing !== unit.name) {
      throw new Error(`PSGC code ${unit.code} has conflicting barangay names.`)
    }
    expectedByCode.set(unit.code, unit.name)
  }
}

const expectedCodes = [...expectedByCode.keys()].sort()
const currentCodesBySourceCode = new Map<string, string[]>()
for (const code of expectedCodes) {
  const sourceCode = CALOOCAN_176_SUCCESSOR_CODES.includes(code)
    ? CALOOCAN_176_LEGACY_CODE
    : LEGACY_CODE_BY_CURRENT_CODE[code] ?? code
  const currentCodes = currentCodesBySourceCode.get(sourceCode) ?? []
  currentCodes.push(code)
  currentCodesBySourceCode.set(sourceCode, currentCodes)
}
const requestedSourceCodes = [...currentCodesBySourceCode.keys()].sort()
const wholeLocalityCodes = [...new Set(districtDataset.data
  .filter(district => district.status === 'partial-boundary')
  .flatMap(district => district.memberships
    .filter(membership => membership.coverage === 'whole')
    .map(membership => membership.localityCode)))].sort()
const batches = Array.from(
  { length: Math.ceil(requestedSourceCodes.length / BATCH_SIZE) },
  (_, index) => requestedSourceCodes.slice(
    index * BATCH_SIZE,
    (index + 1) * BATCH_SIZE,
  ),
)

const wait = (milliseconds: number) => new Promise(resolveWait => {
  setTimeout(resolveWait, milliseconds)
})

const fetchBatch = async (
  codes: string[],
  batchNumber: number,
  sourceUrl = SOURCE_URL,
  outFields = 'psgc_10d,brgy_name,city_name',
) => {
  const body = new URLSearchParams({
    where: `psgc_10d IN (${codes.map(code => `'${code}'`).join(',')})`,
    outFields,
    returnGeometry: 'true',
    outSR: '4326',
    geometryPrecision: '6',
    f: 'geojson',
  })

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/geo+json, application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body,
        signal: AbortSignal.timeout(60_000),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const payload = await response.json() as GeoJsonFeatureCollection
      if (
        payload.error ||
        payload.type !== 'FeatureCollection' ||
        !Array.isArray(payload.features)
      ) {
        throw new Error('upstream returned an invalid GeoJSON response')
      }
      return payload.features
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        const reason = error instanceof Error ? error.message : String(error)
        throw new Error(`Boundary batch ${batchNumber} failed: ${reason}`)
      }
      await wait(500 * attempt)
    }
  }

  return []
}

const batchResults: GeoJsonFeature[][] = []
for (let index = 0; index < batches.length; index += 4) {
  const group = batches.slice(index, index + 4)
  const results = await Promise.all(group.map((codes, offset) =>
    fetchBatch(codes, index + offset + 1)
  ))
  batchResults.push(...results)
}
const wholeLocalityFeatures = wholeLocalityCodes.length === 0
  ? []
  : await fetchBatch(
      wholeLocalityCodes,
      batches.length + 1,
      LOCALITY_SOURCE_URL,
      'psgc_10d,city_name,geographic_level',
    )

const featureBySourceCode = new Map<string, GeoJsonFeature>()
for (const feature of batchResults.flat()) {
  const sourceCode = feature.properties.psgc_10d
  if (
    typeof sourceCode !== 'string' ||
    !currentCodesBySourceCode.has(sourceCode)
  ) continue
  if (featureBySourceCode.has(sourceCode)) {
    throw new Error(`Boundary service returned duplicate PSGC code ${sourceCode}.`)
  }
  if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
    throw new Error(`Boundary service returned invalid geometry for ${sourceCode}.`)
  }

  const coveredPsgcCodes = currentCodesBySourceCode.get(sourceCode)!
  const boundaryResolution = sourceCode === CALOOCAN_176_LEGACY_CODE
    ? 'aggregate-predecessor'
    : coveredPsgcCodes[0] === sourceCode
      ? 'exact'
      : 'legacy-code'
  featureBySourceCode.set(sourceCode, {
    type: 'Feature',
    id: boundaryResolution === 'exact'
      ? coveredPsgcCodes[0]
      : `source-${sourceCode}`,
    properties: {
      geometryLevel: 'barangay',
      sourcePsgcCode: sourceCode,
      coveredPsgcCodes,
      coveredLocalityCodes: [],
      boundaryResolution,
      barangayName: coveredPsgcCodes.length === 1
        ? expectedByCode.get(coveredPsgcCodes[0])
        : 'Barangay 176-A to 176-F',
      sourceBarangayName: feature.properties.brgy_name ?? null,
      sourceCityName: feature.properties.city_name ?? null,
    },
    geometry: feature.geometry,
  })
}

const localityFeatureByCode = new Map<string, GeoJsonFeature>()
for (const feature of wholeLocalityFeatures) {
  const code = feature.properties.psgc_10d
  if (typeof code !== 'string' || !wholeLocalityCodes.includes(code)) continue
  if (localityFeatureByCode.has(code)) {
    throw new Error(`Boundary service returned duplicate locality code ${code}.`)
  }
  if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
    throw new Error(`Boundary service returned invalid locality geometry for ${code}.`)
  }
  localityFeatureByCode.set(code, {
    type: 'Feature',
    id: `locality-${code}`,
    properties: {
      geometryLevel: 'locality',
      sourcePsgcCode: code,
      coveredPsgcCodes: [],
      coveredLocalityCodes: [code],
      boundaryResolution: 'exact',
      localityName: feature.properties.city_name ?? null,
    },
    geometry: feature.geometry,
  })
}

const missingSourceCodes = requestedSourceCodes.filter(
  code => !featureBySourceCode.has(code),
)
if (missingSourceCodes.length > 0) {
  throw new Error(
    `Boundary source is missing ${missingSourceCodes.length}/${requestedSourceCodes.length} required source geometries: ${missingSourceCodes.join(', ')}`,
  )
}
const missingLocalityCodes = wholeLocalityCodes.filter(
  code => !localityFeatureByCode.has(code),
)
if (missingLocalityCodes.length > 0) {
  throw new Error(
    `Boundary source is missing whole-locality geometries: ${missingLocalityCodes.join(', ')}`,
  )
}

const retrievedAt = new Date().toISOString()
const output = {
  type: 'FeatureCollection',
  metadata: {
    datasetId: 'legislative-barangay-boundaries-2025',
    electionYear: subdivisionDataset.metadata.electionYear,
    psgcReferenceDate: subdivisionDataset.metadata.psgcReferenceDate,
    coordinateReferenceSystem: 'EPSG:4326',
    source: 'GeoRiskPH PSA administrative boundary feature layers',
    sourceUrl: SOURCE_URL,
    localitySourceUrl: LOCALITY_SOURCE_URL,
    retrievedAt,
    requestedBarangays: expectedCodes.length,
    coveredBarangays: expectedCodes.length,
    returnedGeometryFeatures: featureBySourceCode.size,
    supplementalWholeLocalities: wholeLocalityCodes.length,
    reconciliation: {
      exactCodes: expectedCodes.length -
        Object.keys(LEGACY_CODE_BY_CURRENT_CODE).length -
        CALOOCAN_176_SUCCESSOR_CODES.length,
      legacyCodes: Object.keys(LEGACY_CODE_BY_CURRENT_CODE).length,
      aggregatePredecessorCodes: CALOOCAN_176_SUCCESSOR_CODES.length,
    },
  },
  features: [
    ...requestedSourceCodes.map(code => featureBySourceCode.get(code)),
    ...wholeLocalityCodes.map(code => localityFeatureByCode.get(code)),
  ],
}
const serialized = `${JSON.stringify(output)}\n`
const sha256 = createHash('sha256').update(serialized).digest('hex')

mkdirSync(dirname(outputPath), { recursive: true })
mkdirSync(dirname(manifestPath), { recursive: true })
writeFileSync(outputPath, serialized, 'utf8')
writeFileSync(manifestPath, `${JSON.stringify({
  datasetId: output.metadata.datasetId,
  sourceUrl: SOURCE_URL,
  retrievedAt,
  sha256,
  featureCount: featureBySourceCode.size + localityFeatureByCode.size,
  coveredBarangayCount: expectedCodes.length,
  relativePath: outputPath.slice(repositoryRoot.length + 1),
}, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({
  output: outputPath,
  manifest: manifestPath,
  featureCount: featureBySourceCode.size + localityFeatureByCode.size,
  coveredBarangayCount: expectedCodes.length,
  sha256,
}, null, 2))
