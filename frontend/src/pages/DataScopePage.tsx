import React, { useEffect, useState } from 'react'
import { Database, ShieldCheck } from 'lucide-react'
import { GeographyControls } from './shared'
import PageShell from '../components/PageShell'

export default function DataScopePage() {
  const [sources, setSources] = useState<Array<{ sourceId: string; sourceName: string; status: string; itemCount: number; message: string }>>([])
  const [loading, setLoading] = useState(true)
  const load = (refresh = false) => { setLoading(true); fetch(`/api/sources${refresh ? '?refresh=true' : ''}`).then(response => response.json()).then(payload => setSources(payload.sources || [])).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'

  return (
    <PageShell title="Data & Scope" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : 'National Pulse'}>
      <div className="space-y-4">
        <div className="flex justify-end"><select aria-label="Date range"><option>Last 30 days</option><option>Last 90 days</option><option>Election period</option></select></div>
        <GeographyControls />

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="scope-summary">
            <section>
              <Database />
              <h3>Dataset scope</h3>
              <p>Philippines · national, regional, provincial, city and municipality levels</p>
              <dl>
                <dt>Period</dt>
                <dd>2022–present</dd>
                <dt>PSGC version</dt>
                <dd>Q2 2026</dd>
                <dt>Refresh</dt>
                <dd>15-minute source cache</dd>
              </dl>
            </section>
            <section>
              <ShieldCheck />
              <h3>Methodology</h3>
              <p>Source-normalized signals with geography, provenance and confidence metadata.</p>
              <dl>
                <dt>Opinion figures</dt>
                <dd>Demonstration</dd>
                <dt>Public reports</dt>
                <dd>Live where healthy</dd>
                <dt>District model</dt>
                <dd>Separately versioned</dd>
              </dl>
            </section>
          </div>

          <div className="mt-6">
            <div className="section-title-action">
              <h3>Live sources & coverage notes</h3>
              <button onClick={() => load(true)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh sources'}</button>
            </div>
            {sources.length ? sources.map(source => (
              <div className="source-row" key={source.sourceId}><i className={source.status} /><strong>{source.sourceName}</strong><span>{source.message}</span><em>{source.status} · {source.itemCount} records</em></div>
            )) : <p>{loading ? 'Contacting source connectors…' : 'No connector status available.'}</p>}
            <div className="source-row"><i /><strong>House of Representatives</strong><span>20th Congress district reference</span><em>Official authority</em></div>
          </div>

          <div className="limitations mt-6">
            <strong>Data limitations and responsible use</strong>
            <ul>
              <li>Illustrative sentiment values are not public-opinion polling.</li>
              <li>Source volume is not representative of the voting population.</li>
              <li>Administrative boundaries and congressional districts have different effective dates.</li>
              <li>Every published metric should retain its source, sample and uncertainty.</li>
            </ul>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
