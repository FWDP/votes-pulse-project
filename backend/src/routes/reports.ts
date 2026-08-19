import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import multer from 'multer'

const router = Router()
const uploadDir = path.resolve(process.cwd(), 'backend', 'uploads')

fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir)
  },
  filename: (_req, file, callback) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`
    callback(null, uniqueName)
  },
})

const upload = multer({
  storage,
  limits: {
    files: 10,
    fileSize: 15 * 1024 * 1024,
  },
})

router.post('/upload', upload.array('attachments', 10), (req, res) => {
  const uploaded = (req.files as Express.Multer.File[] | undefined ?? []).map(file => ({
    name: file.originalname,
    type: file.mimetype,
    size: file.size,
    storedName: file.filename,
    path: `/api/reports/files/${file.filename}`,
  }))

  res.json({ files: uploaded })
})

router.get('/files/:filename', (req, res) => {
  const filename = path.basename(req.params.filename)
  const filePath = path.join(uploadDir, filename)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Attachment not found' })
  }

  return res.download(filePath)
})

export default router
