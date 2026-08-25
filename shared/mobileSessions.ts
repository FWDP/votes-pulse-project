export interface MobileSessionUser {
    id: string
    displayName: string
    email: string
    coverageLabel: string
    coverageCode?: string
    role: 'field-reporter' | 'field-coordinator' | 'superadmin'
    tenantId: string
    workspaceId: string
}

export interface MobileSession {
    token: string
    expiresAt: string
    user: MobileSessionUser
    mode: 'prototype' | 'connected'
}
