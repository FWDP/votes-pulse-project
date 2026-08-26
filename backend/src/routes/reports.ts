import fs from 'fs'
import path from 'path'
import { createHash } from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'

import { requireSession, type AuthRequest } from '../middleware/auth'
import {
  createFieldReport,
  getFieldReport,
  listFieldReportRecipients,
  listFieldReports,
  synchronizeFieldReportRecipients,
  updateFieldReport,
} from '../services/fieldReports.service'
import {
  getIntegrityQueueHealth,
  getReportIntegrity,
  markReportIntegrityTtlExtended,
  retryReportIntegrity,
} from '../integrity/integrityRepository'
import { extendReportAnchorTtl } from '../integrity/stellarClient'
import {
  validateFieldReportPayload,
  type FieldReport,
  type FieldReportStatus,
} from '../../../shared/fieldReports'

const router = Router()
const uploadDir = path.resolve(process.cwd(), 'backend', 'uploads')

fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir)
  },
  filename: (_req, file, callback) => {
    const request = _req as AuthRequest
    const tenantPrefix = (request.auth?.user?.tenantId ?? 'tenant-local')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    const uniqueName = `${tenantPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`
    callback(null, uniqueName)
  },
})

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
])

const upload = multer({
  storage,
  limits: {
    files: 10,
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    callback(null, allowedMimeTypes.has(file.mimetype))
  },
})

const hashFile = (filePath: string) => new Promise<string>((resolve, reject) => {
  const hash = createHash('sha256')
  const stream = fs.createReadStream(filePath)
  stream.on('error', reject)
  stream.on('data', chunk => hash.update(chunk))
  stream.on('end', () => resolve(hash.digest('hex')))
})

router.use(requireSession)

const getScope = (request: AuthRequest) => ({
  tenantId: request.auth?.user?.tenantId ?? process.env.MOBILE_PROTOTYPE_TENANT_ID ?? 'tenant-ramon-de-la-cruz-office',
  workspaceId: request.auth?.user?.workspaceId ?? process.env.MOBILE_PROTOTYPE_WORKSPACE_ID ?? 'workspace-constituent-sentiment',
})

const getViewer = (request: AuthRequest) => {
  const user = request.auth?.user
  const role = user?.role?.toLowerCase()
  return {
    id: user?.id ?? user?.userId,
    email: user?.email,
    displayName: user?.displayName,
    isSuperadmin: Boolean(
      user?.isSuperadmin ||
      role === 'superadmin' ||
      user?.roles?.some(candidate => candidate.toLowerCase() === 'superadmin'),
    ),
  }
}

router.get('/', async (request: AuthRequest, response) => {
  try {
    const data = await listFieldReports(getScope(request), getViewer(request))
    return response.json({ data, count: data.length })
  } catch (error) {
    console.error('Unable to list field reports:', error)
    return response.status(500).json({ error: 'Unable to list field reports.' })
  }
})

router.get('/recipients', async (request: AuthRequest, response) => {
  try {
    const data = await listFieldReportRecipients(getScope(request))
    return response.json({ data, count: data.length })
  } catch (error) {
    console.error('Unable to list Field Report recipients:', error)
    return response.status(500).json({ error: 'Unable to list Field Report recipients.' })
  }
})

router.put('/recipients', async (request: AuthRequest, response) => {
  if (process.env.MOBILE_AUTH_PROTOTYPE_ONLY !== 'true') {
    return response.status(403).json({ error: 'Web account synchronization is only available in prototype mode.' })
  }
  const accounts = Array.isArray(request.body?.accounts) ? request.body.accounts : null
  if (!accounts || accounts.length > 100) {
    return response.status(400).json({ error: 'accounts must contain at most 100 web users.' })
  }
  const invalid = accounts.some((account: unknown) => {
    if (!account || typeof account !== 'object') return true
    const candidate = account as Record<string, unknown>
    return typeof candidate.id !== 'string' ||
      typeof candidate.displayName !== 'string' ||
      typeof candidate.email !== 'string'
  })
  if (invalid) return response.status(400).json({ error: 'Each web account requires an id, displayName, and email.' })

  try {
    const data = await synchronizeFieldReportRecipients(getScope(request), accounts)
    return response.json({ data, count: data.length })
  } catch (error) {
    console.error('Unable to synchronize Field Report recipients:', error)
    return response.status(500).json({ error: 'Unable to synchronize Field Report recipients.' })
  }
})

router.post('/', async (request: AuthRequest, response) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    return response.status(400).json({ error: 'A JSON Field Report payload is required.' })
  }
  const user = request.auth?.user
  const submittedReport = request.body as FieldReport
  const submittedLocation = submittedReport.location ?? { label: '' }
  const assignedCoverageLabel = user?.coverageLabel
  const usesAssignedCoverage = submittedLocation.label === 'Assigned field coverage' ||
    Boolean(assignedCoverageLabel && submittedLocation.label === assignedCoverageLabel)
  const locationLabel = submittedLocation.label === 'Assigned field coverage' && assignedCoverageLabel
    ? assignedCoverageLabel
    : submittedLocation.label
  const report: FieldReport = {
    ...submittedReport,
    location: {
      ...submittedLocation,
      label: locationLabel,
      localityType: submittedLocation.localityType ?? (usesAssignedCoverage ? user?.localityType : undefined),
      regionCode: submittedLocation.regionCode ?? (usesAssignedCoverage ? user?.regionCode : undefined),
      regionName: submittedLocation.regionName ?? (usesAssignedCoverage ? user?.regionName : undefined),
      provinceCode: submittedLocation.provinceCode ?? (usesAssignedCoverage ? user?.provinceCode : undefined),
      provinceName: submittedLocation.provinceName ?? (usesAssignedCoverage ? user?.provinceName : undefined),
      localityCode: submittedLocation.localityCode ?? (usesAssignedCoverage ? user?.coverageCode : undefined),
      localityName: submittedLocation.localityName ?? (usesAssignedCoverage ? user?.localityName : undefined),
    },
    reporter: {
      id: user?.id ?? user?.userId ?? 'local-user',
      displayName: user?.displayName ?? user?.email ?? 'Field Reporter',
      email: user?.email,
    },
  }
  const errors = validateFieldReportPayload(report)
  if (errors.length) return response.status(400).json({ error: 'Invalid field report.', details: errors })

  try {
    const tenantPrefix = getScope(request).tenantId.replace(/[^a-zA-Z0-9_-]/g, '_')
    report.attachments = await Promise.all(report.attachments.map(async attachment => {
      if (!attachment.remoteUrl) return { ...attachment, sha256: undefined }
      const filename = path.basename(attachment.remoteUrl)
      if (!filename.startsWith(`${tenantPrefix}-`)) {
        throw new Error('An attachment is outside the report tenant.')
      }
      const filePath = path.join(uploadDir, filename)
      if (!fs.existsSync(filePath)) throw new Error(`Attachment ${attachment.name} is unavailable.`)
      return { ...attachment, sha256: await hashFile(filePath) }
    }))
    if (submittedReport.recipient?.id) {
      const recipients = await listFieldReportRecipients(getScope(request))
      const authorizedRecipient = recipients.find(recipient => recipient.id === submittedReport.recipient?.id)
      if (!authorizedRecipient) {
        return response.status(400).json({ error: 'The selected recipient is not available in this workspace.' })
      }
      report.recipient = authorizedRecipient
      report.assignedTo = authorizedRecipient.displayName
    }
    const data = await createFieldReport(getScope(request), report)
    return response.status(201).json({ data })
  } catch (error) {
    console.error('Unable to create field report:', error)
    return response.status(500).json({ error: 'Unable to create field report.' })
  }
})

router.post('/upload', upload.array('attachments', 10), async (req, res) => {
  const uploaded = await Promise.all((req.files as Express.Multer.File[] | undefined ?? []).map(async file => ({
    id: `attachment-${file.filename}`,
    kind: file.mimetype.startsWith('image/') ? 'image' : 'document',
    name: file.originalname,
    mimeType: file.mimetype,
    type: file.mimetype,
    size: file.size,
    storedName: file.filename,
    uploadStatus: 'uploaded',
    remoteUrl: `/api/reports/files/${file.filename}`,
    path: `/api/reports/files/${file.filename}`,
    sha256: await hashFile(file.path),
  })))

  res.json({ files: uploaded })
})

router.get('/files/:filename', (req: AuthRequest, res) => {
  const filenameParam = req.params.filename
  const filename = path.basename(Array.isArray(filenameParam) ? filenameParam[0] ?? '' : filenameParam)
  const tenantPrefix = (req.auth?.user?.tenantId ?? 'tenant-local')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
  if (!req.auth?.user?.isSuperadmin && !filename.startsWith(`${tenantPrefix}-`)) {
    return res.status(403).json({ error: 'Attachment is outside the assigned tenant.' })
  }
  const filePath = path.join(uploadDir, filename)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Attachment not found' })
  }

  return res.download(filePath)
})

router.get('/integrity/health', async (request: AuthRequest, response) => {
  if (!getViewer(request).isSuperadmin) {
    return response.status(403).json({ error: 'Only a superadmin can view integrity worker health.' })
  }
  try {
    return response.json({ data: await getIntegrityQueueHealth(getScope(request)) })
  } catch (error) {
    console.error('Unable to load report integrity health:', error)
    return response.status(500).json({ error: 'Unable to load report integrity health.' })
  }
})

router.get('/:id/integrity', async (request: AuthRequest, response) => {
  const reportId = Array.isArray(request.params.id) ? request.params.id[0] ?? '' : request.params.id
  try {
    const report = await getFieldReport(getScope(request), reportId, getViewer(request))
    if (!report) return response.status(404).json({ error: 'Field report not found.' })
    const data = await getReportIntegrity(getScope(request), report)
    if (!data) return response.status(404).json({ error: 'No integrity anchor exists for this report.' })
    return response.json({ data })
  } catch (error) {
    console.error('Unable to verify field report integrity:', error)
    return response.status(500).json({ error: 'Unable to verify field report integrity.' })
  }
})

router.post('/:id/integrity/retry', async (request: AuthRequest, response) => {
  if (!getViewer(request).isSuperadmin) {
    return response.status(403).json({ error: 'Only a superadmin can retry integrity anchoring.' })
  }
  const reportId = Array.isArray(request.params.id) ? request.params.id[0] ?? '' : request.params.id
  try {
    const retried = await retryReportIntegrity(getScope(request), reportId)
    if (!retried) return response.status(409).json({ error: 'The integrity anchor is not in a failed state.' })
    return response.status(202).json({ accepted: true })
  } catch (error) {
    console.error('Unable to retry field report integrity:', error)
    return response.status(500).json({ error: 'Unable to retry field report integrity.' })
  }
})

router.post('/:id/integrity/extend-ttl', async (request: AuthRequest, response) => {
  if (!getViewer(request).isSuperadmin) {
    return response.status(403).json({ error: 'Only a superadmin can extend integrity TTL.' })
  }
  const reportId = Array.isArray(request.params.id) ? request.params.id[0] ?? '' : request.params.id
  try {
    const report = await getFieldReport(getScope(request), reportId, getViewer(request))
    if (!report) return response.status(404).json({ error: 'Field report not found.' })
    const integrity = await getReportIntegrity(getScope(request), report)
    if (!integrity?.reportKey || integrity.status !== 'confirmed') {
      return response.status(409).json({ error: 'A confirmed integrity anchor is required.' })
    }
    const confirmation = await extendReportAnchorTtl(integrity.reportKey, integrity.revision)
    const extendedAt = await markReportIntegrityTtlExtended(getScope(request), reportId, integrity.revision)
    return response.json({ data: { ...confirmation, extendedAt } })
  } catch (error) {
    console.error('Unable to extend field report integrity TTL:', error)
    return response.status(500).json({ error: 'Unable to extend field report integrity TTL.' })
  }
})

router.get('/:id', async (request: AuthRequest, response) => {
  const reportId = Array.isArray(request.params.id) ? request.params.id[0] ?? '' : request.params.id
  try {
    const data = await getFieldReport(getScope(request), reportId, getViewer(request))
    if (!data) return response.status(404).json({ error: 'Field report not found.' })
    return response.json({ data })
  } catch (error) {
    console.error('Unable to load field report:', error)
    return response.status(500).json({ error: 'Unable to load field report.' })
  }
})

const allowedStatuses: FieldReportStatus[] = [
  'submitted',
  'under-review',
  'verified',
  'needs-follow-up',
  'rejected',
]

router.patch('/:id', async (request: AuthRequest, response) => {
  const reportId = Array.isArray(request.params.id) ? request.params.id[0] ?? '' : request.params.id
  const status = request.body?.status as FieldReportStatus | undefined
  const assignedTo = typeof request.body?.assignedTo === 'string'
    ? request.body.assignedTo.trim().slice(0, 160)
    : undefined
  if (status && !allowedStatuses.includes(status)) {
    return response.status(400).json({ error: 'Invalid field report status.' })
  }
  if (!status && assignedTo === undefined) {
    return response.status(400).json({ error: 'No supported field report changes were supplied.' })
  }

  try {
    const data = await updateFieldReport(getScope(request), reportId, { status, assignedTo }, getViewer(request))
    if (!data) return response.status(404).json({ error: 'Field report not found.' })
    return response.json({ data })
  } catch (error) {
    console.error('Unable to update field report:', error)
    return response.status(500).json({ error: 'Unable to update field report.' })
  }
})

export default router
