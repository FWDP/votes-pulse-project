import { isApiConfigured, requestJson } from './apiClient'
import type { MobileSession } from '@/types/session'

interface SignInInput {
    email: string
    password: string
}

const createPrototypeSession = (email: string): MobileSession => ({
    token: 'prototype-mobile-session',
    mode: 'prototype',
    user: {
        id: 'mobile-field-reporter-local',
        displayName: email.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Field Reporter',
        email,
        coverageLabel: 'Assigned field coverage',
        role: 'field-reporter',
    },
})

export async function signIn(input: SignInInput): Promise<MobileSession> {
    if (!input.email.trim() || !input.password) {
        throw new Error('Enter both email and password.')
    }

    if (!isApiConfigured) return createPrototypeSession(input.email.trim())

    return requestJson<MobileSession>('/api/mobile/session', {
        method: 'POST',
        body: JSON.stringify(input),
    })
}
