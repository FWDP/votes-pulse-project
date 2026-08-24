import {
  createHash,
} from 'node:crypto'
import {
  execFileSync,
} from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import {
  tmpdir,
} from 'node:os'
import {
  dirname,
  resolve,
} from 'node:path'
import {
  fileURLToPath,
} from 'node:url'

type PsgcType = 'region' | 'province' | 'city' | 'municipality'

interface RawPsgcNode {
  name: string
  type: string
  psgc_id: string
  parent_psgc_id: string
  nicknames: string[] | null
}

interface PsgcNode {
  name: string
  type: PsgcType
  code: string
  parentCode: string
  nicknames: string[]
}

interface SourceLocation {
  sourceRow: number
  sourceName: string
  node: PsgcNode
}

interface WorkingDistrict {
  sourceLabel: string
  sourceRows: number[]
  region: PsgcNode
  province?: PsgcNode
  explicitJurisdiction?: PsgcNode
  jurisdictionKey?: string
  jurisdictionName?: string
  memberships: SourceLocation[]
}

interface ValidationIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  sourceRow?: number
  sourceValue?: string
  context?: Record<string, string | number | boolean | undefined>
}

interface PdfLine {
  page: number
  xMin: number
  xMax: number
  yMin: number
  text: string
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../..')
const dataDirectory = resolve(repositoryRoot, 'backend/src/data')
const normalizedDirectory = resolve(dataDirectory, 'normalized')
const referenceDirectory = resolve(dataDirectory, 'reference')
const validationDirectory = resolve(normalizedDirectory, 'validation')

const legislativeSourcePath = resolve(
  dataDirectory,
  'LIST-CITIES-MUN-LEGDIST-2025.xls',
)
const partyListSourcePath = resolve(
  dataDirectory,
  '2025 ELECTED PARTY LIST.pdf',
)
const referencePath = resolve(
  referenceDirectory,
  'psgc-localities-2025.json',
)

const getArgument = (name: string) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const suppliedPsgcPath = getArgument('--psgc')

const sha256 = (path: string) => createHash('sha256')
  .update(readFileSync(path))
  .digest('hex')

const writeJson = (path: string, value: unknown) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const compactWhitespace = (value: string) => value
  .replace(/\s+/g, ' ')
  .trim()

const stripDiacritics = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

const normalizeName = (value: string) => stripDiacritics(value)
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/\b(?:city|municipality) of\b/g, ' ')
  .replace(/\bcity\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\bprovince of\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value: string) => normalizeName(value)
  .replace(/\s+/g, '-')

const normalizeSourcePlace = (value: string) => compactWhitespace(value)
  .replace(/\s*\([^)]*\)\s*$/g, '')
  .trim()

const decodeXml = (value: string) => value
  .replace(/&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')
  .replace(/&#(\d+);/g, (_match, code: string) =>
    String.fromCodePoint(Number(code)))

const parseCsvLine = (line: string): string[] => {
  const fields: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      fields.push(current)
      current = ''
    } else {
      current += character
    }
  }

  fields.push(current)
  return fields
}

const REGION_CODES: Record<string, string> = {
  'NATIONAL CAPITAL REGION': '1300000000',
  'CORDILLERA ADM. REGION': '1400000000',
  'REGION I': '0100000000',
  'REGION II': '0200000000',
  'REGION III': '0300000000',
  'REGION IV-A (CALABARZON)': '0400000000',
  'REGION IV-B (MIMAROPA)': '1700000000',
  'REGION V': '0500000000',
  'REGION VI': '0600000000',
  'NEGROS ISLAND REGION': '1800000000',
  'REGION VII': '0700000000',
  'REGION VIII': '0800000000',
  'REGION IX': '0900000000',
  'REGION X': '1000000000',
  'REGION XI': '1100000000',
  'REGION XII': '1200000000',
  'B.A.R.M.M.': '1900000000',
  'CARAGA': '1600000000',
}

const normalizeRegionHeading = (value: string) => compactWhitespace(value)

const isUppercaseHeading = (value: string) =>
  /[A-Z]/.test(value) && value === value.toUpperCase()

const districtOrdinal = (label: string) => {
  if (/^lone\b/i.test(label)) return 'lone'
  const match = label.match(/^(\d+)(?:st|nd|rd|th)\b/i)
  return match?.[1] ?? slugify(label)
}

const isLegislativeDistrict = (value: string) =>
  /^(?:Lone|\d+(?:st|nd|rd|th)) Legislative District\s*$/i.test(value)

const isDistrictSummary = (value: string) =>
  /^(?:Two|Three) Legislative Districts?\s*$/i.test(value)

const isNonLegislativeDistrict = (value: string) =>
  /(?:Provincial|Councilor) District/i.test(value)

const loadPsgcReference = () => {
  const sourcePath = suppliedPsgcPath ?? referencePath

  if (!existsSync(sourcePath)) {
    throw new Error(
      `PSGC reference not found at ${sourcePath}. ` +
      'Supply the July 2025 flat PSGC JSON with --psgc <path>.',
    )
  }

  const raw = JSON.parse(readFileSync(sourcePath, 'utf8')) as
    RawPsgcNode[] | { data: PsgcNode[] }

  const rawNodes = Array.isArray(raw) ? raw : raw.data
  const allowedTypes = new Set<PsgcType>([
    'region',
    'province',
    'city',
    'municipality',
  ])

  const nodes = rawNodes
    .map((node): PsgcNode | null => {
      const rawType = 'psgc_id' in node ? node.type : node.type
      if (!allowedTypes.has(rawType as PsgcType)) return null

      if ('psgc_id' in node) {
        return {
          name: node.name,
          type: rawType as PsgcType,
          code: node.psgc_id,
          parentCode: node.parent_psgc_id,
          nicknames: node.nicknames ?? [],
        }
      }

      return node
    })
    .filter((node): node is PsgcNode => node !== null)

  if (suppliedPsgcPath) {
    writeJson(referencePath, {
      metadata: {
        datasetDate: '2025-07-08',
        description: 'PSGC regions, provinces, cities, and municipalities used for election-source matching.',
        upstream: 'PSA PSGC Q2 2025 publication data, packaged by barangay 2025.7.31.1',
        upstreamUrl: 'https://pypi.org/project/barangay/2025.7.31.1/',
        suppliedFileSha256: sha256(suppliedPsgcPath),
      },
      data: nodes,
    })
  }

  return nodes
}

const buildPsgcIndexes = (nodes: PsgcNode[]) => {
  const byCode = new Map(nodes.map(node => [node.code, node]))
  const regions = nodes.filter(node => node.type === 'region')
  const provinces = nodes.filter(node => node.type === 'province')
  const localities = nodes.filter(node =>
    node.type === 'city' || node.type === 'municipality')

  const getRegionCode = (node: PsgcNode) => {
    let current: PsgcNode | undefined = node

    while (current && current.type !== 'region') {
      current = byCode.get(current.parentCode)
    }

    return current?.code
  }

  return {
    byCode,
    regions,
    provinces,
    localities,
    getRegionCode,
  }
}

const findProvince = (
  sourceName: string,
  region: PsgcNode,
  indexes: ReturnType<typeof buildPsgcIndexes>,
) => {
  const key = normalizeName(sourceName).replace(/\s/g, '')
  const withinRegion = indexes.provinces.find(province =>
    province.parentCode === region.code &&
    normalizeName(province.name).replace(/\s/g, '') === key)

  if (withinRegion) return withinRegion

  const nationwide = indexes.provinces.filter(province =>
    normalizeName(province.name).replace(/\s/g, '') === key)

  return nationwide.length === 1 ? nationwide[0] : undefined
}

const LOCALITY_ALIASES: Record<string, string> = {
  'city of muntinlupa': 'Muntinlupa',
  'city of santo tomas': 'City of Sto. Tomas',
  'pres. carlos p. garcia': 'President Carlos P. Garcia',
  'lapaz': 'La Paz',
  'ciity of oroquieta': 'City of Oroquieta',
  'city of ozamis': 'City of Ozamiz',
}

const LOCALITY_CODE_OVERRIDES: Record<string, string> = {
  '1705300000:rizal': '1705323000',
  '1900700000:isabela': '0990101000',
  '1903600000:tagoloan': '1903638000',
}

const findLocality = (
  sourceName: string,
  region: PsgcNode,
  province: PsgcNode | undefined,
  indexes: ReturnType<typeof buildPsgcIndexes>,
) => {
  const cleaned = normalizeSourcePlace(sourceName)
  const overrideCode = province
    ? LOCALITY_CODE_OVERRIDES[`${province.code}:${normalizeName(cleaned)}`]
    : undefined

  if (overrideCode) return indexes.byCode.get(overrideCode)

  const alias = LOCALITY_ALIASES[cleaned.toLowerCase()] ?? cleaned
  const key = normalizeName(alias)
  let candidates = indexes.localities.filter(locality =>
    normalizeName(locality.name) === key ||
    locality.nicknames.some(nickname => normalizeName(nickname) === key))

  candidates = candidates.filter(locality =>
    indexes.getRegionCode(locality) === region.code)

  if (province) {
    const withinProvince = candidates.filter(locality =>
      locality.parentCode === province.code)

    if (withinProvince.length === 1) return withinProvince[0]
    return candidates.length === 1 ? candidates[0] : undefined
  }

  return candidates.length === 1 ? candidates[0] : undefined
}

const convertWorkbookToCsv = (temporaryDirectory: string) => {
  const binary = process.env.LIBREOFFICE_BIN ?? 'libreoffice'
  execFileSync(binary, [
    '--headless',
    '--convert-to',
    'csv',
    '--outdir',
    temporaryDirectory,
    legislativeSourcePath,
  ], { stdio: 'pipe' })

  const csvPath = resolve(
    temporaryDirectory,
    'LIST-CITIES-MUN-LEGDIST-2025.csv',
  )

  if (!existsSync(csvPath)) {
    throw new Error('LibreOffice did not produce the expected legislative district CSV.')
  }

  return csvPath
}

const normalizeLegislativeDistricts = (
  csvPath: string,
  psgcNodes: PsgcNode[],
) => {
  const indexes = buildPsgcIndexes(psgcNodes)
  const rows = readFileSync(csvPath, 'utf8')
    .replace(/\r?\n$/, '')
    .split(/\r?\n/)
    .map((line, index) => ({
      sourceRow: index + 1,
      fields: parseCsvLine(line).map(compactWhitespace),
    }))
  const issues: ValidationIssue[] = []
  const districts: WorkingDistrict[] = []
  const crosswalk = new Map<string, {
    sourceName: string
    sourceProvince?: string
    sourceRegion: string
    psgcCode: string
    psgcName: string
    geographicLevel: PsgcType
  }>()
  let currentRegion: PsgcNode | undefined
  let currentProvince: PsgcNode | undefined
  let currentDistrict: WorkingDistrict | undefined
  let pendingJurisdiction: PsgcNode | undefined
  let ignoredNonLegislativeRows = 0

  const addMembership = (
    district: WorkingDistrict,
    sourceName: string,
    sourceRow: number,
  ) => {
    const locality = findLocality(
      sourceName,
      district.region,
      district.province,
      indexes,
    )

    if (!locality) {
      issues.push({
        severity: 'error',
        code: 'UNMATCHED_LOCALITY',
        message: 'City or municipality could not be matched to one PSGC locality.',
        sourceRow,
        sourceValue: sourceName,
        context: {
          region: district.region.name,
          province: district.province?.name,
          district: district.sourceLabel,
        },
      })
      return
    }

    if (!district.memberships.some(item => item.node.code === locality.code)) {
      district.memberships.push({ sourceRow, sourceName, node: locality })
    }

    const crosswalkKey = [
      district.region.code,
      district.province?.code ?? '',
      normalizeName(sourceName),
    ].join(':')

    crosswalk.set(crosswalkKey, {
      sourceName: normalizeSourcePlace(sourceName),
      sourceProvince: district.province?.name,
      sourceRegion: district.region.name,
      psgcCode: locality.code,
      psgcName: locality.name,
      geographicLevel: locality.type,
    })
  }

  const createDistrict = (
    sourceLabel: string,
    sourceRow: number,
    explicitJurisdiction = pendingJurisdiction,
  ) => {
    if (!currentRegion) {
      issues.push({
        severity: 'error',
        code: 'DISTRICT_WITHOUT_REGION',
        message: 'Legislative district appeared before a recognized region.',
        sourceRow,
        sourceValue: sourceLabel,
      })
      return undefined
    }

    const district: WorkingDistrict = {
      sourceLabel,
      sourceRows: [sourceRow],
      region: currentRegion,
      province: currentProvince,
      explicitJurisdiction,
      memberships: [],
    }
    districts.push(district)
    currentDistrict = district
    return district
  }

  for (let index = 0; index < rows.length; index += 1) {
    const { sourceRow, fields } = rows[index]
    const first = fields[0] ?? ''
    const second = fields[1] ?? ''
    if (!first && !second) continue

    const regionCode = REGION_CODES[normalizeRegionHeading(first)]
    if (regionCode) {
      currentRegion = indexes.byCode.get(regionCode)
      currentProvince = undefined
      currentDistrict = undefined
      pendingJurisdiction = undefined

      if (!currentRegion) {
        issues.push({
          severity: 'error',
          code: 'MISSING_REFERENCE_REGION',
          message: 'Expected region is absent from the PSGC reference.',
          sourceRow,
          sourceValue: first,
        })
      }
      continue
    }

    if (!currentRegion) continue

    if (!first && second && isUppercaseHeading(second) &&
      !/DISTRICT/i.test(second)) {
      const province = findProvince(second, currentRegion, indexes)
      if (!province) {
        issues.push({
          severity: 'error',
          code: 'UNMATCHED_PROVINCE',
          message: 'Province heading could not be matched to PSGC.',
          sourceRow,
          sourceValue: second,
          context: { region: currentRegion.name },
        })
      }
      currentProvince = province
      if (province && province.parentCode !== currentRegion.code) {
        const referenceRegion = indexes.byCode.get(province.parentCode)
        issues.push({
          severity: 'warning',
          code: 'SOURCE_REGION_DIFFERS_FROM_PSGC',
          message: 'Workbook region placement differs from the July 2025 PSGC reference; the PSGC region is used.',
          sourceRow,
          sourceValue: second,
          context: {
            sourceRegion: currentRegion.name,
            psgcRegion: referenceRegion?.name,
          },
        })
        currentRegion = referenceRegion ?? currentRegion
      }
      currentDistrict = undefined
      pendingJurisdiction = undefined
      continue
    }

    if (currentRegion.code === '1300000000' && first && !/^\d+$/.test(first)) {
      if (/^City of Taguig \(1st Councilor District\) - Pateros/i.test(first)) {
        const taguig = findLocality('City of Taguig', currentRegion, undefined, indexes)
        const pateros = findLocality('Pateros', currentRegion, undefined, indexes)
        pendingJurisdiction = undefined
        const district = createDistrict(
          'Lone Legislative District of Pateros and Taguig (1st Councilor District)',
          sourceRow,
          undefined,
        )
        if (district && taguig && pateros) {
          district.jurisdictionKey = 'taguig-pateros'
          district.jurisdictionName = 'Pateros and Taguig'
          district.memberships.push(
            { sourceRow, sourceName: 'City of Taguig', node: taguig },
            { sourceRow, sourceName: 'Pateros', node: pateros },
          )
        }
        continue
      }

      if (/^City of Taguig \(2nd Councilor District\)/i.test(first)) {
        const taguig = findLocality('City of Taguig', currentRegion, undefined, indexes)
        const district = createDistrict(
          'Lone Legislative District of Taguig (2nd Councilor District)',
          sourceRow,
          taguig,
        )
        if (district && taguig) {
          district.memberships.push({
            sourceRow,
            sourceName: 'City of Taguig',
            node: taguig,
          })
        }
        continue
      }

      if (first === 'City of Taguig' || first === 'Pateros') {
        continue
      }

      const countMatch = first.match(/\((\d+)\s*LD\)/i)
      if (countMatch) {
        const locality = findLocality(first, currentRegion, undefined, indexes)
        if (!locality) {
          issues.push({
            severity: 'error',
            code: 'UNMATCHED_NCR_JURISDICTION',
            message: 'NCR city heading could not be matched to PSGC.',
            sourceRow,
            sourceValue: first,
          })
          pendingJurisdiction = undefined
          continue
        }

        const districtCount = Number(countMatch[1])
        pendingJurisdiction = locality
        currentProvince = undefined
        currentDistrict = undefined

        if (districtCount === 1) {
          const district = createDistrict(
            'Lone Legislative District',
            sourceRow,
            locality,
          )
          if (district) {
            district.memberships.push({ sourceRow, sourceName: first, node: locality })
          }
        }
        continue
      }
    }

    if (!first && isDistrictSummary(second)) {
      currentDistrict = undefined
      continue
    }

    if (!first && isLegislativeDistrict(second)) {
      const district = createDistrict(second, sourceRow)
      if (district?.explicitJurisdiction) {
        district.memberships.push({
          sourceRow,
          sourceName: district.explicitJurisdiction.name,
          node: district.explicitJurisdiction,
        })
      }
      continue
    }

    if (!first && isNonLegislativeDistrict(second)) {
      ignoredNonLegislativeRows += 1
      continue
    }

    const sourceLocality = /^\d+$/.test(first) ? second : (!first ? second : '')
    if (!sourceLocality) continue

    const nextMeaningful = rows.slice(index + 1).find(row =>
      (row.fields[0] ?? '') || (row.fields[1] ?? ''))
    const nextSecond = nextMeaningful?.fields[1] ?? ''
    const locality = findLocality(
      sourceLocality,
      currentRegion,
      currentProvince,
      indexes,
    )

    if (!currentDistrict && !/^\d+$/.test(first) && locality &&
      isLegislativeDistrict(nextSecond)) {
      pendingJurisdiction = locality
      currentDistrict = undefined
      continue
    }

    if (!currentDistrict) {
      issues.push({
        severity: 'error',
        code: 'LOCALITY_WITHOUT_DISTRICT',
        message: 'Locality appeared without an active legislative district.',
        sourceRow,
        sourceValue: sourceLocality,
        context: {
          region: currentRegion.name,
          province: currentProvince?.name,
        },
      })
      continue
    }

    if (!/^\d+$/.test(first) && locality &&
      currentDistrict.memberships.length === 0) {
      currentDistrict.explicitJurisdiction = locality
    }

    addMembership(currentDistrict, sourceLocality, sourceRow)
  }

  for (const district of districts) {
    for (const membership of district.memberships) {
      const crosswalkKey = [
        district.region.code,
        district.province?.code ?? '',
        normalizeName(membership.sourceName),
      ].join(':')

      if (!crosswalk.has(crosswalkKey)) {
        crosswalk.set(crosswalkKey, {
          sourceName: normalizeSourcePlace(membership.sourceName),
          sourceProvince: district.province?.name,
          sourceRegion: district.region.name,
          psgcCode: membership.node.code,
          psgcName: membership.node.name,
          geographicLevel: membership.node.type,
        })
      }
    }
  }

  const membershipCounts = new Map<string, number>()
  for (const district of districts) {
    for (const membership of district.memberships) {
      membershipCounts.set(
        membership.node.code,
        (membershipCounts.get(membership.node.code) ?? 0) + 1,
      )
    }
  }

  const normalizedDistricts = districts.map(district => {
    const jurisdiction = district.explicitJurisdiction ?? district.province
    const jurisdictionCode = district.jurisdictionKey ??
      jurisdiction?.code ?? district.region.code
    const id = `ld-2025-${jurisdictionCode}-${districtOrdinal(district.sourceLabel)}`
    const memberships = district.memberships.map(membership => ({
      localityCode: membership.node.code,
      localityName: membership.node.name,
      localityType: membership.node.type,
      coverage: (membershipCounts.get(membership.node.code) ?? 0) > 1
        ? 'partial'
        : 'whole',
      sourceRow: membership.sourceRow,
      sourceName: normalizeSourcePlace(membership.sourceName),
    }))
    const label = district.jurisdictionName
      ? `${district.jurisdictionName} — ${district.sourceLabel}`
      : jurisdiction
      ? `${jurisdiction.name} — ${district.sourceLabel}`
      : district.sourceLabel

    if (memberships.length === 0) {
      issues.push({
        severity: 'error',
        code: 'DISTRICT_WITHOUT_MEMBERSHIPS',
        message: 'Legislative district has no resolved city or municipality membership.',
        sourceRow: district.sourceRows[0],
        sourceValue: label,
      })
    }

    if (memberships.some(membership => membership.coverage === 'partial')) {
      issues.push({
        severity: 'warning',
        code: 'PARTIAL_LOCALITY_BOUNDARY',
        message: 'District divides a city; the source does not provide barangay boundaries.',
        sourceRow: district.sourceRows[0],
        sourceValue: label,
      })
    }

    return {
      id,
      electionYear: 2025,
      electionDate: '2025-05-12',
      label,
      sourceLabel: district.sourceLabel,
      region: {
        code: district.region.code,
        name: district.region.name,
      },
      jurisdiction: district.jurisdictionName ? {
        code: null,
        name: district.jurisdictionName,
        type: 'multi-locality',
      } : jurisdiction ? {
          code: jurisdiction.code,
          name: jurisdiction.name,
          type: jurisdiction.type,
        } : null,
      status: memberships.some(membership => membership.coverage === 'partial')
        ? 'partial-boundary'
        : 'locality-resolved',
      memberships,
      sourceRows: district.sourceRows,
    }
  })

  const duplicateIds = normalizedDistricts
    .map(district => district.id)
    .filter((id, index, all) => all.indexOf(id) !== index)

  for (const id of new Set(duplicateIds)) {
    issues.push({
      severity: 'error',
      code: 'DUPLICATE_DISTRICT_ID',
      message: 'Generated legislative district ID is not unique.',
      sourceValue: id,
    })
  }

  return {
    dataset: {
      metadata: {
        datasetId: 'comelec-legislative-districts-2025',
        electionYear: 2025,
        electionDate: '2025-05-12',
        geographicScope: 'Philippines',
        sourceFile: 'LIST-CITIES-MUN-LEGDIST-2025.xls',
        sourceSha256: sha256(legislativeSourcePath),
        psgcReferenceDate: '2025-07-08',
        notes: [
          'Councilor and provincial-board districts are excluded.',
          'A partial membership means the city spans multiple legislative districts and barangay boundaries are not present in the source workbook.',
        ],
      },
      data: normalizedDistricts,
    },
    crosswalk: {
      metadata: {
        electionYear: 2025,
        psgcReferenceDate: '2025-07-08',
      },
      data: [...crosswalk.values()].sort((left, right) =>
        left.sourceRegion.localeCompare(right.sourceRegion) ||
        (left.sourceProvince ?? '').localeCompare(right.sourceProvince ?? '') ||
        left.sourceName.localeCompare(right.sourceName)),
    },
    validation: {
      metadata: {
        datasetId: 'comelec-legislative-districts-2025',
        sourceFile: 'LIST-CITIES-MUN-LEGDIST-2025.xls',
      },
      summary: {
        sourceRows: rows.length,
        legislativeDistricts: normalizedDistricts.length,
        resolvedMemberships: normalizedDistricts.reduce(
          (total, district) => total + district.memberships.length,
          0,
        ),
        uniqueMatchedLocalities: new Set(
          normalizedDistricts.flatMap(district =>
            district.memberships.map(membership => membership.localityCode)),
        ).size,
        ignoredNonLegislativeDistrictRows: ignoredNonLegislativeRows,
        errors: issues.filter(issue => issue.severity === 'error').length,
        warnings: issues.filter(issue => issue.severity === 'warning').length,
      },
      issues,
    },
  }
}

const extractPdfLines = (bboxPath: string): PdfLine[] => {
  const xml = readFileSync(bboxPath, 'utf8')
  const pages = [...xml.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g)]
  const lines: PdfLine[] = []

  pages.forEach((pageMatch, pageIndex) => {
    const pageContent = pageMatch[1]

    for (const lineMatch of pageContent.matchAll(
      /<line\s+([^>]+)>([\s\S]*?)<\/line>/g,
    )) {
      const attributes = Object.fromEntries(
        [...lineMatch[1].matchAll(/(\w+)="([^"]+)"/g)]
          .map(match => [match[1], match[2]]),
      )
      const words = [...lineMatch[2].matchAll(
        /<word\b[^>]*>([\s\S]*?)<\/word>/g,
      )].map(match => decodeXml(match[1]))

      lines.push({
        page: pageIndex + 1,
        xMin: Number(attributes.xMin),
        xMax: Number(attributes.xMax),
        yMin: Number(attributes.yMin),
        text: compactWhitespace(words.join(' ')),
      })
    }
  })

  return lines
}

const normalizePartyLists = (bboxPath: string) => {
  const lines = extractPdfLines(bboxPath)
  const issues: ValidationIssue[] = []
  const records: Array<{
    id: string
    electionYear: number
    electionDate: string
    rank: number
    officialName: string
    acronym: string | null
    totalVotes: number
    geographicScope: 'national'
    nominees: Array<{ order: number, officialName: string }>
    sourcePage: number
  }> = []

  for (const page of new Set(lines.map(line => line.page))) {
    const pageLines = lines.filter(line => line.page === page)
    const anchors = pageLines
      .filter(line => line.xMin < 32 && /^(?:[1-9]|[1-5]\d|57)\b/.test(line.text))
      .map(line => ({
        ...line,
        rank: Number(line.text.match(/^\d+/)?.[0]),
      }))
      .filter(anchor => anchor.rank >= 1 && anchor.rank <= 57)
      .sort((left, right) => left.yMin - right.yMin)

    anchors.forEach((anchor, anchorIndex) => {
      const previous = anchors[anchorIndex - 1]
      const next = anchors[anchorIndex + 1]
      const lowerBound = previous
        ? (previous.yMin + anchor.yMin) / 2
        : anchor.yMin - 25
      const upperBound = next
        ? (anchor.yMin + next.yMin) / 2
        : anchor.yMin + 25
      const withinRow = (line: PdfLine) =>
        line.yMin >= lowerBound && line.yMin < upperBound
      const organizationLines = pageLines
        .filter(line => withinRow(line) && line.xMin < 330 && line.xMax < 335)
        .sort((left, right) => left.yMin - right.yMin)
        .map(line => line.text.replace(
          new RegExp(`^${anchor.rank}(?:\\s+|$)`),
          '',
        ))
        .filter(Boolean)
      const officialName = compactWhitespace(organizationLines.join(' '))
      const voteLine = pageLines.find(line =>
        withinRow(line) && line.xMin >= 330 && line.xMax < 410 &&
        /^\d{1,3}(?:,\d{3})+$/.test(line.text))
      const nomineeLines = pageLines
        .filter(line => withinRow(line) && line.xMin >= 405)
        .sort((left, right) => left.yMin - right.yMin)
      const acronymMatches = [...officialName.matchAll(/\(([^()]+)\)/g)]
      const acronym = acronymMatches.at(-1)?.[1] ?? null

      if (!officialName) {
        issues.push({
          severity: 'error',
          code: 'MISSING_PARTY_LIST_NAME',
          message: 'Party-list row has no extracted organization name.',
          context: { page, rank: anchor.rank },
        })
      }

      if (!voteLine) {
        issues.push({
          severity: 'error',
          code: 'MISSING_PARTY_LIST_VOTES',
          message: 'Party-list row has no extracted vote total.',
          sourceValue: officialName,
          context: { page, rank: anchor.rank },
        })
      }

      if (nomineeLines.length === 0) {
        issues.push({
          severity: 'error',
          code: 'MISSING_PARTY_LIST_NOMINEE',
          message: 'Party-list row has no extracted proclaimed nominee.',
          sourceValue: officialName,
          context: { page, rank: anchor.rank },
        })
      }

      records.push({
        id: `party-list-2025-${String(anchor.rank).padStart(2, '0')}-${slugify(acronym ?? officialName)}`,
        electionYear: 2025,
        electionDate: '2025-05-12',
        rank: anchor.rank,
        officialName,
        acronym,
        totalVotes: Number(voteLine?.text.replace(/,/g, '') ?? 0),
        geographicScope: 'national',
        nominees: nomineeLines.map((line, index) => ({
          order: index + 1,
          officialName: line.text,
        })),
        sourcePage: page,
      })
    })
  }

  records.sort((left, right) => left.rank - right.rank)
  const expectedRanks = Array.from({ length: 57 }, (_value, index) => index + 1)
  const actualRanks = records.map(record => record.rank)

  if (JSON.stringify(actualRanks) !== JSON.stringify(expectedRanks)) {
    issues.push({
      severity: 'error',
      code: 'PARTY_LIST_RANK_SEQUENCE',
      message: 'Extracted party-list ranks are not the complete sequence from 1 through 57.',
    })
  }

  const duplicateNames = records
    .map(record => normalizeName(record.officialName))
    .filter((name, index, all) => all.indexOf(name) !== index)

  if (duplicateNames.length > 0) {
    issues.push({
      severity: 'error',
      code: 'DUPLICATE_PARTY_LIST_NAME',
      message: 'Extracted party-list organization names are not unique.',
    })
  }

  issues.push({
    severity: 'warning',
    code: 'NATIONAL_TOTALS_ONLY',
    message: 'The source PDF contains national vote totals only and cannot support geographic party-list filtering.',
  })
  issues.push({
    severity: 'warning',
    code: 'SEAT_COUNT_NOT_INFERRED',
    message: 'Seat counts are intentionally not inferred from the number of printed nominees.',
  })

  return {
    dataset: {
      metadata: {
        datasetId: 'comelec-proclaimed-party-lists-2025',
        electionYear: 2025,
        electionDate: '2025-05-12',
        geographicScope: 'national',
        sourceFile: '2025 ELECTED PARTY LIST.pdf',
        sourceSha256: sha256(partyListSourcePath),
        notes: [
          'Official organization and nominee spelling is preserved from the source PDF.',
          'Seat counts are not inferred from nominee counts.',
        ],
      },
      data: records,
    },
    validation: {
      metadata: {
        datasetId: 'comelec-proclaimed-party-lists-2025',
        sourceFile: '2025 ELECTED PARTY LIST.pdf',
      },
      summary: {
        pages: new Set(lines.map(line => line.page)).size,
        organizations: records.length,
        nominees: records.reduce(
          (total, record) => total + record.nominees.length,
          0,
        ),
        errors: issues.filter(issue => issue.severity === 'error').length,
        warnings: issues.filter(issue => issue.severity === 'warning').length,
      },
      issues,
    },
  }
}

const main = () => {
  const temporaryDirectory = mkdtempSync(
    resolve(tmpdir(), 'votes-pulse-election-import-'),
  )

  try {
    mkdirSync(normalizedDirectory, { recursive: true })
    mkdirSync(validationDirectory, { recursive: true })
    const psgcNodes = loadPsgcReference()
    const csvPath = convertWorkbookToCsv(temporaryDirectory)
    const legislative = normalizeLegislativeDistricts(csvPath, psgcNodes)
    const bboxPath = resolve(temporaryDirectory, 'party-list-bbox.html')

    execFileSync(
      process.env.PDFTOTEXT_BIN ?? 'pdftotext',
      ['-bbox-layout', partyListSourcePath, bboxPath],
      { stdio: 'pipe' },
    )
    const partyLists = normalizePartyLists(bboxPath)

    writeJson(
      resolve(normalizedDirectory, 'legislative-districts-2025.json'),
      legislative.dataset,
    )
    writeJson(
      resolve(normalizedDirectory, 'party-lists-2025.json'),
      partyLists.dataset,
    )
    writeJson(
      resolve(validationDirectory, 'legislative-district-psgc-crosswalk.json'),
      legislative.crosswalk,
    )
    writeJson(
      resolve(validationDirectory, 'legislative-district-exceptions.json'),
      legislative.validation,
    )
    writeJson(
      resolve(validationDirectory, 'party-list-exceptions.json'),
      partyLists.validation,
    )

    const errorCount =
      legislative.validation.summary.errors +
      partyLists.validation.summary.errors

    console.log(JSON.stringify({
      legislativeDistricts: legislative.validation.summary,
      partyLists: partyLists.validation.summary,
      outputDirectory: normalizedDirectory,
    }, null, 2))

    if (errorCount > 0) {
      process.exitCode = 1
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

main()
