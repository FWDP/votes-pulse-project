import { Router } from 'express'
import { query, dbEnabled } from '../db'
import { requireSession, type AuthRequest } from '../middleware/auth'
import { getMemberships } from '../services/auth.service'

const router = Router()

router.use(requireSession)

const isAdminUser = (req: AuthRequest) => {
  const user = req.auth?.user
  if (!user) return false

  if (user.isSuperadmin) return true

  const memberships = getMemberships(user.id ?? user.userId)
  return memberships.some((membership: any) => ['owner', 'administrator'].includes(String(membership.role ?? '').toLowerCase()))
}

router.get('/sessions', async (req, res) => {
  if (!isAdminUser(req)) return res.status(403).json({ error: 'Forbidden' })

  if (dbEnabled) {
    try {
      const { rows } = await query(`SELECT s.token, s.expires_at, u.id as user_id, u.email, u.display_name
        FROM sessions s
        LEFT JOIN users u ON u.id = s.user_id
        ORDER BY s.expires_at DESC LIMIT 100`)
      return res.json(rows.map((r: any) => ({ token: r.token, user: { id: r.user_id, email: r.email, displayName: r.display_name }, expires_at: r.expires_at })))
    } catch (err) {
      console.error('Admin /sessions error', err)
      return res.status(500).json({ error: 'Unable to list sessions' })
    }
  }

  // Fallback placeholder
  return res.json([
    {
      token: 'dev-session-1',
      user: { displayName: 'Super Admin', email: 'superadmin@example.test' },
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    },
  ])
})

router.get('/exports', async (req, res) => {
  if (!isAdminUser(req)) return res.status(403).json({ error: 'Forbidden' })

  if (dbEnabled) {
    try {
      const { rows } = await query(`SELECT id, status, created_at, file_name FROM export_requests ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] }))
      return res.json(rows)
    } catch (err) {
      console.error('Admin /exports error', err)
      return res.status(500).json({ error: 'Unable to list exports' })
    }
  }

  // Fallback placeholder
  return res.json([
    { id: 'exp-1', file_name: 'export-2026-08-18.csv', status: 'completed', created_at: new Date().toISOString() },
    { id: 'exp-2', file_name: 'export-2026-08-17.csv', status: 'failed', created_at: new Date().toISOString() },
  ])
})

export default router
