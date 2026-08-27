import { randomBytes, randomUUID } from 'node:crypto'

import type {
  IntegrityArtifactAnchor,
  IntegrityArtifactInput,
  IntegrityArtifactType,
} from '../../../shared/integrityArtifacts'
import { query, runTenantOperation } from '../db'
import { hashArtifact } from './canonicalizeArtifact'
import { stellarIntegrityConfig } from './config'
import type { IntegrityScope } from './integrityRepository'

interface ArtifactRow extends Record<string, unknown> {
  id: string
  artifact_type: IntegrityArtifactType
  external_id: string
  revision: number
  report_key: string
  content_hash: string
  previous_hash?: string
  schema_version: number
  visibility: 'private' | 'public'
  status: IntegrityArtifactAnchor['status']
  transaction_hash?: string
  ledger_sequence?: number
  confirmed_at?: Date | string
  reconciliation_status?: IntegrityArtifactAnchor['reconciliationStatus']
  metadata: Record<string, unknown>
}

const toArtifact = (row: ArtifactRow): IntegrityArtifactAnchor => ({
  id: row.id,
  artifactType: row.artifact_type,
  externalId: row.external_id,
  revision: Number(row.revision),
  receipt: row.report_key,
  contentHash: row.content_hash,
  previousHash: row.previous_hash,
  schemaVersion: Number(row.schema_version),
  visibility: row.visibility,
  status: row.status,
  transactionHash: row.transaction_hash,
  ledgerSequence: row.ledger_sequence ? Number(row.ledger_sequence) : undefined,
  confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : undefined,
  reconciliationStatus: row.reconciliation_status,
  metadata: row.metadata ?? {},
})

const validateHash = (value: string) => /^[a-f0-9]{64}$/.test(value)

export async function enqueueIntegrityArtifact(
  scope: IntegrityScope,
  input: IntegrityArtifactInput,
  actorId: string,
): Promise<IntegrityArtifactAnchor> {
  const externalId = input.externalId.trim()
  if (!externalId || externalId.length > 200) throw new Error('externalId must contain 1 to 200 characters.')
  if (input.payload === undefined && !input.contentHash) throw new Error('payload or contentHash is required.')
  const contentHash = input.contentHash?.toLowerCase() ?? hashArtifact(input.payload)
  if (!validateHash(contentHash)) throw new Error('contentHash must be a lowercase SHA-256 digest.')
  const schemaVersion = Math.max(1, Math.min(1_000_000, Number(input.schemaVersion) || 1))
  const visibility = input.visibility === 'public' ? 'public' : 'private'

  return runTenantOperation(scope.tenantId, async client => {
    const latest = await client.query(`
      SELECT * FROM integrity_artifact_anchors
      WHERE tenant_id = $1 AND workspace_id = $2 AND artifact_type = $3 AND external_id = $4
      ORDER BY revision DESC LIMIT 1 FOR UPDATE
    `, [scope.tenantId, scope.workspaceId, input.artifactType, externalId])
    const previous = latest.rows[0] as ArtifactRow | undefined
    if (previous?.content_hash === contentHash) return toArtifact(previous)

    const revision = previous ? Number(previous.revision) + 1 : 1
    const reportKey = previous?.report_key ?? randomBytes(32).toString('hex')
    const metadata = {
      ...(input.metadata ?? {}),
      actorId,
      anchoredAt: new Date().toISOString(),
    }
    const { rows } = await client.query(`
      INSERT INTO integrity_artifact_anchors (
        id, tenant_id, workspace_id, artifact_type, external_id, revision,
        report_key, content_hash, previous_hash, schema_version, visibility, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      RETURNING *
    `, [
      `integrity-artifact-${randomUUID()}`,
      scope.tenantId,
      scope.workspaceId,
      input.artifactType,
      externalId,
      revision,
      reportKey,
      contentHash,
      previous?.content_hash ?? null,
      schemaVersion,
      visibility,
      JSON.stringify(metadata),
    ])
    return toArtifact(rows[0] as ArtifactRow)
  })
}

export async function listIntegrityArtifacts(
  scope: IntegrityScope,
  artifactType?: IntegrityArtifactType,
  limit = 100,
): Promise<IntegrityArtifactAnchor[]> {
  return runTenantOperation(scope.tenantId, async client => {
    const { rows } = await client.query(`
      SELECT DISTINCT ON (artifact_type, external_id) *
      FROM integrity_artifact_anchors
      WHERE tenant_id = $1 AND workspace_id = $2
        AND ($3::text IS NULL OR artifact_type = $3)
      ORDER BY artifact_type, external_id, revision DESC
      LIMIT $4
    `, [scope.tenantId, scope.workspaceId, artifactType ?? null, Math.max(1, Math.min(500, limit))])
    return (rows as ArtifactRow[]).map(toArtifact)
  })
}

export async function getIntegrityArtifactHistory(
  scope: IntegrityScope,
  artifactType: IntegrityArtifactType,
  externalId: string,
): Promise<IntegrityArtifactAnchor[]> {
  return runTenantOperation(scope.tenantId, async client => {
    const { rows } = await client.query(`
      SELECT * FROM integrity_artifact_anchors
      WHERE tenant_id = $1 AND workspace_id = $2 AND artifact_type = $3 AND external_id = $4
      ORDER BY revision DESC
    `, [scope.tenantId, scope.workspaceId, artifactType, externalId])
    return (rows as ArtifactRow[]).map(toArtifact)
  })
}

export interface ArtifactJob {
  id: string
  tenant_id: string
  workspace_id: string
  external_id: string
  report_key: string
  revision: number
  content_hash: string
  previous_hash?: string
  schema_version: number
  attempts: number
}

export async function claimNextArtifactJob(): Promise<ArtifactJob | undefined> {
  const { rows } = await query(`
    UPDATE integrity_artifact_anchors
    SET status = 'submitting', attempts = attempts + 1, locked_at = now(), updated_at = now()
    WHERE id = (
      SELECT candidate.id FROM integrity_artifact_anchors candidate
      WHERE candidate.available_at <= now()
        AND (candidate.status = 'pending'
          OR (candidate.status = 'submitting' AND candidate.locked_at < now() - interval '2 minutes'))
        AND (candidate.revision = 1 OR EXISTS (
          SELECT 1 FROM integrity_artifact_anchors previous
          WHERE previous.tenant_id = candidate.tenant_id
            AND previous.workspace_id = candidate.workspace_id
            AND previous.artifact_type = candidate.artifact_type
            AND previous.external_id = candidate.external_id
            AND previous.revision = candidate.revision - 1
            AND previous.status = 'confirmed'
        ))
      ORDER BY candidate.created_at FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING *
  `)
  return rows[0] as ArtifactJob | undefined
}

export async function confirmArtifactJob(job: ArtifactJob, transactionHash: string, ledgerSequence: number) {
  return runTenantOperation(job.tenant_id, client => client.query(`
    UPDATE integrity_artifact_anchors
    SET status = 'confirmed', transaction_hash = $2, ledger_sequence = $3,
        confirmed_at = now(), locked_at = NULL, last_error = NULL, updated_at = now()
    WHERE id = $1
  `, [job.id, transactionHash, ledgerSequence]))
}

export async function failArtifactJob(job: ArtifactJob, error: unknown, maxAttempts: number) {
  const message = (error instanceof Error ? error.message : 'Unknown Stellar submission error').slice(0, 2_000)
  const exhausted = job.attempts >= maxAttempts
  const retryDelaySeconds = Math.min(300, 2 ** Math.min(job.attempts, 8))
  await runTenantOperation(job.tenant_id, client => client.query(`
    UPDATE integrity_artifact_anchors
    SET status = $2, available_at = now() + ($3 * interval '1 second'),
        locked_at = NULL, last_error = $4, updated_at = now()
    WHERE id = $1
  `, [job.id, exhausted ? 'failed' : 'pending', retryDelaySeconds, message]))
}

export async function getPublicArtifactByReceipt(receipt: string) {
  const { rows } = await query(`
    SELECT * FROM integrity_artifact_anchors
    WHERE report_key = $1 AND visibility = 'public'
    ORDER BY revision ASC
  `, [receipt])
  return (rows as ArtifactRow[]).map(toArtifact)
}

export async function listArtifactAnchorsDueForTtl(limit: number) {
  const { rows } = await query(`
    SELECT id, tenant_id, workspace_id, report_key, revision
    FROM integrity_artifact_anchors
    WHERE status = 'confirmed'
      AND COALESCE(ttl_extended_at, confirmed_at) < now() - ($1 * interval '1 day')
    ORDER BY COALESCE(ttl_extended_at, confirmed_at), confirmed_at LIMIT $2
  `, [stellarIntegrityConfig.ttlRefreshDays, limit])
  return rows as Array<{
    id: string
    tenant_id: string
    workspace_id: string
    report_key: string
    revision: number
  }>
}

export async function markArtifactTtlExtended(tenantId: string, id: string) {
  await runTenantOperation(tenantId, client => client.query(`
    UPDATE integrity_artifact_anchors
    SET ttl_extended_at = now(), updated_at = now() WHERE id = $1
  `, [id]))
}
