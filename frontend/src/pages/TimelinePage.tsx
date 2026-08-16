import React from 'react'
import PageShell from '../components/PageShell'

export default function TimelinePage() {
  const events = ['National budget deliberations', 'Typhoon recovery response', 'Transport fare adjustment', 'Public health announcement', 'Regional wage consultations', 'Education funding release', 'Flood-control investigation']
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'

  return (
    <PageShell title="Timeline" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : 'National Pulse'}>
      <div className="space-y-4">
        <div className="flex justify-end"><select aria-label="Date range"><option>Last 30 days</option><option>Last 90 days</option><option>Election period</option></select></div>
        {/* <GeographyControls /> */}

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Key event timeline</h3>
          <div className="event-list">
            {events.map((event, index) => (
              <article key={event}>
                <time>Jul {28 - index * 3}</time>
                <i className={index % 3 === 0 ? 'negative' : index % 3 === 1 ? 'positive' : 'neutral'} />
                <strong>{event}</strong>
                <span>{1200 + index * 683} mentions</span>
                <em>{index % 2 ? '+' : '-'}{4 + index}%</em>
              </article>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Weekly mention volume</h3>
          <div className="line-chart">
            <svg viewBox="0 0 800 180" preserveAspectRatio="none">
              <path d="M0 125 C55 160 70 45 110 105 S180 120 220 92 S285 145 335 108 S405 40 445 104 S520 142 565 88 S635 25 680 98 S750 126 800 72" />
              <path className="line-fill" d="M0 125 C55 160 70 45 110 105 S180 120 220 92 S285 145 335 108 S405 40 445 104 S520 142 565 88 S635 25 680 98 S750 126 800 72 L800 180 L0 180Z" />
            </svg>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
