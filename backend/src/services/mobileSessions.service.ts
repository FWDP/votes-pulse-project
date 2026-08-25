import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'

import type { MobileSession, MobileSessionUser } from '../../../shared/mobileSessions'
import { dbEnabled, query } from '../db'

type StoredSession = MobileSession & { expiresAt: string }

const sessions = (() => {
    const root = globalThis as typeof globalThis & {
        __votesPulseMobileSessions?: Map<string, StoredSession>
    }
    root.__votesPulseMobileSessions ??= new Map()
    return root.__votesPulseMobileSessions
})()

const prototypeUsers: Record<string, Omit<MobileSessionUser, 'email'>> = {
    'field@example.test': {
        id: 'mobile-field-reporter-local',
        displayName: 'Field Reporter',
        coverageLabel: 'Assigned field coverage',
        role: 'field-reporter',
        tenantId: 'tenant-local',
        workspaceId: 'workspace-local',
    },
    'marilao@example.test': {
        id: 'user-marilao-local',
        displayName: 'Marilao User',
        coverageLabel: 'Municipality of Marilao',
        coverageCode: '0301411000',
        role: 'field-coordinator',
        tenantId: 'tenant-local',
        workspaceId: 'workspace-local',
    },
}

const createPrototypeMobileSession = (email: string, password: string): MobileSession => {
    if (process.env.NODE_ENV === 'production' && process.env.MOBILE_AUTH_PROTOTYPE_ONLY !== 'true') {
        throw new Error('Prototype mobile login is disabled in production.')
    }

    const expectedPassword = process.env.MOBILE_PROTOTYPE_PASSWORD || 'prototype'
    if (password !== expectedPassword) throw new Error('Invalid prototype credentials.')

    const normalizedEmail = email.trim().toLowerCase()
    const profile = prototypeUsers[normalizedEmail] ?? {
        id: `mobile-${normalizedEmail.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        displayName: normalizedEmail.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Field Reporter',
        coverageLabel: 'Assigned field coverage',
        role: 'field-reporter' as const,
        tenantId: 'tenant-local',
        workspaceId: 'workspace-local',
    }
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
    const session: StoredSession = {
        token: `dev-mobile-${randomUUID()}`,
        expiresAt,
        mode: 'connected',
        user: { ...profile, email: normalizedEmail },
    }
    sessions.set(session.token, session)
    return session
}

export const createMobileSession = async (email: string, password: string): Promise<MobileSession> => {
    const normalizedEmail = email.trim().toLowerCase()

    if (dbEnabled && process.env.MOBILE_AUTH_PROTOTYPE_ONLY !== 'true') {
        const { rows } = await query(`
            SELECT u.id, u.email, u.display_name, u.password_hash,
              m.tenant_id, m.role, m.workspace_ids
            FROM users u
            LEFT JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
            WHERE lower(u.email) = $1 AND u.status = 'active'
            LIMIT 1
        `, [normalizedEmail])
        const row = rows[0]
        if (row) {
            const passwordMatches = row.password_hash
                ? await bcrypt.compare(password, row.password_hash)
                : false
            if (!passwordMatches) throw new Error('Invalid email or password.')
            if (!row.tenant_id) throw new Error('The user has no active tenant membership.')

            const token = `mobile-${randomUUID()}`
            const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
            await query(
                'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
                [token, row.id, expiresAt],
            )
            const workspaceIds = Array.isArray(row.workspace_ids) ? row.workspace_ids : []
            const role = ['owner', 'administrator'].includes(String(row.role).toLowerCase())
                ? 'field-coordinator'
                : 'field-reporter'
            return {
                token,
                expiresAt,
                mode: 'connected',
                user: {
                    id: row.id,
                    email: row.email,
                    displayName: row.display_name ?? row.email,
                    coverageLabel: 'Assigned field coverage',
                    role,
                    tenantId: row.tenant_id,
                    workspaceId: workspaceIds[0] ?? 'workspace-local',
                },
            }
        }
    }

    return createPrototypeMobileSession(normalizedEmail, password)
}

export const getPrototypeMobileSession = (token: string): MobileSession | null => {
    const session = sessions.get(token)
    if (!session) return null
    if (Date.parse(session.expiresAt) <= Date.now()) {
        sessions.delete(token)
        return null
    }
    return session
}

export const revokeMobileSession = async (token: string) => {
    sessions.delete(token)
    if (dbEnabled && process.env.MOBILE_AUTH_PROTOTYPE_ONLY !== 'true' && token.startsWith('mobile-')) {
        await query('DELETE FROM sessions WHERE token = $1', [token])
    }
}
