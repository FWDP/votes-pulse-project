import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { config as loadEnv } from 'dotenv'

import {
  integrityArtifactTypes,
  type IntegrityArtifactType,
} from '../../shared/integrityArtifacts'

loadEnv({ path: path.resolve(process.cwd(), 'backend', '.env') })

const args = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 1) {
  const name = process.argv[index]
  const value = process.argv[index + 1]
  if (!name?.startsWith('--') || !value || value.startsWith('--')) continue
  args.set(name.slice(2), value)
  index += 1
}

const required = (name: string) => {
  const value = args.get(name)?.trim()
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

const filePath = path.resolve(process.cwd(), required('file'))
const artifactType = required('type') as IntegrityArtifactType
if (!integrityArtifactTypes.includes(artifactType)) throw new Error(`Unsupported artifact type: ${artifactType}`)
const tenantId = args.get('tenant')?.trim() || process.env.INTEGRITY_TENANT_ID?.trim()
const workspaceId = args.get('workspace')?.trim() || process.env.INTEGRITY_WORKSPACE_ID?.trim()
if (!tenantId || !workspaceId) throw new Error('--tenant and --workspace, or their INTEGRITY_* environment values, are required.')

const bytes = await readFile(filePath)
const sourceDigest = createHash('sha256').update(bytes).digest('hex')
const { enqueueIntegrityArtifact } = await import('../src/integrity/artifactRepository')
const { close } = await import('../src/db')

try {
  const artifact = await enqueueIntegrityArtifact({ tenantId, workspaceId }, {
    artifactType,
    externalId: required('external-id'),
    contentHash: sourceDigest,
    visibility: args.get('visibility') === 'public' ? 'public' : 'private',
    provenance: {
      sourceName: required('source-name'),
      sourceUri: args.get('source-uri'),
      publisher: args.get('publisher'),
      retrievedAt: args.get('retrieved-at') || new Date().toISOString(),
      sourceVersion: args.get('source-version'),
      license: args.get('license'),
      sourceDigest,
    },
    metadata: {
      localFileName: path.basename(filePath),
      byteLength: bytes.length,
    },
  }, args.get('actor')?.trim() || 'data-ingestion-pipeline')
  console.log(JSON.stringify({
    artifactId: artifact.id,
    status: artifact.status,
    artifactType: artifact.artifactType,
    externalId: artifact.externalId,
    subjectHash: artifact.subjectHash,
    provenanceHash: artifact.provenanceHash,
    receipt: artifact.receipt,
  }, null, 2))
} finally {
  await close()
}
