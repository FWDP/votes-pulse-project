import type { NextFunction, Request, Response } from 'express'

export interface AuthUser {
  id?: string
  userId?: string
  email?: string
  displayName?: string
  isSuperadmin?: boolean
  roles?: string[]
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

export const requireSession = (req: AuthRequest, res: Response, next: NextFunction) => {
  const existingUser = normalizeUser(req.auth?.user) ?? normalizeUser(req.user) ?? normalizeUser(req.session?.user)

  if (existingUser) {
    req.auth = { ...(req.auth ?? {}), user: existingUser }
    return next()
  }

  const isLocalDev = process.env.NODE_ENV !== 'production'
  if (isLocalDev) {
    const devUser: AuthUser = {
      id: 'user-superadmin-local',
      email: 'superadmin@example.test',
      displayName: 'Super Admin',
      isSuperadmin: true,
    }

    req.auth = { user: devUser }
    return next()
  }

  return res.status(401).json({ error: 'Unauthorized' })
}
