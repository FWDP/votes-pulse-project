import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import multer from 'multer'

import { requireSession, type AuthRequest } from '../middleware/auth'
import {
  createFieldReport,
  getFieldReport,
  listFieldReports,
  updateFieldReport,
} from '../services/fieldReports.service'
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

router.use(requireSession)

const getScope = (request: AuthRequest) => ({
  tenantId: request.auth?.user?.tenantId ?? 'tenant-local',
  workspaceId: request.auth?.user?.workspaceId ?? 'workspace-local',
})

router.get('/', async (request: AuthRequest, response) => {
  try {
    const data = await listFieldReports(getScope(request))
    return response.json({ data, count: data.length })
  } catch (error) {
    console.error('Unable to list field reports:', error)
    return response.status(500).json({ error: 'Unable to list field reports.' })
  }
})

router.post('/', async (request: AuthRequest, response) => {
  const user = request.auth?.user
  const report: FieldReport = {
    ...(request.body as FieldReport),
    reporter: {
      id: user?.id ?? user?.userId ?? 'local-user',
      displayName: user?.displayName ?? user?.email ?? 'Field Reporter',
      email: user?.email,
    },
  }
  const errors = validateFieldReportPayload(report)
  if (errors.length) return response.status(400).json({ error: 'Invalid field report.', details: errors })

  try {
    const data = await createFieldReport(getScope(request), report)
    return response.status(201).json({ data })
  } catch (error) {
    console.error('Unable to create field report:', error)
    return response.status(500).json({ error: 'Unable to create field report.' })
  }
})

router.post('/upload', upload.array('attachments', 10), (req, res) => {
  const uploaded = (req.files as Express.Multer.File[] | undefined ?? []).map(file => ({
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
  }))

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

router.get('/:id', async (request: AuthRequest, response) => {
  const reportId = Array.isArray(request.params.id) ? request.params.id[0] ?? '' : request.params.id
  try {
    const data = await getFieldReport(getScope(request), reportId)
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
    const data = await updateFieldReport(getScope(request), reportId, { status, assignedTo })
    if (!data) return response.status(404).json({ error: 'Field report not found.' })
    return response.json({ data })
  } catch (error) {
    console.error('Unable to update field report:', error)
    return response.status(500).json({ error: 'Unable to update field report.' })
  }
})

export default router
