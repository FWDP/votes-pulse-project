import React, { useEffect, useState } from 'react'
import { getApiUrl } from '../../utils/getApiUrl'

export default function ExportsPage() {
  const [exportsList, setExportsList] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const res = await fetch(getApiUrl('/api/admin/exports'))
        if (!res.ok) throw new Error(`API returned ${res.status}`)
        const payload = await res.json()
        if (mounted) setExportsList(payload)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="p-6">
      <h2 className="text-lg font-bold">Exports</h2>
      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      {!error && !exportsList && <div className="mt-3 text-sm text-slate-500">Loading…</div>}
      {exportsList && (
        <ul className="mt-3 space-y-2">
          {exportsList.map((e: any) => (
            <li key={e.id} className="rounded border p-3">
              <div className="text-sm font-semibold">{e.file_name ?? `Export ${e.id}`}</div>
              <div className="text-xs text-slate-500">Status: {e.status}</div>
              <div className="text-xs text-slate-500">Requested: {e.created_at}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
