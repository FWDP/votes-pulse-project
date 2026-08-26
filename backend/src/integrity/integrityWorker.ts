import { dbEnabled, query, runTenantOperation } from '../db'
import type { FieldReportIntegrityAnchorType } from '../../../shared/fieldReports'
import { stellarIntegrityConfig, stellarIntegrityReady } from './config'
import { submitReportAnchor, type AnchorSubmission } from './stellarClient'

interface OutboxJob {
  id: string
  tenant_id: string
  report_key: string
  revision: number
  content_hash: string
  previous_hash?: string
  anchor_type?: FieldReportIntegrityAnchorType
  schema_version: number
  attempts: number
}

type SubmitAnchor = (input: AnchorSubmission) => Promise<{
  transactionHash: string
  ledgerSequence: number
}>

const claimNextJob = async (): Promise<OutboxJob | undefined> => {
  const { rows } = await query(`
    UPDATE report_integrity_outbox
    SET status = 'submitting', attempts = attempts + 1,
        locked_at = now(), updated_at = now()
    WHERE id = (
      SELECT candidate.id FROM report_integrity_outbox candidate
      WHERE candidate.available_at <= now()
        AND (
          candidate.status = 'pending'
          OR (candidate.status = 'submitting' AND candidate.locked_at < now() - interval '2 minutes')
        )
        AND (
          candidate.revision = 1
          OR EXISTS (
            SELECT 1 FROM report_integrity_outbox previous
            WHERE previous.tenant_id = candidate.tenant_id
              AND previous.workspace_id = candidate.workspace_id
              AND previous.report_id = candidate.report_id
              AND previous.revision = candidate.revision - 1
              AND previous.status = 'confirmed'
          )
        )
      ORDER BY candidate.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `)
  const job = rows[0] as OutboxJob | undefined
  if (job) {
    await runTenantOperation(job.tenant_id, client => client.query(`
        UPDATE report_integrity_anchors
        SET status = 'submitting', attempts = $2, last_error = NULL,
            submitted_at = now(), updated_at = now()
        WHERE outbox_id = $1
      `, [job.id, job.attempts]))
  }
  return job
}

const confirmJob = async (job: OutboxJob, transactionHash: string, ledgerSequence: number) => {
  await runTenantOperation(job.tenant_id, async client => {
    await client.query(`
      UPDATE report_integrity_outbox
      SET status = 'confirmed', locked_at = NULL, last_error = NULL, updated_at = now()
      WHERE id = $1
    `, [job.id])
    await client.query(`
      UPDATE report_integrity_anchors
      SET status = 'confirmed', contract_id = $2, transaction_hash = $3,
          ledger_sequence = $4, confirmed_at = now(), last_error = NULL, updated_at = now()
      WHERE outbox_id = $1
    `, [job.id, stellarIntegrityConfig.contractId, transactionHash, ledgerSequence])
  })
}

const failJob = async (job: OutboxJob, error: unknown) => {
  const message = (error instanceof Error ? error.message : 'Unknown Stellar submission error').slice(0, 2_000)
  const exhausted = job.attempts >= stellarIntegrityConfig.maxAttempts
  const retryDelaySeconds = Math.min(300, 2 ** Math.min(job.attempts, 8))
  await runTenantOperation(job.tenant_id, async client => {
    await client.query(`
      UPDATE report_integrity_outbox
      SET status = $2, available_at = now() + ($3 * interval '1 second'),
          locked_at = NULL, last_error = $4, updated_at = now()
      WHERE id = $1
    `, [job.id, exhausted ? 'failed' : 'pending', retryDelaySeconds, message])
    await client.query(`
      UPDATE report_integrity_anchors
      SET status = $2, last_error = $3, attempts = $4, updated_at = now()
      WHERE outbox_id = $1
    `, [job.id, exhausted ? 'failed' : 'pending', message, job.attempts])
  })
}

export async function processIntegrityOutboxBatch(
  limit = 10,
  submit: SubmitAnchor = submitReportAnchor,
) {
  let processed = 0
  for (; processed < limit; processed += 1) {
    const job = await claimNextJob()
    if (!job) break
    try {
      const confirmation = await submit({
        reportKey: job.report_key,
        revision: job.revision,
        contentHash: job.content_hash,
        previousHash: job.previous_hash,
        schemaVersion: job.schema_version,
        anchorType: job.anchor_type,
      })
      await confirmJob(job, confirmation.transactionHash, confirmation.ledgerSequence)
    } catch (error) {
      console.error(`Unable to anchor integrity outbox job ${job.id}:`, error)
      await failJob(job, error)
    }
  }
  return processed
}

let workerTimer: NodeJS.Timeout | undefined
let workerRunning = false

export const startIntegrityWorker = () => {
  if (!dbEnabled || !stellarIntegrityReady() || workerTimer) return false
  const run = async () => {
    if (workerRunning) return
    workerRunning = true
    try {
      await processIntegrityOutboxBatch()
    } catch (error) {
      console.error('Report integrity worker failed:', error)
    } finally {
      workerRunning = false
    }
  }
  workerTimer = setInterval(() => { void run() }, stellarIntegrityConfig.workerIntervalMs)
  workerTimer.unref()
  void run()
  return true
}

export const stopIntegrityWorker = () => {
  if (workerTimer) clearInterval(workerTimer)
  workerTimer = undefined
}
