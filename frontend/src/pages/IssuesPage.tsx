import React from 'react'
import PageShell from '../components/PageShell'

export default function IssuesPage() {
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'

  return (
    <PageShell title="Key Issues & Topics" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : 'National Pulse'}>
      <div className="space-y-4">
        <div className="flex justify-end"><select aria-label="Date range"><option>Last 30 days</option><option>Last 90 days</option><option>Election period</option></select></div>
        {/* <GeographyControls /> */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Key issues & topics</h3>
          <div className="demo-table demo-issues-table">
            <div><b>#</b><b>Topic</b><b>Volume</b><b>Sentiment</b><b>Momentum</b></div>

          </div>
        </div>
      </div>
    </PageShell>
  )
}
