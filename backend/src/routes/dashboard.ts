import { Router } from 'express'

import { placeholderDashboard } from '../../../frontend/src/data/placeholderDashboard'
import { buildDashboard } from '../services/dashboard.service'

const router = Router()

router.get('/', async (req, res) => {
  const start = String(req.query.start ?? '')
  const end = String(req.query.end ?? '')

  if (!start || !end) {
    return res.status(400).json({
      error: 'start and end query parameters are required',
    })
  }

  try {
    const data = await buildDashboard({ start, end })
    return res.json(data)
  } catch (error) {
    console.warn('Dashboard route falling back to placeholder data:', error)

    return res.status(200).json(placeholderDashboard)
  }
})

export default router
