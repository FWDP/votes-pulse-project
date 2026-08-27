import path from 'node:path'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: path.resolve(process.cwd(), 'backend', '.env') })

const gateId = process.argv[2]?.trim() || process.env.STELLAR_INTEGRITY_RELEASE_GATE_ID?.trim()
if (!gateId) {
  console.error('Usage: npm run integrity:release-gate -- <gate-id>')
  process.exit(1)
}

const { evaluateReleaseGateUnscoped } = await import('../src/integrity/governanceRepository')
const { close } = await import('../src/db')

try {
  const gate = await evaluateReleaseGateUnscoped(gateId)
  console.log(JSON.stringify({ gateId, approved: gate?.approved === true, gate }, null, 2))
  if (!gate?.approved) process.exitCode = 1
} finally {
  await close()
}
