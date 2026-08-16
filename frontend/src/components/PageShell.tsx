import React from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function PageShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  const location = useLocation()
  const search = location.search || ''
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">Data as of March 2026</div>
          <button className="bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-xs">Simulation — Placeholder Data</button>
        </div>
      </header>

      <main className="flex-1 overflow-auto mt-0">
        <div className="p-4 sm:p-6 sm:space-y-6 fade-in">
          {children}
        </div>
      </main>
    </div>
  )
}
