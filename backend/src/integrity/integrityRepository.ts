import { randomBytes, randomUUID } from 'node:crypto'

import type {
  FieldReport,
  FieldReportIntegrity,
  FieldReportIntegrityAnchorType,
  FieldReportIntegrityRevision,
  FieldReportStatus,
} from '../../../shared/fieldReports'
import { runTenantOperation } from '../db'
import { hashReportForIntegrity, hashReviewAttestation } from './canonicalizeReport'
import { stellarIntegrityConfig, stellarIntegrityReady } from './config'

export interface IntegrityScope {
  tenantId: string
  workspaceId: string
}

interface IntegrityRow {
  status: FieldReportIntegrity['status']
  revision: number
  anchor_type?: FieldReportIntegrityAnchorType
  network: string
  contract_id?: string
  report_key: string
  content_hash: string
  previous_hash?: string
  transaction_hash?: string
  ledger_sequence?: number
  attempts: number
  last_error?: string
  confirmed_at?: Date | string
}

const toIntegrity = (row: IntegrityRow): FieldReportIntegrity => ({
  status: row.status,
  revision: row.revision,
  anchorType: row.anchor_type ?? 'report',
  network: row.network,
  contractId: row.contract_id,
  reportKey: row.report_key,
  contentHash: row.content_hash,
  previousHash: row.previous_hash,
  transactionHash: row.transaction_hash,
  ledgerSequence: row.ledger_sequence,
  attempts: row.attempts,
  lastError: row.last_error,
  confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : undefined,
})

const toRevision = (row: IntegrityRow): FieldReportIntegrityRevision => ({
  status: row.status,
  revision: row.revision,
  anchorType: row.anchor_type ?? 'report',
  contentHash: row.content_hash,
  previousHash: row.previous_hash,
  transactionHash: row.transaction_hash,
  ledgerSequence: row.ledger_sequence,
  confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : undefined,
})

export async function enqueueReportIntegrity(
  client: { query: (text: string, values?: unknown[]) => Promise<{ rows: IntegrityRow[] }> },
  scope: IntegrityScope,
  report: FieldReport,
): Promise<FieldReportIntegrity> {
  const revision = 1
  const outboxId = `integrity-outbox-${randomUUID()}`
  const anchorId = `integrity-anchor-${randomUUID()}`
  const reportKey = randomBytes(32).toString('hex')
  const { contentHash, schemaVersion } = hashReportForIntegrity(report)

  const { rows } = await client.query(`
    WITH inserted_outbox AS (
      INSERT INTO report_integrity_outbox (
        id, tenant_id, workspace_id, report_id, revision,
        report_key, content_hash, schema_version, anchor_type, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'report', '{}'::jsonb)
      ON CONFLICT (tenant_id, workspace_id, report_id, revision) DO NOTHING
      RETURNING id
    ), inserted_anchor AS (
      INSERT INTO report_integrity_anchors (
        id, outbox_id, tenant_id, workspace_id, report_id, revision,
        network, contract_id, report_key, content_hash, schema_version, anchor_type, metadata
      )
      SELECT $9, inserted_outbox.id, $2, $3, $4, $5, $10, NULLIF($11, ''), $6, $7, $8, 'report', '{}'::jsonb
      FROM inserted_outbox
      RETURNING *
    )
    SELECT * FROM inserted_anchor
    UNION ALL
    SELECT * FROM report_integrity_anchors
      WHERE tenant_id = $2 AND workspace_id = $3 AND report_id = $4 AND revision = $5
    LIMIT 1
  `, [
    outboxId,
    scope.tenantId,
    scope.workspaceId,
    report.id,
    revision,
    reportKey,
    contentHash,
    schemaVersion,
    anchorId,
    stellarIntegrityConfig.network,
    stellarIntegrityConfig.contractId,
  ])

  if (!rows[0]) throw new Error('Unable to create the report integrity outbox record.')
  return toIntegrity(rows[0])
}

export async function enqueueReviewAttestation(
  client: { query: (text: string, values?: unknown[]) => Promise<{ rows: IntegrityRow[] }> },
  scope: IntegrityScope,
  report: FieldReport,
  status: FieldReportStatus,
  actorId: string,
): Promise<FieldReportIntegrity> {
  const latest = await client.query(`
    SELECT * FROM report_integrity_anchors
    WHERE tenant_id = $1 AND workspace_id = $2 AND report_id = $3
    ORDER BY revision DESC
    LIMIT 1
    FOR UPDATE
  `, [scope.tenantId, scope.workspaceId, report.id])
  const previous = latest.rows[0]
  if (!previous) throw new Error('Cannot attest a report before its initial integrity anchor exists.')

  const revision = previous.revision + 1
  const previousHash = previous.content_hash
  const attestedAt = report.updatedAt
  const { contentHash, schemaVersion } = hashReviewAttestation({
    reportId: report.id,
    revision,
    status,
    actorId,
    attestedAt,
    previousHash,
  })
  const outboxId = `integrity-outbox-${randomUUID()}`
  const anchorId = `integrity-anchor-${randomUUID()}`
  const metadata = JSON.stringify({ status, actorId, attestedAt })

  const { rows } = await client.query(`
    WITH inserted_outbox AS (
      INSERT INTO report_integrity_outbox (
        id, tenant_id, workspace_id, report_id, revision, report_key,
        content_hash, previous_hash, schema_version, anchor_type, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'review-attestation', $10::jsonb)
      ON CONFLICT (tenant_id, workspace_id, report_id, revision) DO NOTHING
      RETURNING id
    ), inserted_anchor AS (
      INSERT INTO report_integrity_anchors (
        id, outbox_id, tenant_id, workspace_id, report_id, revision, network,
        contract_id, report_key, content_hash, previous_hash, schema_version,
        anchor_type, metadata
      )
      SELECT $11, inserted_outbox.id, $2, $3, $4, $5, $12, NULLIF($13, ''),
             $6, $7, $8, $9, 'review-attestation', $10::jsonb
      FROM inserted_outbox
      RETURNING *
    )
    SELECT * FROM inserted_anchor
    UNION ALL
    SELECT * FROM report_integrity_anchors
      WHERE tenant_id = $2 AND workspace_id = $3 AND report_id = $4 AND revision = $5
    LIMIT 1
  `, [
    outboxId,
    scope.tenantId,
    scope.workspaceId,
    report.id,
    revision,
    previous.report_key,
    contentHash,
    previousHash,
    schemaVersion,
    metadata,
    anchorId,
    stellarIntegrityConfig.network,
    stellarIntegrityConfig.contractId,
  ])
  if (!rows[0]) throw new Error('Unable to create the review attestation outbox record.')
  return toIntegrity(rows[0])
}

export async function attachIntegritiesToReports(
  client: { query: (text: string, values?: unknown[]) => Promise<{ rows: Array<IntegrityRow & { report_id: string }> }> },
  scope: IntegrityScope,
  reports: FieldReport[],
): Promise<FieldReport[]> {
  if (!reports.length) return reports
  const { rows } = await client.query(`
    SELECT DISTINCT ON (report_id) *
    FROM report_integrity_anchors
    WHERE tenant_id = $1 AND workspace_id = $2 AND report_id = ANY($3::text[])
    ORDER BY report_id, revision DESC
  `, [scope.tenantId, scope.workspaceId, reports.map(report => report.id)])
  const byReport = new Map(rows.map(row => [row.report_id, toIntegrity(row)]))
  return reports.map(report => ({ ...report, integrity: byReport.get(report.id) }))
}

export async function getReportIntegrity(
  scope: IntegrityScope,
  report: FieldReport,
): Promise<FieldReportIntegrity | undefined> {
  return runTenantOperation(scope.tenantId, async client => {
    const { rows } = await client.query(`
      SELECT * FROM report_integrity_anchors
      WHERE tenant_id = $1 AND workspace_id = $2 AND report_id = $3
      ORDER BY revision DESC
    `, [scope.tenantId, scope.workspaceId, report.id])
    if (!rows[0]) return undefined
    const integrity = toIntegrity(rows[0])
    const history = rows.map(toRevision)
    const oldestFirst = [...history].reverse()
    const chainLinksValid = oldestFirst.every((revision, index) =>
      index === 0
        ? revision.revision === 1 && !revision.previousHash
        : revision.revision === oldestFirst[index - 1]!.revision + 1 &&
          revision.previousHash === oldestFirst[index - 1]!.contentHash,
    )
    const chainValid = oldestFirst.every(revision => revision.status === 'confirmed')
      ? chainLinksValid
      : undefined
    const reportAnchor = rows.find((row: IntegrityRow) => (row.anchor_type ?? 'report') === 'report')
    const currentHash = hashReportForIntegrity(report).contentHash
    return {
      ...integrity,
      matchesCurrentReport: reportAnchor?.status === 'confirmed'
        ? currentHash === reportAnchor.content_hash
        : undefined,
      chainValid,
      history,
    }
  })
}

export async function retryReportIntegrity(scope: IntegrityScope, reportId: string) {
  return runTenantOperation(scope.tenantId, async client => {
    const { rows } = await client.query(`
      UPDATE report_integrity_outbox
      SET status = 'pending', available_at = now(), locked_at = NULL,
          last_error = NULL, updated_at = now()
      WHERE tenant_id = $1 AND workspace_id = $2 AND report_id = $3
        AND status = 'failed'
      RETURNING id
    `, [scope.tenantId, scope.workspaceId, reportId])
    if (!rows[0]) return false
    await client.query(`
      UPDATE report_integrity_anchors
      SET status = 'pending', last_error = NULL, updated_at = now()
      WHERE tenant_id = $1 AND workspace_id = $2 AND report_id = $3
        AND status = 'failed'
    `, [scope.tenantId, scope.workspaceId, reportId])
    return true
  })
}

export async function getIntegrityQueueHealth(scope: IntegrityScope) {
  return runTenantOperation(scope.tenantId, async client => {
    const { rows } = await client.query(`
      SELECT
        count(*) FILTER (WHERE status IN ('pending', 'submitting'))::integer AS pending,
        count(*) FILTER (WHERE status = 'failed')::integer AS failed,
        min(created_at) FILTER (WHERE status IN ('pending', 'submitting')) AS oldest_pending_at
      FROM report_integrity_outbox
      WHERE tenant_id = $1 AND workspace_id = $2
    `, [scope.tenantId, scope.workspaceId])
    return {
      configured: stellarIntegrityReady(),
      enabled: stellarIntegrityConfig.enabled,
      network: stellarIntegrityConfig.network,
      contractId: stellarIntegrityConfig.contractId || undefined,
      pending: rows[0]?.pending ?? 0,
      failed: rows[0]?.failed ?? 0,
      oldestPendingAt: rows[0]?.oldest_pending_at
        ? new Date(rows[0].oldest_pending_at).toISOString()
        : undefined,
    }
  })
}

export async function markReportIntegrityTtlExtended(
  scope: IntegrityScope,
  reportId: string,
  revision: number,
) {
  return runTenantOperation(scope.tenantId, async client => {
    const { rows } = await client.query(`
      UPDATE report_integrity_anchors
      SET ttl_extended_at = now(), updated_at = now()
      WHERE tenant_id = $1 AND workspace_id = $2 AND report_id = $3 AND revision = $4
      RETURNING ttl_extended_at
    `, [scope.tenantId, scope.workspaceId, reportId, revision])
    return rows[0]?.ttl_extended_at
      ? new Date(rows[0].ttl_extended_at).toISOString()
      : undefined
  })
}
