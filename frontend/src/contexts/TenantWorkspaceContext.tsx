import React, { createContext, useContext, useMemo } from 'react'

const TenantWorkspaceContext = createContext<any>(null)

export function TenantWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const tenant = useMemo(() => ({ id: 'tenant-local', slug: 'local', name: 'Local Tenant' }), [])
  const workspace = useMemo(() => ({
    id: 'workspace-local',
    slug: 'local',
    name: 'Local Workspace',
    product: 'votes',
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
  }), [])
  const basePath = '/votes'

  const value = { tenant, workspace, basePath }
  return <TenantWorkspaceContext.Provider value={value}>{children}</TenantWorkspaceContext.Provider>
}

export const useTenantWorkspace = () => {
  const ctx = useContext(TenantWorkspaceContext)
  if (!ctx) throw new Error('useTenantWorkspace must be used within TenantWorkspaceProvider')
  return ctx
}

export default TenantWorkspaceContext
