import { access, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { config as loadEnv } from 'dotenv'

loadEnv({
  path: path.resolve(
    process.cwd(),
    process.env.STELLAR_MAINNET_ENV_FILE?.trim() || path.join('backend', '.env.mainnet'),
  ),
})

// The host-side release gate uses the same secret files that Compose later
// mounts under /run/secrets. The API container overrides these with its mount
// paths, while this command validates the original protected files directly.
process.env.STELLAR_INTEGRITY_SIGNER_TOKEN_FILE ||= process.env.STELLAR_SIGNER_TOKEN_HOST_FILE
process.env.STELLAR_INTEGRITY_FEE_PAYER_SECRET_FILE ||= process.env.STELLAR_FEE_PAYER_SECRET_HOST_FILE
process.env.STELLAR_INTEGRITY_ALERT_WEBHOOK_TOKEN_FILE ||= process.env.STELLAR_ALERT_TOKEN_HOST_FILE
process.env.STELLAR_INTEGRITY_ARCHIVE_WEBHOOK_TOKEN_FILE ||= process.env.STELLAR_ARCHIVE_TOKEN_HOST_FILE

const { stellarIntegrityConfig, stellarIntegrityConfigurationErrors, stellarIntegritySignerMode } = await import('../src/integrity/config')

const failures = [...stellarIntegrityConfigurationErrors({
  ...stellarIntegrityConfig,
  network: 'public',
})]
const checks: Array<{ name: string; ok: boolean; detail?: string }> = []
const check = (name: string, ok: boolean, detail?: string) => {
  checks.push({ name, ok, detail: ok ? undefined : detail })
  if (!ok) failures.push(detail ?? name)
}

check('public network selected', stellarIntegrityConfig.network === 'public')
check('remote signer configured', stellarIntegritySignerMode() === 'remote', 'Mainnet release requires the remote signing boundary; local-signing overrides are not release-ready.')
check('production runtime selected', process.env.NODE_ENV === 'production', 'NODE_ENV must be production.')
check('deployment transaction recorded', /^[a-f0-9]{64}$/.test(process.env.STELLAR_INTEGRITY_DEPLOYMENT_TRANSACTION ?? ''), 'A valid Mainnet deployment transaction hash is required.')
check('security review recorded', Boolean(process.env.STELLAR_INTEGRITY_SECURITY_REVIEW_ID?.trim()), 'An independent security review identifier is required.')
check('load and cost report recorded', Boolean(process.env.STELLAR_INTEGRITY_LOAD_TEST_REPORT?.trim()), 'A load/cost report reference is required.')

for (const [name, filePath] of [
  ['remote signer token readable', stellarIntegrityConfig.signerTokenFile],
  ['fee payer secret readable', stellarIntegrityConfig.feePayerSecretFile],
  ['alert webhook token readable', stellarIntegrityConfig.alertWebhookTokenFile],
  ['archive webhook token readable', stellarIntegrityConfig.archiveWebhookTokenFile],
] as const) {
  let readable = false
  if (filePath) readable = await access(filePath).then(() => true).catch(() => false)
  check(name, readable, `${name}: configured file is not readable.`)
}

const wasmPath = path.resolve(process.cwd(), 'contracts', 'target', 'wasm32v1-none', 'release', 'report_integrity.wasm')
const expectedWasmHash = process.env.STELLAR_INTEGRITY_EXPECTED_WASM_SHA256?.trim().toLowerCase() ?? ''
let actualWasmHash = ''
try {
  actualWasmHash = createHash('sha256').update(await readFile(wasmPath)).digest('hex')
} catch {
  // Reported by the check below.
}
check('reviewed Wasm hash matches', Boolean(actualWasmHash && expectedWasmHash && actualWasmHash === expectedWasmHash), 'The built Wasm hash does not match STELLAR_INTEGRITY_EXPECTED_WASM_SHA256.')

if (!failures.length) {
  try {
    const { validateStellarRuntime } = await import('../src/integrity/stellarClient')
    const runtime = await validateStellarRuntime()
    check('RPC, contract, writer, and admin validated', true, `Protocol ${runtime.protocolVersion}`)
  } catch (error) {
    check('RPC, contract, writer, and admin validated', false, error instanceof Error ? error.message : 'Runtime validation failed.')
  }
}

if (!failures.length) {
  try {
    const { query, close } = await import('../src/db')
    const migration = await query('SELECT 1 FROM migrations WHERE id = $1', ['011_integrity_archive_chain.sql'])
    check('critical integrity migrations applied', migration.rowCount === 1, 'Migration 011 is not applied.')
    const { evaluateReleaseGateUnscoped } = await import('../src/integrity/governanceRepository')
    const gate = await evaluateReleaseGateUnscoped(stellarIntegrityConfig.releaseGateId)
    check('multi-party release gate approved', gate?.approved === true, 'The configured release gate is missing, incomplete, or not fully confirmed on Stellar.')
    check(
      'release gate bound to approved artifact',
      gate?.subjectArtifactType === 'release-approval' && gate.subjectContentHash === stellarIntegrityConfig.releaseSubjectHash,
      'The release gate subject must be a release-approval artifact matching STELLAR_INTEGRITY_RELEASE_SUBJECT_SHA256.',
    )
    await close()
  } catch (error) {
    check('Mainnet readiness migration applied', false, error instanceof Error ? error.message : 'Database validation failed.')
  }
}

const ready = failures.length === 0
console.log(JSON.stringify({
  ready,
  network: stellarIntegrityConfig.network,
  signerMode: stellarIntegritySignerMode(),
  contractId: stellarIntegrityConfig.contractId || undefined,
  wasmSha256: actualWasmHash || undefined,
  checks,
  failures: [...new Set(failures)],
}, null, 2))
if (!ready) process.exitCode = 1
