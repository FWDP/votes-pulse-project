import React from 'react'
import { Stacked, GeographyControls, topics } from './shared'
import { ArrowLeft, ArrowRight, TrendingUp } from 'lucide-react'

function KPICard({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <div className="text-xs text-slate-500 uppercase font-semibold">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-800">{value}</div>
    </div>
  )
}

function OverviewContent({ candidate }: { candidate: boolean }) {
  return (
    <>
      <div className="demo-kpis">
        {[[candidate ? '11,100' : '284,512', 'Mentions analyzed'], [candidate ? '37' : '18', candidate ? 'Cities covered' : 'Regions covered'], [candidate ? '18 mo.' : '47 mo.', 'Coverage period'], [candidate ? '27' : '6', candidate ? 'Tracked topics' : 'Data sources']].map(([value, label]) => (
          <article key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>
              <TrendingUp size={12} /> Updated from configured sources
            </small>
          </article>
        ))}
      </div>
      <div className="demo-two-col">
        <section>
          <h3>Overall sentiment distribution</h3>
          <div className="demo-donut">
            <strong>{candidate ? '28%' : '26%'}</strong>
            <span>positive</span>
          </div>
          <div className="demo-legend">
            <span>Positive {candidate ? 28 : 26}%</span>
            <span>Neutral {candidate ? 32 : 46}%</span>
            <span>Negative {candidate ? 40 : 28}%</span>
          </div>
        </section>
        <section>
          <h3>Top issues by volume</h3>
          {topics.slice(0, 5).map(([label, value]) => (
            <div className="demo-bar-row" key={label}>
              <span>{label}</span>
              <i style={{ width: `${Number(value)}%` }} />
              <em>{Number(value) * 312}</em>
            </div>
          ))}
        </section>
      </div>
      <div className="demo-three-col">
        {['Luzon', 'Visayas', 'Mindanao'].map((area, index) => (
          <section key={area}>
            <h3>{area}</h3>
            <Stacked positive={32 + index * 3} neutral={38 - index} negative={30 - index * 2} />
            <small>High confidence · multiple source groups</small>
          </section>
        ))}
      </div>
    </>
  )
}

export default function OverviewPage() {
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">Overview</h1>
            <div className="text-sm text-slate-500">{candidate ? 'Candidate workspace · Ramon de la Cruz' : 'National Pulse'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">Data as of March 2026</div>
          <button className="bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-xs">Simulation — Placeholder Data</button>
        </div>
      </header>

      <section>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <KPICard value={candidate ? '11,100' : '11,973'} label="Data Points" />
          <KPICard value={candidate ? '37' : '15'} label="LGUs Covered" />
          <KPICard value={candidate ? '18 mo.' : '47 mo.'} label="Coverage Period" />
          <KPICard value={candidate ? '27' : '5'} label="Data Sources" />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Overall Sentiment Distribution</h3>
          <div className="flex items-center gap-6">
            <div className="w-48 h-48 rounded-full bg-slate-50 flex items-center justify-center">
              <div className="text-2xl font-black">26%</div>
              <div className="text-xs text-slate-400">Positive</div>
            </div>
            <div className="flex-1">
              <div className="text-sm text-slate-500 mb-3">All topics, all locations, full period</div>
              <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                <div className="text-center"><div className="text-green-600 font-bold">26%</div><div className="text-slate-400">Positive</div></div>
                <div className="text-center"><div className="text-slate-600 font-bold">46%</div><div className="text-slate-400">Neutral</div></div>
                <div className="text-center"><div className="text-red-600 font-bold">28%</div><div className="text-slate-400">Negative</div></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Top Issues by Mention Volume</h3>
          <div className="space-y-3">
            {topics.slice(0, 8).map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between">
                <div className="text-sm text-slate-700">{label}</div>
                <div className="w-2/5 ml-4 bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div style={{ width: `${Math.min(100, Number(value))}%` }} className="bg-blue-600 h-3 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Area Comparison</h3>
          <div className="space-y-4">
            {['Northern Area', 'Central Area'].map((area, idx) => (
              <div key={area} className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-2"><div className="font-semibold">{area}</div><div className="text-sm text-slate-500">{idx === 0 ? '4 municipalities' : '4 municipalities'}</div></div>
                <Stacked positive={32 + idx * 3} neutral={38 - idx} negative={30 - idx * 2} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Data Sources Breakdown</h3>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex justify-between"><span>Facebook (public groups/pages)</span><span>6,642 (54.8%)</span></div>
            <div className="flex justify-between"><span>Regional & National News</span><span>2,460 (20.3%)</span></div>
            <div className="flex justify-between"><span>X / Twitter (public)</span><span>1,575 (13%)</span></div>
          </div>
        </div>
      </section>
    </div>
  )
}
