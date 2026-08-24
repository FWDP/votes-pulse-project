import { Router } from 'express'
import { query } from '../db'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const result = await query('SELECT id, name, slug, search_id FROM brands ORDER BY name')
    return res.json({ data: result.rows })
  } catch (error) {
    console.error('Brands route error:', error)
    return res.status(500).json({ error: 'Unable to load brands' })
  }
})

export default router
