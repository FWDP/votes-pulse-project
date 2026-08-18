import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTenantWorkspace } from '../contexts/TenantWorkspaceContext'
import { useNavigate } from 'react-router-dom'

export default function WorkspaceSelector() {
  const { accessibleWorkspaces } = useAuth()
  const { basePath } = useTenantWorkspace()
  const navigate = useNavigate()

  if (!accessibleWorkspaces || accessibleWorkspaces.length <= 1) return null

  return (
    <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      Workspace
      <select
        value={basePath}
        onChange={event => navigate(`${event.target.value}/overview`)}
        className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-slate-800 px-2 text-xs font-medium normal-case tracking-normal text-white outline-none focus:border-blue-400"
      >
        {accessibleWorkspaces.map(item => {
          const path = `/${item.workspace.product ?? item.workspace.slug}`
          return <option key={item.workspace.id} value={path}>{item.workspace.name}</option>
        })}
      </select>
    </label>
  )
}
