import * as cheerio from 'cheerio'

export type NormalizedItem = {
  id: string
  sourceId: string
  title: string
  url: string
  publishedAt?: string
  geography: string[]
  kind: string
}

export type ConnectorResult = {
  sourceId: string
  sourceName: string
  status: 'healthy' | 'degraded' | 'configuration-required'
  fetchedAt: string
  itemCount: number
  items: NormalizedItem[]
  message: string
}

const userAgent = process.env.SOURCE_USER_AGENT || 'votes-pulse/0.1 (public-interest prototype)'

async function getText(url: string, timeoutMs = 15_000) {
  const response = await fetch(url, {
    headers: { 'user-agent': userAgent, accept: 'text/html,application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

const slugId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100)

export async function fetchDromic(): Promise<ConnectorResult> {
  const fetchedAt = new Date().toISOString()
  try {
    const html = await getText('https://dromic.dswd.gov.ph/category/situation-reports/')
    const $ = cheerio.load(html)
    const items: NormalizedItem[] = []
    $('h2.post-title a').slice(0, 20).each((_, element) => {
      const anchor = $(element)
      const title = anchor.text().replace(/\s+/g, ' ').trim()
      const url = anchor.attr('href') || ''
      const article = anchor.closest('article, .post')
      const publishedAt = article.find('.published').first().text().trim() || undefined
      if (title && url) items.push({ id: `dromic-${slugId(url)}`, sourceId: 'dswd-dromic', title, url, publishedAt, geography: [], kind: title.toLowerCase().includes('fire') ? 'fire' : title.toLowerCase().includes('flood') ? 'flood' : 'situation-report' })
    })
    return { sourceId: 'dswd-dromic', sourceName: 'DSWD DROMIC', status: items.length ? 'healthy' : 'degraded', fetchedAt, itemCount: items.length, items, message: items.length ? 'Public situation-report index parsed successfully.' : 'The page responded but no report cards matched the parser.' }
  } catch (error) {
    return { sourceId: 'dswd-dromic', sourceName: 'DSWD DROMIC', status: 'degraded', fetchedAt, itemCount: 0, items: [], message: error instanceof Error ? error.message : 'Unknown connector error' }
  }
}

export async function fetchGdelt(): Promise<ConnectorResult> {
  const fetchedAt = new Date().toISOString()
  const endpoint = new URL('https://api.gdeltproject.org/api/v2/doc/doc')
  endpoint.searchParams.set('query', 'Philippines politics')
  endpoint.searchParams.set('mode', 'ArtList')
  endpoint.searchParams.set('maxrecords', '20')
  endpoint.searchParams.set('format', 'json')
  try {
    const body = await getText(endpoint.toString())
    const data = JSON.parse(body) as { articles?: Array<{ url: string; title: string; seendate?: string; sourcecountry?: string }> }
    const items = (data.articles || []).map(article => ({ id: `gdelt-${slugId(article.url)}`, sourceId: 'gdelt', title: article.title, url: article.url, publishedAt: article.seendate, geography: article.sourcecountry ? [article.sourcecountry] : [], kind: 'news-signal' }))
    return { sourceId: 'gdelt', sourceName: 'GDELT', status: 'healthy', fetchedAt, itemCount: items.length, items, message: 'News discovery results retrieved through the public API.' }
  } catch (error) {
    return { sourceId: 'gdelt', sourceName: 'GDELT', status: 'degraded', fetchedAt, itemCount: 0, items: [], message: `${error instanceof Error ? error.message : 'Unknown error'}. The connector will respect GDELT rate limits and retry after the cache window.` }
  }
}

export async function fetchPsgc(): Promise<ConnectorResult> {
  const fetchedAt = new Date().toISOString()
  const token = process.env.PSA_PSGC_TOKEN
  if (!token) return { sourceId: 'psa-psgc', sourceName: 'PSA PSGC', status: 'configuration-required', fetchedAt, itemCount: 0, items: [], message: 'Set PSA_PSGC_TOKEN in .env to activate the official geographic connector.' }
  try {
    const version = 'Q2_2024'
    const body = await getText(`https://classification.psa.gov.ph/psgc/${version}/regions?token=${encodeURIComponent(token)}`)
    const data = JSON.parse(body) as Array<Record<string, unknown>>
    const items = data.map((row, index) => {
      const title = String(row.name || row.NAME || row.geographic_level_name || `Region ${index + 1}`)
      return { id: `psgc-${String(row.code || row.PSGC_CODE || index)}`, sourceId: 'psa-psgc', title, url: 'https://psa.gov.ph/classification/psgc', geography: [String(row.code || row.PSGC_CODE || '')], kind: 'region' }
    })
    return { sourceId: 'psa-psgc', sourceName: 'PSA PSGC', status: 'healthy', fetchedAt, itemCount: items.length, items, message: `Official ${version} region data retrieved.` }
  } catch (error) {
    return { sourceId: 'psa-psgc', sourceName: 'PSA PSGC', status: 'degraded', fetchedAt, itemCount: 0, items: [], message: error instanceof Error ? error.message : 'Unknown connector error' }
  }
}
