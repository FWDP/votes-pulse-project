import type { NextFunction, Request, Response } from 'express'
import { dbEnabled, query } from '../db'
import { getPrototypeMobileSession } from '../services/mobileSessions.service'

export interface AuthUser {
  id?: string
  userId?: string
  email?: string
  displayName?: string
  isSuperadmin?: boolean
  roles?: string[]
  tenantId?: string
  workspaceId?: string
  coverageLabel?: string
  coverageCode?: string
  role?: string
  [key: string]: any
}

export type AuthRequest = Request & {
  auth?: { user?: AuthUser }
  user?: AuthUser
  session?: { user?: AuthUser }
}

const normalizeUser = (value: unknown): AuthUser | null => {
  if (!value || typeof value !== 'object') return null

  const user = value as Record<string, unknown>
  const id = typeof user.id === 'string' ? user.id : typeof user.userId === 'string' ? user.userId : typeof user.user_id === 'string' ? user.user_id : undefined
  const email = typeof user.email === 'string' ? user.email : undefined
  const displayName = typeof user.displayName === 'string' ? user.displayName : undefined

  if (!id && !email && !displayName) return null

  return {
    ...user,
    id: id ?? email ?? 'local-user',
    email,
    displayName: displayName ?? email ?? 'Local User',
    isSuperadmin: Boolean(user.isSuperadmin),
  }
}

const resolveBearerUser = async (token: string): Promise<AuthUser | null> => {
  const prototypeSession = getPrototypeMobileSession(token)
  if (prototypeSession) return prototypeSession.user

  if (!dbEnabled) return null

  const { rows } = await query(`
    SELECT u.id, u.email, u.display_name, m.tenant_id, m.role,
      COALESCE((m.workspace_ids->>0), 'workspace-local') AS workspace_id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
    WHERE s.token = $1 AND s.expires_at > now()
    LIMIT 1
  `, [token])
  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    tenantId: row.tenant_id,
    workspaceId: row.workspace_id,
    role: row.role,
  }
}

export const requireSession = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const existingUser = normalizeUser(req.auth?.user) ?? normalizeUser(req.user) ?? normalizeUser(req.session?.user)

  if (existingUser) {
    req.auth = { ...(req.auth ?? {}), user: existingUser }
    return next()
  }

  const authorization = req.get('authorization') ?? ''
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  if (bearerToken) {
    try {
      const bearerUser = await resolveBearerUser(bearerToken)
      if (bearerUser) {
        req.auth = { user: bearerUser }
        return next()
      }
    } catch (error) {
      console.error('Unable to resolve bearer session:', error)
      return res.status(500).json({ error: 'Unable to validate session' })
    }
  }

  const isLocalDev = process.env.NODE_ENV !== 'production'
  if (isLocalDev) {
    const devUser: AuthUser = {
      id: 'user-superadmin-local',
      email: 'superadmin@example.test',
      displayName: 'Super Admin',
      isSuperadmin: true,
      tenantId: process.env.MOBILE_PROTOTYPE_TENANT_ID || 'tenant-ramon-de-la-cruz-office',
      workspaceId: process.env.MOBILE_PROTOTYPE_WORKSPACE_ID || 'workspace-constituent-sentiment',
    }

    req.auth = { user: devUser }
    return next()
  }

  return res.status(401).json({ error: 'Unauthorized' })
}
