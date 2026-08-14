import React from 'react'
import { topics } from './shared'
import { CalendarDays } from 'lucide-react'
import { GeographyControls } from './shared'
import PageShell from '../components/PageShell'

export default function HistoricalPage() {
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'

  return (
    <PageShell title="Historical Context" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : 'National Pulse'}>
      <div className="space-y-4">
        <div className="flex justify-end"><select aria-label="Date range"><option>Last 30 days</option><option>Last 90 days</option><option>Election period</option></select></div>
        <GeographyControls />

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="history-banner">
            <CalendarDays />
            <div>
              <h3>2025 National & Local Elections</h3>
              <p>Historical election results provide context only and are never presented as current voting intention.</p>
            </div>
            <strong>81.2% turnout</strong>
          </div>

          <div className="demo-two-col mt-6">
            <section>
              <h3>2025 Governor race</h3>
              <div className="history-donut one" />
              <div className="candidate-legend"><span>Candidate A · 44.8%</span><span>Candidate B · 33.2%</span><span>Others · 22.0%</span></div>
            </section>
            <section>
              <h3>2025 Major city mayor</h3>
              <div className="history-donut two" />
              <div className="candidate-legend"><span>Candidate C · 51.4%</span><span>Candidate D · 31.8%</span><span>Others · 16.8%</span></div>
            </section>
          </div>

          <section className="mt-6">
            <h3>Election-period issue priorities</h3>
            {topics.slice(0, 5).map(([label, value]) => (
              <div className="history-priority" key={label}><span>{label}</span><i style={{ width: `${value}%` }} /><strong>{value}%</strong></div>
            ))}
          </section>
        </div>
      </div>
    </PageShell>
  )
}
