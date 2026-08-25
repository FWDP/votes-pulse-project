export interface MobileSessionUser {
    id: string
    displayName: string
    email: string
    coverageLabel: string
    coverageCode?: string
    role: 'field-reporter' | 'field-coordinator' | 'superadmin'
}

export interface MobileSession {
    token: string
    user: MobileSessionUser
    mode: 'prototype' | 'connected'
}
