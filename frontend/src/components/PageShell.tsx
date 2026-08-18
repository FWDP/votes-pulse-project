import React from 'react'
import { useAuth, hasCoverageLock } from '../contexts/AuthContext'

export default function PageShell({
  title,
  subtitle,
  children,
  dataMode = 'placeholder',
}: {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  dataMode?: 'placeholder' | 'coverage-only'
}) {
  const { user } = useAuth()

  const coverageLocked = hasCoverageLock(user)

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
            {coverageLocked && (
              <div className="mt-1 text-xs text-rose-700 font-semibold" role="status" aria-live="polite">Coverage locked to assigned area</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {dataMode === 'placeholder' ? (
            <>
              <div className="text-xs text-slate-500">Data as of March 2026</div>
              <span className="bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-xs">Simulation — Placeholder Data</span>
            </>
          ) : (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              Official PSGC coverage · Sentiment pending
            </span>
          )}
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
