import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
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
  await runTenantOperation(input.tenantId, async client => {
    const incidentId = `integrity-incident-${randomUUID()}`
    const { rows } = await client.query(`
      INSERT INTO integrity_incidents (
        id, tenant_id, workspace_id, severity, code, subject_type, subject_id, message, details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      ON CONFLICT (tenant_id, workspace_id, code, subject_type, subject_id)
        WHERE resolved_at IS NULL
      DO UPDATE SET severity = EXCLUDED.severity, message = EXCLUDED.message,
        details = EXCLUDED.details, updated_at = now()
      RETURNING id
    `, [
      incidentId, input.tenantId, input.workspaceId, input.severity, input.code,
      input.subjectType, input.subjectId, input.message, JSON.stringify(input.details ?? {}),
    ])
    if (stellarIntegrityConfig.alertWebhookUrl) {
      await client.query(`
        INSERT INTO integrity_alert_outbox (id, incident_id, tenant_id, workspace_id, payload)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        ON CONFLICT (incident_id) DO NOTHING
      `, [
        `integrity-alert-${randomUUID()}`,
        rows[0].id,
        input.tenantId,
        input.workspaceId,
        JSON.stringify({ source: 'votes-pulse-stellar-integrity', occurredAt: new Date().toISOString(), ...input }),
      ])
    }
  })
}

export async function deliverIntegrityAlerts(limit = 10) {
  if (!stellarIntegrityConfig.alertWebhookUrl) return { processed: 0, delivered: 0 }
  const fileToken = stellarIntegrityConfig.alertWebhookTokenFile
    ? (await readFile(stellarIntegrityConfig.alertWebhookTokenFile, 'utf8')).trim()
    : ''
  const token = fileToken || stellarIntegrityConfig.alertWebhookToken
  let processed = 0
  let delivered = 0
  for (; processed < limit; processed += 1) {
    const { rows } = await query(`
      UPDATE integrity_alert_outbox SET status = 'delivering', attempts = attempts + 1,
        locked_at = now(), updated_at = now()
      WHERE id = (
        SELECT id FROM integrity_alert_outbox
        WHERE available_at <= now() AND (
          status = 'pending' OR (status = 'delivering' AND locked_at < now() - interval '2 minutes')
        ) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
      ) RETURNING *
    `)
    const alert = rows[0]
    if (!alert) break
    try {
      const response = await fetch(stellarIntegrityConfig.alertWebhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(alert.payload),
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) throw new Error(`Integrity alert webhook returned HTTP ${response.status}.`)
      await runTenantOperation(alert.tenant_id, client => client.query(`
        UPDATE integrity_alert_outbox SET status = 'delivered', delivered_at = now(),
          locked_at = NULL, last_error = NULL, updated_at = now() WHERE id = $1
      `, [alert.id]))
      delivered += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Alert delivery failed.'
      const exhausted = Number(alert.attempts) >= stellarIntegrityConfig.maxAttempts
      await runTenantOperation(alert.tenant_id, client => client.query(`
        UPDATE integrity_alert_outbox SET status = $2, locked_at = NULL,
          available_at = now() + (LEAST(300, power(2, LEAST(attempts, 8))) * interval '1 second'),
          last_error = $3, updated_at = now() WHERE id = $1
      `, [alert.id, exhausted ? 'failed' : 'pending', message.slice(0, 2_000)]))
    }
  }
  return { processed, delivered }
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
    SELECT cursor, latest_ledger FROM integrity_event_cursors WHERE network = $1 AND contract_id = $2
  `, [stellarIntegrityConfig.network, stellarIntegrityConfig.contractId])
  const savedCursor = cursorResult.rows[0]?.cursor as string | undefined
  const savedLedger = Number(cursorResult.rows[0]?.latest_ledger || 0)
  const health = await server.getHealth()
  if (savedCursor && savedLedger < health.oldestLedger) {
    throw new Error(`Soroban event cursor gap: processed ledger ${savedLedger}, RPC oldest ledger ${health.oldestLedger}. Restore events from an archive before advancing the cursor.`)
  }
  if (!savedCursor && stellarIntegrityConfig.eventStartLedger > 0 &&
      stellarIntegrityConfig.eventStartLedger < health.oldestLedger) {
    throw new Error(`Configured event start ledger ${stellarIntegrityConfig.eventStartLedger} is outside RPC retention; oldest available ledger is ${health.oldestLedger}.`)
  }
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
  let ingested = 0
  let processedLedger = savedLedger
  let latestLedger = health.latestLedger
  let backlogRemaining = false
  for (let pageNumber = 0; pageNumber < stellarIntegrityConfig.eventIngestionMaxPages; pageNumber += 1) {
    const page = await server.getEvents(request)
    latestLedger = page.latestLedger
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
    ingested += page.events.length
    processedLedger = page.events.length === 100
      ? page.events.at(-1)!.ledger
      : page.latestLedger
    await query(`
      INSERT INTO integrity_event_cursors (network, contract_id, cursor, latest_ledger)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (network, contract_id) DO UPDATE
        SET cursor = EXCLUDED.cursor, latest_ledger = EXCLUDED.latest_ledger, updated_at = now()
    `, [stellarIntegrityConfig.network, stellarIntegrityConfig.contractId, page.cursor, processedLedger])
    backlogRemaining = page.events.length === 100
    if (!backlogRemaining) break
    request = {
      filters: [{ type: 'contract', contractIds: [stellarIntegrityConfig.contractId] }],
      cursor: page.cursor,
      limit: 100,
    }
  }
  return { ingested, processedLedger, latestLedger, backlogRemaining }
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
