import { Router } from 'express'

import { placeholderDashboard } from '../../../frontend/src/data/placeholderDashboard'
import { buildDashboard } from '../services/dashboard.service'
import {
  ElectionQueryError,
  getLegislativeDistrict,
  getPartyList,
  resolveElectionYear,
} from '../services/elections.service'

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

  let electionYear: number
  let coverageMode: 'administrative' | 'legislative'
  let legislativeDistrict: ReturnType<typeof getLegislativeDistrict>
  let partyList: ReturnType<typeof getPartyList>

  try {
    electionYear = resolveElectionYear(req.query.electionYear)
    const requestedMode = String(req.query.coverageMode ?? 'administrative')
    if (requestedMode !== 'administrative' && requestedMode !== 'legislative') {
      throw new ElectionQueryError('coverageMode must be administrative or legislative')
    }
    coverageMode = requestedMode

    const legislativeDistrictId = String(req.query.legislativeDistrictId ?? '')
    if (coverageMode === 'legislative' && !legislativeDistrictId) {
      throw new ElectionQueryError('legislativeDistrictId is required for legislative coverage')
    }
    legislativeDistrict = legislativeDistrictId
      ? getLegislativeDistrict(legislativeDistrictId, electionYear)
      : undefined
    if (legislativeDistrictId && !legislativeDistrict) {
      throw new ElectionQueryError('Unknown legislativeDistrictId for the selected election year')
    }

    const partyListId = String(req.query.partyListId ?? '')
    partyList = partyListId ? getPartyList(partyListId, electionYear) : undefined
    if (partyListId && !partyList) {
      throw new ElectionQueryError('Unknown partyListId for the selected election year')
    }
  } catch (error) {
    if (error instanceof ElectionQueryError) {
      return res.status(400).json({ error: error.message })
    }
    throw error
  }

  const electionCoverage = {
    electionYear,
    coverageMode,
    ...(area ? { administrativeArea: area } : {}),
    ...(legislativeDistrict ? {
      legislativeDistrict: {
        id: legislativeDistrict.id,
        label: legislativeDistrict.label,
        status: legislativeDistrict.status,
        localityCodes: legislativeDistrict.memberships.map(item => item.localityCode),
      },
    } : {}),
    ...(partyList ? {
      partyListFocus: {
        id: partyList.id,
        rank: partyList.rank,
        officialName: partyList.officialName,
        acronym: partyList.acronym,
      },
    } : {}),
  }

  const resolvedArea = area || (
    legislativeDistrict?.jurisdiction?.name ??
    (legislativeDistrict?.memberships.length === 1
      ? legislativeDistrict.memberships[0].localityName
      : '')
  )

  try {
    // Determine product from mounted path: requests under /api/pulse/* are for PULSE
    const product = req.baseUrl && req.baseUrl.startsWith('/api/pulse') ? 'pulse' : 'votes'
    const data = await buildDashboard(
      { start, end },
      resolvedArea ? { area: resolvedArea, product } : { product },
    )
    return res.json({ ...data, coverage: electionCoverage })
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

    return res.status(200).json({ ...scopedFallback, coverage: electionCoverage })
  }
})

export default router
