export interface MobileSessionUser {
    id: string
    displayName: string
    email: string
    coverageLabel: string
    coverageCode?: string
    regionCode?: string
    regionName?: string
    provinceCode?: string
    provinceName?: string
    localityName?: string
    localityType?: 'city' | 'municipality'
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
