import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: path.resolve(process.cwd(), 'backend', '.env') })

const samples = Math.max(1, Math.min(100, Number(process.env.STELLAR_INTEGRITY_COST_SAMPLES) || 5))
const { estimateReportAnchorCost } = await import('../src/integrity/stellarClient')
const { stellarIntegrityConfig } = await import('../src/integrity/config')
const measurements: Array<{ minimumResourceFeeStroops: string; latestLedger: number }> = []
const startedAt = Date.now()
for (let index = 0; index < samples; index += 1) {
  measurements.push(await estimateReportAnchorCost({
    reportKey: randomBytes(32).toString('hex'),
    revision: 1,
    contentHash: randomBytes(32).toString('hex'),
    schemaVersion: 1,
  }))
}
const fees = measurements.map(item => BigInt(item.minimumResourceFeeStroops))
const total = fees.reduce((sum, fee) => sum + fee, 0n)
console.log(JSON.stringify({
  measuredAt: new Date().toISOString(),
  network: stellarIntegrityConfig.network,
  contractId: stellarIntegrityConfig.contractId,
  samples,
  elapsedMs: Date.now() - startedAt,
  minimumResourceFeeStroops: {
    min: fees.reduce((min, fee) => fee < min ? fee : min).toString(),
    max: fees.reduce((max, fee) => fee > max ? fee : max).toString(),
    average: (total / BigInt(fees.length)).toString(),
  },
  measurements,
}, null, 2))
