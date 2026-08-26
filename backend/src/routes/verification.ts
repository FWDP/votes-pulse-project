import { Router } from 'express'

import type { PublicIntegrityVerification } from '../../../shared/integrityArtifacts'
import { query } from '../db'
import { stellarIntegrityConfig } from '../integrity/config'
import { getPublicArtifactByReceipt } from '../integrity/artifactRepository'

const router = Router()
const validReceipt = (value: string) => /^[a-f0-9]{64}$/.test(value)

router.get('/:receipt', async (request, response) => {
  const receipt = String(request.params.receipt).toLowerCase()
  if (!validReceipt(receipt)) return response.status(400).json({ error: 'Invalid verification receipt.' })
  try {
    const { rows } = await query(`
      SELECT revision, content_hash, previous_hash, transaction_hash,
             ledger_sequence, confirmed_at, schema_version, status
      FROM report_integrity_anchors
      WHERE report_key = $1 ORDER BY revision ASC
    `, [receipt])
    if (rows.length) {
      const chainValid = rows.every((row: Record<string, unknown>, index: number) =>
        row.status === 'confirmed' &&
        (index === 0
          ? Number(row.revision) === 1 && !row.previous_hash
          : Number(row.revision) === Number(rows[index - 1].revision) + 1 &&
            row.previous_hash === rows[index - 1].content_hash),
      )
      const latest = rows.at(-1)
      const data: PublicIntegrityVerification = {
        verified: chainValid,
        source: 'field-report',
        network: stellarIntegrityConfig.network,
        contractId: stellarIntegrityConfig.contractId || undefined,
        receipt,
        revision: Number(latest.revision),
        contentHash: String(latest.content_hash),
        previousHash: latest.previous_hash ? String(latest.previous_hash) : undefined,
        transactionHash: latest.transaction_hash ? String(latest.transaction_hash) : undefined,
        ledgerSequence: latest.ledger_sequence ? Number(latest.ledger_sequence) : undefined,
        confirmedAt: latest.confirmed_at ? new Date(latest.confirmed_at).toISOString() : undefined,
        chainValid,
        schemaVersion: Number(latest.schema_version),
      }
      return response.json({ data })
    }

    const artifacts = await getPublicArtifactByReceipt(receipt)
    if (!artifacts.length) return response.status(404).json({ error: 'Verification receipt not found.' })
    const chainValid = artifacts.every((anchor, index) => anchor.status === 'confirmed' &&
      (index === 0
        ? anchor.revision === 1 && !anchor.previousHash
        : anchor.revision === artifacts[index - 1]!.revision + 1 &&
          anchor.previousHash === artifacts[index - 1]!.contentHash))
    const latest = artifacts.at(-1)!
    const data: PublicIntegrityVerification = {
      verified: chainValid,
      source: 'artifact',
      artifactType: latest.artifactType,
      network: stellarIntegrityConfig.network,
      contractId: stellarIntegrityConfig.contractId || undefined,
      receipt,
      revision: latest.revision,
      contentHash: latest.contentHash,
      previousHash: latest.previousHash,
      transactionHash: latest.transactionHash,
      ledgerSequence: latest.ledgerSequence,
      confirmedAt: latest.confirmedAt,
      chainValid,
      schemaVersion: latest.schemaVersion,
    }
    return response.json({ data })
  } catch (error) {
    console.error('Unable to verify Stellar receipt:', error)
    return response.status(500).json({ error: 'Unable to verify Stellar receipt.' })
  }
})

export default router
