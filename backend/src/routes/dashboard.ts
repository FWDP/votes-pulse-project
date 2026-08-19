import { Router } from 'express'

import { placeholderDashboard } from '../../../frontend/src/data/placeholderDashboard'
import { buildDashboard } from '../services/dashboard.service'

const router = Router()

router.get('/', async (req, res) => {
  const start = String(req.query.start ?? '')
  const end = String(req.query.end ?? '')
  const area = String(req.query.area ?? '')

  if (!start || !end) {
    return res.status(400).json({
      error: 'start and end query parameters are required',
    })
  }

  try {
    const data = await buildDashboard({ start, end }, area ? { area } : undefined)
    return res.json(data)
  } catch (error) {
    console.warn('Dashboard route falling back to placeholder data:', error)

    const scopedFallback = area
      ? {
          ...placeholderDashboard,
          areas: placeholderDashboard.areas.filter((candidate) => {
            const normalized = area.toLowerCase()
            return (
              candidate.id === normalized ||
              candidate.name.toLowerCase().includes(normalized) ||
              candidate.name.toLowerCase().includes(normalized.replace(/[^a-z]+/g, ' '))
            )
          }),
        }
      : placeholderDashboard

    return res.status(200).json(scopedFallback)
  }
})

export default router
