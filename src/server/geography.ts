import * as cheerio from 'cheerio'

export type GeographyLevel = 'region' | 'province' | 'city-municipality'

export type GeographyUnit = {
  code: string
  name: string
  level: GeographyLevel
  regionCode?: string
  provinceCode?: string
  isCity?: boolean
  isMunicipality?: boolean
}

export type ElectoralDistrict = { id: string; name: string; congress: string; sourceUrl: string }

const mirrorBase = 'https://psgc.gitlab.io/api'
const snapshot = 'PSA PSGC Q2 2026 target · community mirror with NIR supplement'
const fallbackRegions: GeographyUnit[] = [
  ['010000000', 'Ilocos Region'], ['020000000', 'Cagayan Valley'],
  ['030000000', 'Central Luzon'], ['040000000', 'CALABARZON'],
  ['170000000', 'MIMAROPA Region'], ['050000000', 'Bicol Region'],
  ['060000000', 'Western Visayas'], ['180000000', 'Negros Island Region'],
  ['070000000', 'Central Visayas'], ['080000000', 'Eastern Visayas'],
  ['090000000', 'Zamboanga Peninsula'], ['100000000', 'Northern Mindanao'],
  ['110000000', 'Davao Region'], ['120000000', 'SOCCSKSARGEN'],
  ['130000000', 'National Capital Region'], ['140000000', 'Cordillera Administrative Region'],
  ['160000000', 'Caraga'], ['150000000', 'BARMM'],
].map(([code, name]) => ({ code, name, level: 'region' as const }))

type MirrorUnit = {
  code: string
  name: string
  regionCode?: string
  provinceCode?: string | false
  isCity?: boolean
  isMunicipality?: boolean
}

const cache = new Map<string, { expires: number; items: GeographyUnit[] }>()
let districtCache: { expires: number; districts: ElectoralDistrict[] } | null = null

async function mirror(path: string, level: GeographyLevel) {
  const cached = cache.get(path)
  if (cached && cached.expires > Date.now()) return cached.items
  const response = await fetch(`${mirrorBase}${path}`, {
    headers: { accept: 'application/json', 'user-agent': 'votes-pulse/0.2 (PSGC geography cache)' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Geography mirror returned HTTP ${response.status}`)
  const body = await response.json() as MirrorUnit[]
  const items = body.map(item => ({
    code: item.code,
    name: item.name,
    level,
    regionCode: item.regionCode,
    provinceCode: typeof item.provinceCode === 'string' ? item.provinceCode : undefined,
    isCity: item.isCity,
    isMunicipality: item.isMunicipality,
  }))
  cache.set(path, { expires: Date.now() + 24 * 60 * 60_000, items })
  return items
}

export async function getRegions() {
  try {
    const units = await mirror('/regions/', 'region')
    const byCode = new Map(units.map(unit => [unit.code, unit]))
    for (const region of fallbackRegions) if (!byCode.has(region.code)) byCode.set(region.code, region)
    return { units: [...byCode.values()], status: 'live' as const, snapshot }
  } catch (error) {
    return { units: fallbackRegions, status: 'fallback' as const, snapshot, message: error instanceof Error ? error.message : 'Geography service unavailable' }
  }
}

export async function getProvinces(regionCode: string) {
  return { units: await mirror(`/regions/${encodeURIComponent(regionCode)}/provinces/`, 'province'), status: 'live' as const, snapshot }
}

export async function getCitiesMunicipalities(regionCode: string, provinceCode?: string) {
  const units = await mirror(`/regions/${encodeURIComponent(regionCode)}/cities-municipalities/`, 'city-municipality')
  return { units: provinceCode ? units.filter(unit => unit.provinceCode === provinceCode) : units, status: 'live' as const, snapshot }
}

export async function getCongressionalDistricts() {
  if (districtCache && districtCache.expires > Date.now()) return { districts: districtCache.districts, status: 'live' as const, congress: '20th Congress' }
  const officialSourceUrl = 'https://www.congress.gov.ph/house-members'
  const referenceUrl = 'https://en.wikipedia.org/wiki/Congressional_districts_of_the_Philippines'
  let names: string[] = []
  try {
    const response = await fetch(officialSourceUrl, { headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 votes-pulse/0.2' }, signal: AbortSignal.timeout(20_000) })
    if (response.ok) {
      const text = (await response.text()).replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ')
      names = [...text.matchAll(/District Representative\s+([A-Z][A-Za-zÀ-ÿ .'-]+?,\s*(?:\d+(?:st|nd|rd|th)|Lone) District)/g)].map(match => match[1].trim())
    }
  } catch { /* The House site may reject automated access; use the public reference index below. */ }
  let sourceUrl = officialSourceUrl
  let sourceStatus = 'official-live'
  if (!names.length) {
    const response = await fetch(referenceUrl, { headers: { accept: 'text/html', 'user-agent': 'votes-pulse/0.2 (public district index)' }, signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error(`District reference returned HTTP ${response.status}`)
    const $ = cheerio.load(await response.text())
    $('.wikitable a[href*="congressional_district"]').each((_, element) => {
      const title = $(element).attr('title') || $(element).text()
      if (/congressional district/i.test(title) && !/former|historical|defunct/i.test(title)) names.push(title.replace(/ congressional district.*$/i, ' congressional district').trim())
    })
    sourceUrl = referenceUrl
    sourceStatus = 'secondary-index; validate against House and COMELEC 2025 publications'
  }
  const districts = [...new Set(names)].sort().map(name => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, congress: '20th Congress', sourceUrl }))
  if (!districts.length) throw new Error('No congressional district labels were available from configured references')
  districtCache = { expires: Date.now() + 24 * 60 * 60_000, districts }
  return { districts, status: sourceStatus, congress: '20th Congress', authoritativeSources: [officialSourceUrl, 'https://www.comelec.gov.ph/php-tpls-attachments/2025NLE/Statistics/12202024_NoOfElectivePositions2025NLE.pdf'], retrievedFrom: sourceUrl }
}
