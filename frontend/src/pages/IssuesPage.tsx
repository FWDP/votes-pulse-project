import React from 'react'
import { topics, Stacked, GeographyControls } from './shared'
import PageShell from '../components/PageShell'

export default function IssuesPage() {
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'

  return (
    <PageShell title="Key Issues & Topics" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : 'National Pulse'}>
      <div className="space-y-4">
        <div className="flex justify-end"><select aria-label="Date range"><option>Last 30 days</option><option>Last 90 days</option><option>Election period</option></select></div>
        <GeographyControls />
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Key issues & topics</h3>
          <div className="demo-table demo-issues-table">
            <div><b>#</b><b>Topic</b><b>Volume</b><b>Sentiment</b><b>Momentum</b></div>
            {topics.concat([['Government transparency', 43, 'neutral'], ['Agriculture support', 39, 'positive']]).map(([label, value, tone], index) => (
              <div key={label}>
                <span>{index + 1}</span>
                <strong>{label}</strong>
                <span>{Number(value) * 337}</span>
                <span><Stacked positive={tone === 'positive' ? 52 : 24} neutral={31} negative={tone === 'negative' ? 45 : 17} /></span>
                <em className={index % 3 === 0 ? 'rise' : 'fall'}>{index % 3 === 0 ? '↑' : '↓'} {4 + index}%</em>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
