import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import test from 'node:test'

import { config } from 'dotenv'
import { Pool } from 'pg'

import type { FieldReport } from '../../shared/fieldReports'
import { enqueueReportIntegrity, enqueueReviewAttestation } from '../src/integrity/integrityRepository'

config({ path: path.resolve(process.cwd(), 'backend', '.env') })

test('creates report and integrity outbox records in the same transaction', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  const suffix = randomUUID()
  const tenantId = `tenant-integrity-${suffix}`
  const workspaceId = `workspace-integrity-${suffix}`
  const reportId = `FR-INTEGRITY-${suffix}`
  const now = new Date().toISOString()
  const report: FieldReport = {
    id: reportId,
    clientId: `client-${suffix}`,
    title: 'Transactional outbox test',
    observation: 'This transaction is rolled back after its assertions.',
    topic: 'Integrity',
    severity: 'low',
    evidenceType: 'document',
    status: 'submitted',
    location: { label: 'Test' },
    reporter: { id: 'test', displayName: 'Test' },
    attachments: [],
    occurredAt: now,
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
    sync: { state: 'synced', retryCount: 0 },
  }

  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId])
    await client.query('INSERT INTO tenants (id, slug) VALUES ($1, $2)', [tenantId, tenantId])
    await client.query(
      'INSERT INTO workspaces (id, tenant_id, slug) VALUES ($1, $2, $3)',
      [workspaceId, tenantId, workspaceId],
    )
    await client.query(`
      INSERT INTO field_reports (id, tenant_id, workspace_id, client_id, payload)
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `, [reportId, tenantId, workspaceId, report.clientId, JSON.stringify(report)])

    const integrity = await enqueueReportIntegrity(client, { tenantId, workspaceId }, report)
    const attestedReport = {
      ...report,
      status: 'verified' as const,
      updatedAt: new Date(Date.parse(now) + 1_000).toISOString(),
    }
    const attestation = await enqueueReviewAttestation(
      client,
      { tenantId, workspaceId },
      attestedReport,
      'verified',
      'reviewer-test',
    )
    const result = await client.query(
      'SELECT count(*)::integer AS count FROM report_integrity_outbox WHERE report_id = $1',
      [reportId],
    )

    assert.equal(integrity.status, 'pending')
    assert.equal(attestation.revision, 2)
    assert.equal(attestation.anchorType, 'review-attestation')
    assert.equal(attestation.previousHash, integrity.contentHash)
    assert.equal(result.rows[0].count, 2)
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
    client.release()
    await pool.end()
  }
})
