import { randomUUID } from 'node:crypto'
import { rpc } from '@stellar/stellar-sdk'

import { query, runTenantOperation } from '../db'
import { stellarIntegrityConfig } from './config'
import { readReportAnchor } from './stellarClient'

export type IntegritySubjectType = 'field-report' | 'artifact' | 'worker'

export async function recordIntegrityIncident(input: {
  tenantId: string
  workspaceId: string
  severity: 'warning' | 'critical'
  code: string
  subjectType: IntegritySubjectType
  subjectId: string
  message: string
  details?: Record<string, unknown>
}) {
  await runTenantOperation(input.tenantId, client => client.query(`
    INSERT INTO integrity_incidents (
      id, tenant_id, workspace_id, severity, code, subject_type, subject_id, message, details
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    ON CONFLICT (tenant_id, workspace_id, code, subject_type, subject_id)
      WHERE resolved_at IS NULL
    DO UPDATE SET severity = EXCLUDED.severity, message = EXCLUDED.message,
      details = EXCLUDED.details, updated_at = now()
  `, [
    `integrity-incident-${randomUUID()}`,
    input.tenantId,
    input.workspaceId,
    input.severity,
    input.code,
    input.subjectType,
    input.subjectId,
    input.message,
    JSON.stringify(input.details ?? {}),
  ]))

  if (stellarIntegrityConfig.alertWebhookUrl) {
    try {
      const response = await fetch(stellarIntegrityConfig.alertWebhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(stellarIntegrityConfig.alertWebhookToken
            ? { authorization: `Bearer ${stellarIntegrityConfig.alertWebhookToken}` }
            : {}),
        },
        body: JSON.stringify({
          source: 'votes-pulse-stellar-integrity',
          occurredAt: new Date().toISOString(),
          ...input,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) console.error(`Integrity alert webhook returned ${response.status}.`)
    } catch (error) {
      console.error('Unable to deliver integrity alert webhook:', error)
    }
  }
}

export async function resolveIntegrityIncident(
  tenantId: string,
  code: string,
  subjectType: IntegritySubjectType,
  subjectId: string,
) {
  await runTenantOperation(tenantId, client => client.query(`
    UPDATE integrity_incidents SET resolved_at = now(), updated_at = now()
    WHERE tenant_id = $1 AND code = $2 AND subject_type = $3
      AND subject_id = $4 AND resolved_at IS NULL
  `, [tenantId, code, subjectType, subjectId]))
}

interface ReconciliationCandidate {
  source: 'field-report' | 'artifact'
  id: string
  tenant_id: string
  workspace_id: string
  report_key: string
  revision: number
  content_hash: string
  previous_hash?: string
}

export async function reconcileIntegrityBatch(limit = stellarIntegrityConfig.reconciliationBatchSize) {
  const { rows } = await query(`
    SELECT * FROM (
      SELECT 'field-report' AS source, id, tenant_id, workspace_id, report_key,
             revision, content_hash, previous_hash, last_reconciled_at, confirmed_at
      FROM report_integrity_anchors WHERE status = 'confirmed'
      UNION ALL
      SELECT 'artifact' AS source, id, tenant_id, workspace_id, report_key,
             revision, content_hash, previous_hash, last_reconciled_at, confirmed_at
      FROM integrity_artifact_anchors WHERE status = 'confirmed'
    ) candidates
    ORDER BY last_reconciled_at NULLS FIRST, confirmed_at
    LIMIT $1
  `, [limit])
  let verified = 0
  let failed = 0
  for (const candidate of rows as ReconciliationCandidate[]) {
    const table = candidate.source === 'field-report'
      ? 'report_integrity_anchors'
      : 'integrity_artifact_anchors'
    const subjectId = candidate.id
    try {
      const onChain = await readReportAnchor(candidate.report_key, Number(candidate.revision))
      const status = !onChain
        ? 'missing'
        : onChain.contentHash !== candidate.content_hash ||
            (Number(candidate.revision) > 1 && onChain.previousHash !== candidate.previous_hash)
          ? 'mismatch'
          : 'verified'
      await runTenantOperation(candidate.tenant_id, client => client.query(`
        UPDATE ${table}
        SET last_reconciled_at = now(), reconciliation_status = $2,
            reconciliation_error = NULL, updated_at = now()
        WHERE id = $1
      `, [candidate.id, status]))
      if (status === 'verified') {
        verified += 1
        await resolveIntegrityIncident(candidate.tenant_id, 'anchor-reconciliation', candidate.source, subjectId)
      } else {
        failed += 1
        await recordIntegrityIncident({
          tenantId: candidate.tenant_id,
          workspaceId: candidate.workspace_id,
          severity: 'critical',
          code: 'anchor-reconciliation',
          subjectType: candidate.source,
          subjectId,
          message: `Stellar anchor reconciliation returned ${status}.`,
          details: { revision: candidate.revision, reportKey: candidate.report_key },
        })
      }
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : 'Unknown reconciliation error'
      await runTenantOperation(candidate.tenant_id, client => client.query(`
        UPDATE ${table}
        SET last_reconciled_at = now(), reconciliation_status = 'error',
            reconciliation_error = $2, updated_at = now()
        WHERE id = $1
      `, [candidate.id, message.slice(0, 2_000)]))
      await recordIntegrityIncident({
        tenantId: candidate.tenant_id,
        workspaceId: candidate.workspace_id,
        severity: 'warning',
        code: 'anchor-reconciliation',
        subjectType: candidate.source,
        subjectId,
        message,
      })
    }
  }
  return { checked: rows.length, verified, failed }
}

export async function listIntegrityIncidents(tenantId: string, workspaceId: string, limit = 100) {
  return runTenantOperation(tenantId, async client => {
    const { rows } = await client.query(`
      SELECT id, severity, code, subject_type, subject_id, message, details,
             created_at, updated_at
      FROM integrity_incidents
      WHERE tenant_id = $1 AND workspace_id = $2 AND resolved_at IS NULL
      ORDER BY CASE severity WHEN 'critical' THEN 0 ELSE 1 END, updated_at DESC
      LIMIT $3
    `, [tenantId, workspaceId, Math.max(1, Math.min(500, limit))])
    return rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      severity: String(row.severity),
      code: String(row.code),
      subjectType: String(row.subject_type),
      subjectId: String(row.subject_id),
      message: String(row.message),
      details: row.details,
      createdAt: new Date(String(row.created_at)).toISOString(),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    }))
  })
}

export async function ingestIntegrityEvents() {
  const server = new rpc.Server(stellarIntegrityConfig.rpcUrl)
  const cursorResult = await query(`
    SELECT cursor FROM integrity_event_cursors WHERE network = $1 AND contract_id = $2
  `, [stellarIntegrityConfig.network, stellarIntegrityConfig.contractId])
  const savedCursor = cursorResult.rows[0]?.cursor as string | undefined
  let request: rpc.Api.GetEventsRequest
  if (savedCursor) {
    request = {
      filters: [{ type: 'contract', contractIds: [stellarIntegrityConfig.contractId] }],
      cursor: savedCursor,
      limit: 100,
    }
  } else {
    const latest = await server.getLatestLedger()
    request = {
      filters: [{ type: 'contract', contractIds: [stellarIntegrityConfig.contractId] }],
      startLedger: stellarIntegrityConfig.eventStartLedger || latest.sequence,
      limit: 100,
    }
  }
  const page = await server.getEvents(request)
  for (const event of page.events) {
    await query(`
      INSERT INTO integrity_contract_events (
        id, network, contract_id, ledger_sequence, ledger_closed_at,
        transaction_hash, event_type, topics_xdr, value_xdr
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      ON CONFLICT (id) DO NOTHING
    `, [
      event.id,
      stellarIntegrityConfig.network,
      stellarIntegrityConfig.contractId,
      event.ledger,
      event.ledgerClosedAt,
      event.txHash,
      event.type,
      JSON.stringify(event.topic.map(topic => topic.toXDR('base64'))),
      event.value.toXDR('base64'),
    ])
  }
  await query(`
    INSERT INTO integrity_event_cursors (network, contract_id, cursor, latest_ledger)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (network, contract_id) DO UPDATE
      SET cursor = EXCLUDED.cursor, latest_ledger = EXCLUDED.latest_ledger, updated_at = now()
  `, [stellarIntegrityConfig.network, stellarIntegrityConfig.contractId, page.cursor, page.latestLedger])
  return { ingested: page.events.length, latestLedger: page.latestLedger }
}

export async function setWorkerIncident(
  code: string,
  message?: string,
) {
  const { rows } = await query(`SELECT tenant_id, id AS workspace_id FROM workspaces`)
  for (const row of rows as Array<{ tenant_id: string; workspace_id: string }>) {
    if (message) {
      await recordIntegrityIncident({
        tenantId: row.tenant_id,
        workspaceId: row.workspace_id,
        severity: 'warning',
        code,
        subjectType: 'worker',
        subjectId: code,
        message,
      })
    } else {
      await resolveIntegrityIncident(row.tenant_id, code, 'worker', code)
    }
  }
}
