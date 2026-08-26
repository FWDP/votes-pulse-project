import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'

import type { MobileSession, MobileSessionUser } from '../../../shared/mobileSessions'
import { dbEnabled, query } from '../db'

type StoredSession = MobileSession & { expiresAt: string }

const prototypeTenantId = process.env.MOBILE_PROTOTYPE_TENANT_ID || 'tenant-ramon-de-la-cruz-office'
const prototypeWorkspaceId = process.env.MOBILE_PROTOTYPE_WORKSPACE_ID || 'workspace-constituent-sentiment'

const sessions = (() => {
    const root = globalThis as typeof globalThis & {
        __votesPulseMobileSessions?: Map<string, StoredSession>
    }
    root.__votesPulseMobileSessions ??= new Map()
    return root.__votesPulseMobileSessions
})()

const prototypeUsers: Record<string, Omit<MobileSessionUser, 'email'>> = {
    'superadmin@example.test': {
        id: 'user-superadmin-local',
        displayName: 'Super Admin',
        coverageLabel: 'National coverage',
        role: 'superadmin',
        tenantId: prototypeTenantId,
        workspaceId: prototypeWorkspaceId,
    },
    'field@example.test': {
        id: 'mobile-field-reporter-local',
        displayName: 'Field Reporter',
        coverageLabel: 'Municipality of Marilao',
        coverageCode: '0301411000',
        regionCode: '0300000000',
        regionName: 'Region III (Central Luzon)',
        provinceCode: '0301400000',
        provinceName: 'Bulacan',
        localityName: 'Marilao',
        localityType: 'municipality',
        role: 'field-reporter',
        tenantId: prototypeTenantId,
        workspaceId: prototypeWorkspaceId,
    },
    'marilao@example.test': {
        id: 'user-marilao-local',
        displayName: 'Marilao User',
        coverageLabel: 'Municipality of Marilao',
        coverageCode: '0301411000',
        regionCode: '0300000000',
        regionName: 'Region III (Central Luzon)',
        provinceCode: '0301400000',
        provinceName: 'Bulacan',
        localityName: 'Marilao',
        localityType: 'municipality',
        role: 'field-coordinator',
        tenantId: prototypeTenantId,
        workspaceId: prototypeWorkspaceId,
    },
}

const createPrototypeMobileSession = (
    email: string,
    password: string,
    databaseProfile?: Partial<Omit<MobileSessionUser, 'email'>>,
): MobileSession => {
    if (process.env.NODE_ENV === 'production' && process.env.MOBILE_AUTH_PROTOTYPE_ONLY !== 'true') {
        throw new Error('Prototype mobile login is disabled in production.')
    }

    const expectedPassword = process.env.MOBILE_PROTOTYPE_PASSWORD || 'prototype'
    if (password !== expectedPassword) throw new Error('Invalid prototype credentials.')

    const normalizedEmail = email.trim().toLowerCase()
    const fallbackProfile = prototypeUsers[normalizedEmail] ?? {
        id: `mobile-${normalizedEmail.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        displayName: normalizedEmail.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Field Reporter',
        coverageLabel: 'Assigned field coverage',
        role: 'field-reporter' as const,
        tenantId: prototypeTenantId,
        workspaceId: prototypeWorkspaceId,
    }
    const profile = { ...fallbackProfile, ...databaseProfile }
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

export const createMobileSession = async (
    email: string,
    password: string,
    prototypeProfile?: Pick<MobileSessionUser, 'id' | 'displayName'>,
): Promise<MobileSession> => {
    const normalizedEmail = email.trim().toLowerCase()
    let row: Record<string, any> | undefined

    if (dbEnabled) {
        try {
            const result = await query(`
                SELECT u.id, u.email, u.display_name, u.password_hash,
                  m.tenant_id, m.role, m.workspace_ids
                FROM users u
                LEFT JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
                WHERE lower(u.email) = $1 AND u.status = 'active'
                ORDER BY CASE WHEN m.tenant_id = $2 THEN 0 ELSE 1 END, m.tenant_id
                LIMIT 1
            `, [
                normalizedEmail,
                process.env.MOBILE_AUTH_PROTOTYPE_ONLY === 'true' ? prototypeTenantId : '',
            ])
            row = result.rows[0]
        } catch (error) {
            if (process.env.MOBILE_AUTH_PROTOTYPE_ONLY !== 'true') throw error
            console.warn('Unable to load the prototype account profile from the database:', error)
        }
    }

    if (process.env.MOBILE_AUTH_PROTOTYPE_ONLY !== 'true') {
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

    const databaseRole = String(row?.role ?? '').toLowerCase()
    const workspaceIds = Array.isArray(row?.workspace_ids) ? row.workspace_ids : []
    const isKnownPrototypeSuperadmin = prototypeUsers[normalizedEmail]?.role === 'superadmin'
    return createPrototypeMobileSession(normalizedEmail, password, row ? {
        id: row.id,
        displayName: row.display_name ?? row.email,
        role: databaseRole === 'superadmin' || isKnownPrototypeSuperadmin
            ? 'superadmin'
            : ['owner', 'administrator'].includes(databaseRole) ? 'field-coordinator' : 'field-reporter',
        tenantId: row.tenant_id ?? prototypeTenantId,
        workspaceId: workspaceIds[0] ?? prototypeWorkspaceId,
    } : prototypeProfile)
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
