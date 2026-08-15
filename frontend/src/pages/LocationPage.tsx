import React from 'react'
import { Stacked, regional, topics, GeographyControls } from './shared'
import { MapPin } from 'lucide-react'
import PageShell from '../components/PageShell'

export default function LocationPage() {
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'

  return (
    <PageShell title="Location View" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : 'National Pulse'}>
      <div className="space-y-4">
        <div className="flex justify-end"><select aria-label="Date range"><option>Last 30 days</option><option>Last 90 days</option><option>Election period</option></select></div>
        <GeographyControls />

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="demo-two-col location-layout">
            <section>
              <h3>Overall mentions · selected geography</h3>
              <div className="philippines-map" aria-label="Stylized map of the Philippines"><i /><i /><i /><i /><i /><i /></div>
            </section>
            <section>
              <h3>Regional distribution</h3>
              {regional.map(([name, p, n, x, mentions]) => (
                <div className="demo-region-row" key={name}>
                  <strong>{name}</strong>
                  <Stacked positive={Number(p)} neutral={Number(n)} negative={Number(x)} />
                  <span>{mentions}</span>
                </div>
              ))}
            </section>
          </div>
        </div>

        <div className="demo-three-col">
          {['Northern Area', 'Central Area', 'Southern Area'].map((area, index) => (
            <section key={area} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <MapPin size={16} />
              <h3>{area}</h3>
              <strong>{[92400, 113700, 78400][index].toLocaleString()}</strong>
              <Stacked positive={35 + index * 2} neutral={37} negative={28 - index * 2} />
              <small>Leading issue: {topics[index][0]}</small>
            </section>
          ))}
        </div>
      </div>
    </PageShell>
  )
}
