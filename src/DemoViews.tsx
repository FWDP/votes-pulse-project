import { useEffect, useState } from 'react'
import { CalendarDays, Database, FileText, MapPin, ShieldCheck, TrendingUp } from 'lucide-react'

export type DemoView = 'Overview' | 'Sentiment Analysis' | 'Key Issues & Topics' | 'Location View' | 'Timeline' | 'Historical Context' | 'Data & Scope' | 'Field Reports'
type GeographyUnit = { code: string; name: string; provinceCode?: string }
type District = { id: string; name: string }

const topics = [
  ['Food prices & inflation', 86, 'negative'], ['Jobs and livelihood', 72, 'positive'],
  ['Flood control projects', 68, 'negative'], ['Healthcare access', 59, 'neutral'],
  ['Education quality', 52, 'positive'], ['Transport and traffic', 47, 'negative'],
]
const regional = [
  ['NCR', 31, 35, 34, '58.4k'], ['CAR', 38, 39, 23, '8.7k'],
  ['Ilocos Region', 34, 36, 30, '17.2k'], ['Cagayan Valley', 40, 37, 23, '11.8k'],
  ['Central Luzon', 28, 33, 39, '29.1k'], ['CALABARZON', 26, 31, 43, '41.6k'],
]

function Stacked({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  return <div className="demo-stacked"><i className="demo-positive" style={{ width: `${positive}%` }}/><i className="demo-neutral" style={{ width: `${neutral}%` }}/><i className="demo-negative" style={{ width: `${negative}%` }}/></div>
}

function GeographyControls() {
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

function Overview({ candidate }: { candidate: boolean }) {
  return <>
    <div className="demo-kpis">
      {[[candidate ? '11,100' : '284,512', 'Mentions analyzed'], [candidate ? '37' : '18', candidate ? 'Cities covered' : 'Regions covered'], [candidate ? '18 mo.' : '47 mo.', 'Coverage period'], [candidate ? '27' : '6', candidate ? 'Tracked topics' : 'Data sources']].map(([value, label]) => <article key={label}><span>{label}</span><strong>{value}</strong><small><TrendingUp size={12}/> Updated from configured sources</small></article>)}
    </div>
    {candidate && <section className="demo-comparison"><h3>Candidate comparison</h3><div><article><strong>Alana Santos</strong><Stacked positive={42} neutral={36} negative={22}/><small>42% positive sentiment</small></article><article><strong>Ramon de la Cruz</strong><Stacked positive={28} neutral={32} negative={40}/><small>40% negative sentiment</small></article></div></section>}
    <div className="demo-two-col">
      <section><h3>Overall sentiment distribution</h3><div className="demo-donut"><strong>{candidate ? '28%' : '26%'}</strong><span>positive</span></div><div className="demo-legend"><span>Positive {candidate ? 28 : 26}%</span><span>Neutral {candidate ? 32 : 46}%</span><span>Negative {candidate ? 40 : 28}%</span></div></section>
      <section><h3>Top issues by volume</h3>{topics.slice(0, 5).map(([label, value], index) => <div className="demo-bar-row" key={label}><span>{label}</span><i style={{ width: `${Number(value)}%` }}/><em>{Number(value) * 312}</em></div>)}</section>
    </div>
    <div className="demo-three-col">{['Luzon', 'Visayas', 'Mindanao'].map((area, index) => <section key={area}><h3>{area}</h3><Stacked positive={32 + index * 3} neutral={38 - index} negative={30 - index * 2}/><small>High confidence · multiple source groups</small></section>)}</div>
  </>
}

function Sentiment({ candidate }: { candidate: boolean }) {
  return <>
    <div className="demo-sentiment-kpis"><article><strong>{candidate ? 28 : 26}%</strong><span>Positive sentiment</span></article><article><strong>{candidate ? 32 : 46}%</strong><span>Neutral sentiment</span></article><article><strong>{candidate ? 40 : 28}%</strong><span>Negative sentiment</span></article></div>
    <section><h3>Sentiment by topic</h3>{topics.map(([label, value], index) => <div className="demo-topic" key={label}><strong>{label}</strong><Stacked positive={Math.max(12, 42 - index * 4)} neutral={Number(value) % 31 + 25} negative={Math.min(58, 28 + index * 5)}/></div>)}</section>
    <div className="demo-two-col"><section><h3>Positive vs negative radar</h3><div className="demo-radar"><i/><i/><i/><span>Trust</span><span>Economy</span><span>Services</span><span>Leadership</span></div></section><section><h3>Sentiment drivers</h3>{topics.slice(0, 6).map(([label], index) => <div className="demo-driver" key={label}><i className={index < 3 ? 'positive' : 'negative'}/><span>{label}</span><strong>{index < 3 ? '+' : '-'}{18 - index * 2}%</strong></div>)}</section></div>
  </>
}

function Issues() {
  return <section><h3>Key issues & topics</h3><div className="demo-table demo-issues-table"><div><b>#</b><b>Topic</b><b>Volume</b><b>Sentiment</b><b>Momentum</b></div>{topics.concat([['Government transparency', 43, 'neutral'], ['Agriculture support', 39, 'positive']]).map(([label, value, tone], index) => <div key={label}><span>{index + 1}</span><strong>{label}</strong><span>{Number(value) * 337}</span><span><Stacked positive={tone === 'positive' ? 52 : 24} neutral={31} negative={tone === 'negative' ? 45 : 17}/></span><em className={index % 3 === 0 ? 'rise' : 'fall'}>{index % 3 === 0 ? '↑' : '↓'} {4 + index}%</em></div>)}</div></section>
}

function Location() {
  return <>
    <div className="demo-two-col location-layout"><section><h3>Overall mentions · selected geography</h3><div className="philippines-map" aria-label="Stylized map of the Philippines"><i/><i/><i/><i/><i/><i/></div></section><section><h3>Regional distribution</h3>{regional.map(([name, p, n, x, mentions]) => <div className="demo-region-row" key={name}><strong>{name}</strong><Stacked positive={Number(p)} neutral={Number(n)} negative={Number(x)}/><span>{mentions}</span></div>)}</section></div>
    <div className="demo-three-col">{['Northern Area', 'Central Area', 'Southern Area'].map((area, index) => <section key={area}><MapPin size={16}/><h3>{area}</h3><strong>{[92400, 113700, 78400][index].toLocaleString()}</strong><Stacked positive={35 + index * 2} neutral={37} negative={28 - index * 2}/><small>Leading issue: {topics[index][0]}</small></section>)}</div>
  </>
}

function Timeline() {
  const events = ['National budget deliberations', 'Typhoon recovery response', 'Transport fare adjustment', 'Public health announcement', 'Regional wage consultations', 'Education funding release', 'Flood-control investigation']
  return <><section><h3>Key event timeline</h3><div className="event-list">{events.map((event, index) => <article key={event}><time>Jul {28 - index * 3}</time><i className={index % 3 === 0 ? 'negative' : index % 3 === 1 ? 'positive' : 'neutral'}/><strong>{event}</strong><span>{1200 + index * 683} mentions</span><em>{index % 2 ? '+' : '-'}{4 + index}%</em></article>)}</div></section><section><h3>Weekly mention volume</h3><div className="line-chart"><svg viewBox="0 0 800 180" preserveAspectRatio="none"><path d="M0 125 C55 160 70 45 110 105 S180 120 220 92 S285 145 335 108 S405 40 445 104 S520 142 565 88 S635 25 680 98 S750 126 800 72"/><path className="line-fill" d="M0 125 C55 160 70 45 110 105 S180 120 220 92 S285 145 335 108 S405 40 445 104 S520 142 565 88 S635 25 680 98 S750 126 800 72 L800 180 L0 180Z"/></svg></div></section></>
}

function Historical() {
  return <><div className="history-banner"><CalendarDays/><div><h3>2025 National & Local Elections</h3><p>Historical election results provide context only and are never presented as current voting intention.</p></div><strong>81.2% turnout</strong></div><div className="demo-two-col"><section><h3>2025 Governor race</h3><div className="history-donut one"/><div className="candidate-legend"><span>Candidate A · 44.8%</span><span>Candidate B · 33.2%</span><span>Others · 22.0%</span></div></section><section><h3>2025 Major city mayor</h3><div className="history-donut two"/><div className="candidate-legend"><span>Candidate C · 51.4%</span><span>Candidate D · 31.8%</span><span>Others · 16.8%</span></div></section></div><section><h3>Election-period issue priorities</h3>{topics.slice(0, 5).map(([label, value]) => <div className="history-priority" key={label}><span>{label}</span><i style={{width:`${value}%`}}/><strong>{value}%</strong></div>)}</section></>
}

function DataScope() {
  const [sources, setSources] = useState<Array<{ sourceId: string; sourceName: string; status: string; itemCount: number; message: string }>>([])
  const [loading, setLoading] = useState(true)
  const load = (refresh = false) => { setLoading(true); fetch(`/api/sources${refresh ? '?refresh=true' : ''}`).then(response => response.json()).then(payload => setSources(payload.sources || [])).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])
  return <><div className="scope-summary"><section><Database/><h3>Dataset scope</h3><p>Philippines · national, regional, provincial, city and municipality levels</p><dl><dt>Period</dt><dd>2022–present</dd><dt>PSGC version</dt><dd>Q2 2026</dd><dt>Refresh</dt><dd>15-minute source cache</dd></dl></section><section><ShieldCheck/><h3>Methodology</h3><p>Source-normalized signals with geography, provenance and confidence metadata.</p><dl><dt>Opinion figures</dt><dd>Demonstration</dd><dt>Public reports</dt><dd>Live where healthy</dd><dt>District model</dt><dd>Separately versioned</dd></dl></section></div><section><div className="section-title-action"><h3>Live sources & coverage notes</h3><button onClick={() => load(true)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh sources'}</button></div>{sources.length ? sources.map(source => <div className="source-row" key={source.sourceId}><i className={source.status}/><strong>{source.sourceName}</strong><span>{source.message}</span><em>{source.status} · {source.itemCount} records</em></div>) : <p>{loading ? 'Contacting source connectors…' : 'No connector status available.'}</p>}<div className="source-row"><i/><strong>House of Representatives</strong><span>20th Congress district reference</span><em>Official authority</em></div></section><div className="limitations"><strong>Data limitations and responsible use</strong><ul><li>Illustrative sentiment values are not public-opinion polling.</li><li>Source volume is not representative of the voting population.</li><li>Administrative boundaries and congressional districts have different effective dates.</li><li>Every published metric should retain its source, sample and uncertainty.</li></ul></div></>
}

function FieldReports() {
  const [reports, setReports] = useState(topics.slice(0, 5).map(([label], index) => ({ title: String(label), location: String(regional[index % regional.length][0]), status: index % 2 ? 'Reviewed' : 'Pending' })))
  const [saved, setSaved] = useState(false)
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') || '').trim()
    const location = String(data.get('location') || '').trim()
    if (!title || !location) return
    setReports(current => [{ title, location, status: 'Pending' }, ...current])
    setSaved(true)
    event.currentTarget.reset()
  }
  return <><div className="field-banner"><FileText/><div><h3>Field reports & survey instrument</h3><p>Structured qualitative reports linked to location, date, topic and consent-safe aggregate observations.</p></div></div><div className="demo-kpis">{[[String(reports.length),'Field reports'],['2','Regions'],['1','Active survey'],[String(reports.filter(report => report.status === 'Pending').length),'Pending review']].map(([v,l])=><article key={l}><strong>{v}</strong><span>{l}</span></article>)}</div><div className="demo-two-col"><section><h3>Submit field report</h3><form onSubmit={submit}><label className="field-input"><span>Report title</span><input name="title" required placeholder="Enter report title"/></label><label className="field-input"><span>Location</span><input name="location" required placeholder="Enter location"/></label><label className="field-input"><span>Category</span><select name="category"><option>Community concern</option><option>Public service</option><option>Disaster response</option></select></label><label className="field-input"><span>Observation</span><textarea name="observation" required placeholder="Enter aggregate observation"/></label><button className="demo-primary" type="submit">Save report</button>{saved && <span className="saved-state">Report saved for review.</span>}</form></section><section><h3>Latest reports</h3>{reports.map((report,index)=><article className="report-item" key={`${report.title}-${index}`}><div><strong>{report.title}</strong><span>{report.location} · Aug {3-Math.min(index,2)}, 2026</span></div><em>{report.status}</em></article>)}</section></div></>
}

export function DemoModule({ view, workspace }: { view: DemoView; workspace: 'national' | 'candidate' }) {
  const candidate = workspace === 'candidate'
  return <div className="demo-module"><div className="demo-page-head"><div><h1>{view}</h1><p>{candidate ? 'Candidate workspace · Ramon de la Cruz' : 'National Pulse'} · demonstration analytics with transparent source status</p></div><div><select aria-label="Date range"><option>Last 30 days</option><option>Last 90 days</option><option>Election period</option></select></div></div><GeographyControls/>{view === 'Overview' && <Overview candidate={candidate}/>} {view === 'Sentiment Analysis' && <Sentiment candidate={candidate}/>} {view === 'Key Issues & Topics' && <Issues/>} {view === 'Location View' && <Location/>} {view === 'Timeline' && <Timeline/>} {view === 'Historical Context' && <Historical/>} {view === 'Data & Scope' && <DataScope/>} {view === 'Field Reports' && <FieldReports/>}</div>
}
