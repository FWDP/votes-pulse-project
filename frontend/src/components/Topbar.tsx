import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTenantWorkspace } from '../contexts/TenantWorkspaceContext'
import AdminControls from './AdminControls'

export default function Topbar() {
  const { user, testUsers, switchUser } = useAuth()
  const { tenant, workspace } = useTenantWorkspace()

  return (
    <header className="topbar bg-slate-800 text-white flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="text-sm font-semibold">{tenant?.name}</div>
        <div className="text-xs text-slate-300">{workspace?.name}</div>
      </div>
      <div className="flex items-center gap-3">
        <AdminControls />
        <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-300">
          <span>Test user</span>
          <select
            value={user?.id ?? testUsers[0].id}
            onChange={(event) => switchUser(event.target.value)}
            className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white outline-none focus:border-sky-400"
          >
            {testUsers.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs text-slate-300">{user?.displayName}</div>
      </div>
    </header>
  )
}
