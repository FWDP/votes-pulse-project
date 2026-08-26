import { randomBytes, randomUUID } from 'node:crypto'

import type {
  FieldReport,
  FieldReportIntegrityAuditEntry,
  FieldReportIntegrity,
  FieldReportIntegrityAnchorType,
  FieldReportIntegrityRevision,
  FieldReportStatus,
} from '../../../shared/fieldReports'
import { query, runTenantOperation } from '../db'
import { hashReportForIntegrity, hashReviewAttestation } from './canonicalizeReport'
import {
  stellarIntegrityConfig,
  stellarIntegrityReady,
  stellarIntegritySignerMode,
} from './config'

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

export async function enqueueReportRevision(
  client: { query: (text: string, values?: unknown[]) => Promise<{ rows: IntegrityRow[] }> },
  scope: IntegrityScope,
  report: FieldReport,
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
  if (!previous) throw new Error('Cannot revise evidence before its initial integrity anchor exists.')

  const revision = previous.revision + 1
  const previousHash = previous.content_hash
  const { contentHash, schemaVersion } = hashReportForIntegrity(report)
  const metadata = JSON.stringify({ actorId, revisedAt: report.updatedAt })
  const outboxId = `integrity-outbox-${randomUUID()}`
  const anchorId = `integrity-anchor-${randomUUID()}`
  const { rows } = await client.query(`
    WITH inserted_outbox AS (
      INSERT INTO report_integrity_outbox (
        id, tenant_id, workspace_id, report_id, revision, report_key,
        content_hash, previous_hash, schema_version, anchor_type, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'report', $10::jsonb)
      ON CONFLICT (tenant_id, workspace_id, report_id, revision) DO NOTHING
      RETURNING id
    ), inserted_anchor AS (
      INSERT INTO report_integrity_anchors (
        id, outbox_id, tenant_id, workspace_id, report_id, revision, network,
        contract_id, report_key, content_hash, previous_hash, schema_version,
        anchor_type, metadata
      )
      SELECT $11, inserted_outbox.id, $2, $3, $4, $5, $12, NULLIF($13, ''),
             $6, $7, $8, $9, 'report', $10::jsonb
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
  if (!rows[0]) throw new Error('Unable to create the evidence revision outbox record.')
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

export async function listConfirmedIntegrityAudit(
  scope: IntegrityScope,
  limit = 200,
): Promise<FieldReportIntegrityAuditEntry[]> {
  return runTenantOperation(scope.tenantId, async client => {
    const { rows } = await client.query(`
      SELECT a.report_id, COALESCE(f.payload->>'title', a.report_id) AS report_title,
             a.revision, a.anchor_type, a.content_hash, a.previous_hash,
             a.transaction_hash, a.ledger_sequence, a.confirmed_at,
             COALESCE(a.metadata->>'actorId', f.payload->'reporter'->>'id') AS actor_id
      FROM report_integrity_anchors a
      JOIN field_reports f
        ON f.tenant_id = a.tenant_id
       AND f.workspace_id = a.workspace_id
       AND f.id = a.report_id
      WHERE a.tenant_id = $1 AND a.workspace_id = $2
        AND a.status = 'confirmed'
        AND a.transaction_hash IS NOT NULL
      ORDER BY a.confirmed_at DESC, a.report_id, a.revision DESC
      LIMIT $3
    `, [scope.tenantId, scope.workspaceId, Math.max(1, Math.min(500, limit))])
    return rows.map((row: Record<string, unknown>) => ({
      reportId: String(row.report_id),
      reportTitle: String(row.report_title),
      revision: Number(row.revision),
      anchorType: String(row.anchor_type) as FieldReportIntegrityAnchorType,
      contentHash: String(row.content_hash),
      previousHash: row.previous_hash ? String(row.previous_hash) : undefined,
      transactionHash: String(row.transaction_hash),
      ledgerSequence: Number(row.ledger_sequence),
      confirmedAt: new Date(String(row.confirmed_at)).toISOString(),
      actorId: row.actor_id ? String(row.actor_id) : undefined,
    }))
  })
}

export async function getIntegrityQueueHealth(scope: IntegrityScope) {
  return runTenantOperation(scope.tenantId, async client => {
    const { rows } = await client.query(`
      SELECT
        count(*) FILTER (WHERE status IN ('pending', 'submitting'))::integer AS pending,
        count(*) FILTER (
          WHERE status IN ('pending', 'submitting')
            AND created_at < now() - ($3 * interval '1 second')
        )::integer AS stale_pending,
        count(*) FILTER (WHERE status = 'failed')::integer AS failed,
        min(created_at) FILTER (WHERE status IN ('pending', 'submitting')) AS oldest_pending_at
      FROM report_integrity_outbox
      WHERE tenant_id = $1 AND workspace_id = $2
    `, [scope.tenantId, scope.workspaceId, stellarIntegrityConfig.pendingAlertSeconds])
    const ttl = await client.query(`
      SELECT count(*)::integer AS due
      FROM report_integrity_anchors
      WHERE tenant_id = $1 AND workspace_id = $2 AND status = 'confirmed'
        AND COALESCE(ttl_extended_at, confirmed_at) < now() - ($3 * interval '1 day')
    `, [scope.tenantId, scope.workspaceId, stellarIntegrityConfig.ttlRefreshDays])
    const artifacts = await client.query(`
      SELECT
        count(*) FILTER (WHERE status IN ('pending', 'submitting'))::integer AS pending,
        count(*) FILTER (WHERE reconciliation_status IN ('missing', 'mismatch', 'error'))::integer AS reconciliation_failures
      FROM integrity_artifact_anchors
      WHERE tenant_id = $1 AND workspace_id = $2
    `, [scope.tenantId, scope.workspaceId])
    const incidents = await client.query(`
      SELECT count(*)::integer AS open FROM integrity_incidents
      WHERE tenant_id = $1 AND workspace_id = $2 AND resolved_at IS NULL
    `, [scope.tenantId, scope.workspaceId])
    const reportReconciliation = await client.query(`
      SELECT count(*)::integer AS failures FROM report_integrity_anchors
      WHERE tenant_id = $1 AND workspace_id = $2
        AND reconciliation_status IN ('missing', 'mismatch', 'error')
    `, [scope.tenantId, scope.workspaceId])
    const eventCursor = await query(`
      SELECT updated_at FROM integrity_event_cursors
      WHERE network = $1 AND contract_id = $2
    `, [stellarIntegrityConfig.network, stellarIntegrityConfig.contractId])
    const pending = rows[0]?.pending ?? 0
    const stalePending = rows[0]?.stale_pending ?? 0
    const failed = rows[0]?.failed ?? 0
    const ttlDue = ttl.rows[0]?.due ?? 0
    const artifactPending = artifacts.rows[0]?.pending ?? 0
    const reconciliationFailures = (artifacts.rows[0]?.reconciliation_failures ?? 0) +
      (reportReconciliation.rows[0]?.failures ?? 0)
    const openIncidents = incidents.rows[0]?.open ?? 0
    const eventLastIngestedAt = eventCursor.rows[0]?.updated_at
      ? new Date(eventCursor.rows[0].updated_at).toISOString()
      : undefined
    const eventIngestionStale = stellarIntegrityConfig.eventIngestionEnabled && (!eventLastIngestedAt ||
      Date.now() - Date.parse(eventLastIngestedAt) > stellarIntegrityConfig.eventIngestionIntervalMs * 3)
    const alerts = [
      ...(stalePending ? [`${stalePending} integrity job(s) have exceeded the pending threshold.`] : []),
      ...(failed ? [`${failed} integrity job(s) require operator retry.`] : []),
      ...(ttlDue ? [`${ttlDue} confirmed anchor(s) are due for TTL maintenance.`] : []),
      ...(reconciliationFailures ? [`${reconciliationFailures} artifact anchor(s) failed reconciliation.`] : []),
      ...(openIncidents ? [`${openIncidents} integrity incident(s) require attention.`] : []),
      ...(eventIngestionStale ? ['Soroban event ingestion has not advanced within the expected interval.'] : []),
    ]
    return {
      configured: stellarIntegrityReady(),
      enabled: stellarIntegrityConfig.enabled,
      healthy: stellarIntegrityReady() && stalePending === 0 && failed === 0 && reconciliationFailures === 0 && openIncidents === 0 && !eventIngestionStale,
      network: stellarIntegrityConfig.network,
      contractId: stellarIntegrityConfig.contractId || undefined,
      signerMode: stellarIntegritySignerMode(),
      pending,
      stalePending,
      failed,
      ttlDue,
      artifactPending,
      reconciliationFailures,
      openIncidents,
      eventLastIngestedAt,
      alerts,
      oldestPendingAt: rows[0]?.oldest_pending_at
        ? new Date(rows[0].oldest_pending_at).toISOString()
        : undefined,
    }
  })
}

export interface IntegrityTtlCandidate {
  tenantId: string
  workspaceId: string
  reportId: string
  reportKey: string
  revision: number
}

export async function listIntegrityAnchorsDueForTtl(limit: number): Promise<IntegrityTtlCandidate[]> {
  const { rows } = await query(`
    SELECT tenant_id, workspace_id, report_id, report_key, revision
    FROM report_integrity_anchors
    WHERE status = 'confirmed'
      AND COALESCE(ttl_extended_at, confirmed_at) < now() - ($1 * interval '1 day')
    ORDER BY COALESCE(ttl_extended_at, confirmed_at), confirmed_at
    LIMIT $2
  `, [stellarIntegrityConfig.ttlRefreshDays, limit])
  return rows.map((row: Record<string, unknown>) => ({
    tenantId: String(row.tenant_id),
    workspaceId: String(row.workspace_id),
    reportId: String(row.report_id),
    reportKey: String(row.report_key),
    revision: Number(row.revision),
  }))
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
