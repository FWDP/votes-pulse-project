import 'dotenv/config'
import express from 'express'
import { fetchDromic, fetchGdelt, fetchPsgc, type ConnectorResult } from './connectors.js'
import { getCitiesMunicipalities, getCongressionalDistricts, getProvinces, getRegions } from './geography.js'

const app = express()
const port = Number(process.env.PORT || 8787)
const cacheMs = Number(process.env.SOURCE_CACHE_MINUTES || 15) * 60_000
let cache: { expires: number; results: ConnectorResult[] } | null = null
let pending: Promise<ConnectorResult[]> | null = null

async function refresh() {
  if (pending) return pending
  pending = Promise.all([fetchPsgc(), fetchDromic(), fetchGdelt()]).finally(() => { pending = null })
  const results = await pending
  cache = { expires: Date.now() + cacheMs, results }
  return results
}

app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'votes-pulse-sources', now: new Date().toISOString() }))
app.get('/api/sources', async (request, response) => {
  const force = request.query.refresh === 'true'
  const results = !force && cache && cache.expires > Date.now() ? cache.results : await refresh()
  response.json({ cached: !force && Boolean(cache), cacheExpiresAt: cache ? new Date(cache.expires).toISOString() : null, sources: results })
})
app.get('/api/signals', async (_request, response) => {
  const results = cache && cache.expires > Date.now() ? cache.results : await refresh()
  response.json({ items: results.flatMap(result => result.items), generatedAt: new Date().toISOString() })
})
app.get('/api/geography/regions', async (_request, response) => response.json(await getRegions()))
app.get('/api/geography/provinces', async (request, response) => {
  const regionCode = String(request.query.regionCode || '')
  if (!regionCode) return response.status(400).json({ error: 'regionCode is required' })
  try { return response.json(await getProvinces(regionCode)) }
  catch (error) { return response.status(502).json({ error: error instanceof Error ? error.message : 'Unable to retrieve provinces' }) }
})
app.get('/api/geography/cities-municipalities', async (request, response) => {
  const regionCode = String(request.query.regionCode || '')
  const provinceCode = request.query.provinceCode ? String(request.query.provinceCode) : undefined
  if (!regionCode) return response.status(400).json({ error: 'regionCode is required' })
  try { return response.json(await getCitiesMunicipalities(regionCode, provinceCode)) }
  catch (error) { return response.status(502).json({ error: error instanceof Error ? error.message : 'Unable to retrieve cities and municipalities' }) }
})
app.get('/api/geography/congressional-districts', async (_request, response) => {
  try { return response.json(await getCongressionalDistricts()) }
  catch (error) { return response.status(502).json({ error: error instanceof Error ? error.message : 'Unable to retrieve congressional districts', source: 'House of Representatives · 20th Congress' }) }
})

app.listen(port, '127.0.0.1', () => console.log(`PULSE source service listening on http://127.0.0.1:${port}`))
