import React, { useEffect, useState } from 'react'
import { getApiUrl } from '../../utils/getApiUrl'

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const res = await fetch(getApiUrl('/api/admin/sessions'))
        if (!res.ok) throw new Error(`API returned ${res.status}`)
        const payload = await res.json()
        if (mounted) setSessions(payload)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="p-6">
      <h2 className="text-lg font-bold">Active Sessions</h2>
      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      {!error && !sessions && <div className="mt-3 text-sm text-slate-500">Loading…</div>}
      {sessions && (
        <ul className="mt-3 space-y-2">
          {sessions.map((s: any) => (
            <li key={s.token} className="rounded border p-3">
              <div className="text-sm font-semibold">{s.user?.displayName ?? s.user?.email}</div>
              <div className="text-xs text-slate-500">Issued: {s.created_at}</div>
              <div className="text-xs text-slate-500">Expires: {s.expires_at}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
