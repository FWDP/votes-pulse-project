import { Router } from 'express'

import {
  integrityArtifactTypes,
  type IntegrityArtifactInput,
  type IntegrityArtifactType,
} from '../../../shared/integrityArtifacts'
import { requireSession, type AuthRequest } from '../middleware/auth'
import {
  enqueueIntegrityArtifact,
  getIntegrityArtifactHistory,
  listIntegrityArtifacts,
} from '../integrity/artifactRepository'
import { listIntegrityIncidents, reconcileIntegrityBatch } from '../integrity/operations'

const router = Router()
const allowedTypes = new Set<string>(integrityArtifactTypes)

router.use(requireSession)

const scope = (request: AuthRequest) => ({
  tenantId: request.auth?.user?.tenantId ?? 'tenant-ramon-de-la-cruz-office',
  workspaceId: request.auth?.user?.workspaceId ?? 'workspace-constituent-sentiment',
})

const isSuperadmin = (request: AuthRequest) => Boolean(request.auth?.user?.isSuperadmin ||
  request.auth?.user?.role?.toLowerCase() === 'superadmin' ||
  request.auth?.user?.roles?.some(role => role.toLowerCase() === 'superadmin'))

router.use((request: AuthRequest, response, next) => {
  if (!isSuperadmin(request)) return response.status(403).json({ error: 'Only a superadmin can manage integrity artifacts.' })
  next()
})

router.get('/artifacts', async (request: AuthRequest, response) => {
  const artifactType = typeof request.query.type === 'string' && allowedTypes.has(request.query.type)
    ? request.query.type as IntegrityArtifactType
    : undefined
  const requestedLimit = Number(request.query.limit)
  try {
    const data = await listIntegrityArtifacts(scope(request), artifactType, Number.isFinite(requestedLimit) ? requestedLimit : 100)
    return response.json({ data, count: data.length })
  } catch (error) {
    console.error('Unable to list integrity artifacts:', error)
    return response.status(500).json({ error: 'Unable to list integrity artifacts.' })
  }
})

router.post('/artifacts', async (request: AuthRequest, response) => {
  const input = request.body as IntegrityArtifactInput
  if (!input || typeof input !== 'object' || !allowedTypes.has(input.artifactType)) {
    return response.status(400).json({
      error: 'A supported artifactType is required.',
      supportedTypes: integrityArtifactTypes,
    })
  }
  try {
    const data = await enqueueIntegrityArtifact(
      scope(request),
      input,
      request.auth?.user?.id ?? request.auth?.user?.userId ?? 'unknown',
    )
    return response.status(202).json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to enqueue integrity artifact.'
    return response.status(400).json({ error: message })
  }
})

router.get('/artifacts/:type/:externalId', async (request: AuthRequest, response) => {
  const artifactType = String(request.params.type)
  if (!allowedTypes.has(artifactType)) return response.status(400).json({ error: 'Unsupported artifact type.' })
  try {
    const data = await getIntegrityArtifactHistory(
      scope(request),
      artifactType as IntegrityArtifactType,
      String(request.params.externalId),
    )
    if (!data.length) return response.status(404).json({ error: 'Integrity artifact not found.' })
    return response.json({ data, count: data.length })
  } catch (error) {
    console.error('Unable to load integrity artifact:', error)
    return response.status(500).json({ error: 'Unable to load integrity artifact.' })
  }
})

router.get('/incidents', async (request: AuthRequest, response) => {
  try {
    const data = await listIntegrityIncidents(scope(request).tenantId, scope(request).workspaceId)
    return response.json({ data, count: data.length })
  } catch (error) {
    console.error('Unable to list integrity incidents:', error)
    return response.status(500).json({ error: 'Unable to list integrity incidents.' })
  }
})

router.post('/reconcile', async (_request, response) => {
  try {
    return response.json({ data: await reconcileIntegrityBatch() })
  } catch (error) {
    console.error('Unable to reconcile integrity anchors:', error)
    return response.status(500).json({ error: 'Unable to reconcile integrity anchors.' })
  }
})

export default router
