import { Router } from 'express'

import type { PublicIntegrityVerification } from '../../../shared/integrityArtifacts'
import { query } from '../db'
import { stellarIntegrityConfig } from '../integrity/config'
import { getPublicArtifactByReceipt } from '../integrity/artifactRepository'
import { readReportAnchor } from '../integrity/stellarClient'

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
      const onChain = await Promise.all(rows.map((row: Record<string, unknown>) =>
        readReportAnchor(receipt, Number(row.revision))))
      const onChainVerified = rows.every((row: Record<string, unknown>, index: number) => {
        const anchor = onChain[index]
        return Boolean(anchor &&
          anchor.contentHash === row.content_hash &&
          anchor.schemaVersion === Number(row.schema_version) &&
          (Number(row.revision) === 1 || anchor.previousHash === row.previous_hash))
      })
      const data: PublicIntegrityVerification = {
        verified: chainValid && onChainVerified,
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
        onChainVerified,
        verifiedAt: new Date().toISOString(),
      }
      response.set('Cache-Control', 'public, max-age=30')
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
    const onChain = await Promise.all(artifacts.map(anchor => readReportAnchor(receipt, anchor.revision)))
    const onChainVerified = artifacts.every((anchor, index) => Boolean(onChain[index] &&
      onChain[index]!.contentHash === anchor.contentHash &&
      onChain[index]!.schemaVersion === anchor.schemaVersion &&
      (anchor.revision === 1 || onChain[index]!.previousHash === anchor.previousHash)))
    const data: PublicIntegrityVerification = {
      verified: chainValid && onChainVerified,
      source: 'artifact',
      artifactType: latest.artifactType,
      network: stellarIntegrityConfig.network,
      contractId: stellarIntegrityConfig.contractId || undefined,
      receipt,
      revision: latest.revision,
      contentHash: latest.contentHash,
      subjectHash: latest.subjectHash,
      previousHash: latest.previousHash,
      transactionHash: latest.transactionHash,
      ledgerSequence: latest.ledgerSequence,
      confirmedAt: latest.confirmedAt,
      chainValid,
      schemaVersion: latest.schemaVersion,
      onChainVerified,
      verifiedAt: new Date().toISOString(),
    }
    response.set('Cache-Control', 'public, max-age=30')
    return response.json({ data })
  } catch (error) {
    console.error('Unable to verify Stellar receipt:', error)
    return response.status(503).json({ error: 'Unable to independently verify this receipt against Stellar.' })
  }
})

export default router
