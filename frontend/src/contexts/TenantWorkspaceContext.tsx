import React, { createContext, useContext, useMemo } from 'react'
import { useLocation } from 'react-router-dom'

const TenantWorkspaceContext = createContext<any>(null)

export function TenantWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const tenant = useMemo(() => ({ id: 'tenant-local', slug: 'local', name: 'Local Tenant' }), [])
  const workspace = useMemo(() => ({
    id: 'workspace-local',
    slug: 'local',
    name: 'Local Workspace',
    product: location.pathname.startsWith('/votes') ? 'votes' : 'pulse',
    enabledFeatures: [
      'overview',
      'sentiment',
      'issues',
      'location',
      'timeline',
      'historical',
      'insights',
      'datascope',
      'fieldreports',
    ],
  }), [location.pathname])
  const basePath = `/${workspace.product}`

  const value = { tenant, workspace, basePath }
  return <TenantWorkspaceContext.Provider value={value}>{children}</TenantWorkspaceContext.Provider>
}

export const useTenantWorkspace = () => {
  const ctx = useContext(TenantWorkspaceContext)
  if (!ctx) throw new Error('useTenantWorkspace must be used within TenantWorkspaceProvider')
  return ctx
}

export default TenantWorkspaceContext
