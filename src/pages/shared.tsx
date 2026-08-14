import React, { useEffect, useState } from 'react'

export type GeographyUnit = { code: string; name: string; provinceCode?: string }
export type District = { id: string; name: string }

export const topics: Array<[string, number, 'positive' | 'neutral' | 'negative']> = [
  ['Food prices & inflation', 86, 'negative'], ['Jobs and livelihood', 72, 'positive'],
  ['Flood control projects', 68, 'negative'], ['Healthcare access', 59, 'neutral'],
  ['Education quality', 52, 'positive'], ['Transport and traffic', 47, 'negative'],
]
export const regional = [
  ['NCR', 31, 35, 34, '58.4k'], ['CAR', 38, 39, 23, '8.7k'],
  ['Ilocos Region', 34, 36, 30, '17.2k'], ['Cagayan Valley', 40, 37, 23, '11.8k'],
  ['Central Luzon', 28, 33, 39, '29.1k'], ['CALABARZON', 26, 31, 43, '41.6k'],
]

export function Stacked({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  return <div className="demo-stacked"><i className="demo-positive" style={{ width: `${positive}%` }} /><i className="demo-neutral" style={{ width: `${neutral}%` }} /><i className="demo-negative" style={{ width: `${negative}%` }} /></div>
}

export function GeographyControls() {
  const [scope, setScope] = useState<'national' | 'provincial' | 'congressional'>('national')
  const [regions, setRegions] = useState<GeographyUnit[]>([])
  const [provinces, setProvinces] = useState<GeographyUnit[]>([])
  const [localities, setLocalities] = useState<GeographyUnit[]>([])
  const [region, setRegion] = useState('')
  const [province, setProvince] = useState('')
  const [loading, setLoading] = useState(false)
  const [districts, setDistricts] = useState<District[]>([])
  const [districtError, setDistrictError] = useState('')
  useEffect(() => { fetch('/api/geography/regions').then(response => response.json()).then(payload => setRegions(payload.units || [])).catch(() => setRegions([])) }, [])
  useEffect(() => {
    setProvince(''); setLocalities([])
    if (!region) { setProvinces([]); return }
    setLoading(true)
    Promise.all([
      fetch(`/api/geography/provinces?regionCode=${encodeURIComponent(region)}`).then(response => response.ok ? response.json() : { units: [] }),
      fetch(`/api/geography/cities-municipalities?regionCode=${encodeURIComponent(region)}`).then(response => response.ok ? response.json() : { units: [] }),
    ]).then(([provincePayload, localityPayload]) => { setProvinces(provincePayload.units || []); setLocalities(localityPayload.units || []) }).finally(() => setLoading(false))
  }, [region])
  useEffect(() => {
    if (scope !== 'congressional' || districts.length) return
    setLoading(true); setDistrictError('')
    fetch('/api/geography/congressional-districts').then(async response => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'District service unavailable')
      setDistricts(payload.districts || [])
    }).catch(error => setDistrictError(error instanceof Error ? error.message : 'District service unavailable')).finally(() => setLoading(false))
  }, [scope, districts.length])
  const shownLocalities = province ? localities.filter(item => item.provinceCode === province) : localities
  return <div className="geography-controls"><div className="geo-scope"><button className={scope === 'national' ? 'selected' : ''} onClick={() => setScope('national')}>National</button><button className={scope === 'provincial' ? 'selected' : ''} onClick={() => setScope('provincial')}>Provincial / Party-list</button><button className={scope === 'congressional' ? 'selected' : ''} onClick={() => setScope('congressional')}>City & Municipality / Congressional</button></div>{scope === 'provincial' ? <><select value={region} onChange={event => setRegion(event.target.value)} aria-label="Region"><option value="">All 18 regions</option>{regions.map(item => <option value={item.code} key={item.code}>{item.name}</option>)}</select><select value={province} onChange={event => setProvince(event.target.value)} disabled={!region} aria-label="Province"><option value="">All provinces</option>{provinces.map(item => <option value={item.code} key={item.code}>{item.name}</option>)}</select><select disabled={!region || loading} aria-label="City or municipality"><option>{loading ? 'Loading localities…' : 'All cities & municipalities'}</option>{shownLocalities.map(item => <option value={item.code} key={item.code}>{item.name}</option>)}</select></> : scope === 'congressional' ? <div className="district-picker"><select disabled={loading || Boolean(districtError)} aria-label="Congressional district"><option>{loading ? 'Loading 20th Congress districts…' : districtError || 'All congressional districts'}</option>{districts.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select><small>Official House of Representatives roster · separately versioned from PSGC</small></div> : <p className="geo-national-note">Showing national aggregate · select Provincial or Congressional mode to filter by location.</p>}</div>
}
