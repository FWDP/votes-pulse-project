import { Networks, StrKey } from '@stellar/stellar-sdk'

export type StellarIntegritySignerMode = 'local' | 'remote' | 'unconfigured'

export interface StellarIntegrityConfig {
  enabled: boolean
  network: string
  networkPassphrase: string
  rpcUrl: string
  contractId: string
  signerSecret: string
  signerSecretFile: string
  signerUrl: string
  signerPublicKey: string
  signerTokenFile: string
  authEntrySigning: boolean
  authEntryValidLedgers: number
  feePayerSecret: string
  feePayerSecretFile: string
  adminPublicKey: string
  adminMinApprovals: number
  pollIntervalMs: number
  workerIntervalMs: number
  maxAttempts: number
  ttlSweepEnabled: boolean
  ttlSweepIntervalMs: number
  ttlRefreshDays: number
  ttlBatchSize: number
  pendingAlertSeconds: number
  reconciliationEnabled: boolean
  reconciliationIntervalMs: number
  reconciliationBatchSize: number
  alertWebhookUrl: string
  alertWebhookToken: string
  alertWebhookTokenFile: string
  publicDeploymentApproved: boolean
  allowLocalPublicSigner: boolean
  eventIngestionEnabled: boolean
  eventIngestionIntervalMs: number
  eventIngestionMaxPages: number
  eventStartLedger: number
  archiveWebhookUrl: string
  archiveWebhookToken: string
  archiveWebhookTokenFile: string
  releaseGateId: string
  releaseSubjectHash: string
}

const urlIsHttps = (value: string) => {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export const stellarIntegrityConfig: StellarIntegrityConfig = {
  enabled: process.env.STELLAR_INTEGRITY_ENABLED === 'true',
  network: process.env.STELLAR_NETWORK?.trim() || 'testnet',
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE?.trim() || Networks.TESTNET,
  rpcUrl: process.env.STELLAR_RPC_URL?.trim() || 'https://soroban-testnet.stellar.org',
  contractId: process.env.STELLAR_INTEGRITY_CONTRACT_ID?.trim() || '',
  signerSecret: process.env.STELLAR_INTEGRITY_SIGNER_SECRET?.trim() || '',
  signerSecretFile: process.env.STELLAR_INTEGRITY_SIGNER_SECRET_FILE?.trim() || '',
  signerUrl: process.env.STELLAR_INTEGRITY_SIGNER_URL?.trim() || '',
  signerPublicKey: process.env.STELLAR_INTEGRITY_SIGNER_PUBLIC_KEY?.trim() || '',
  signerTokenFile: process.env.STELLAR_INTEGRITY_SIGNER_TOKEN_FILE?.trim() || '',
  authEntrySigning: process.env.STELLAR_INTEGRITY_AUTH_ENTRY_SIGNING === 'true',
  authEntryValidLedgers: Math.max(10, Math.min(10_000, Number(process.env.STELLAR_INTEGRITY_AUTH_ENTRY_VALID_LEDGERS) || 120)),
  feePayerSecret: process.env.STELLAR_INTEGRITY_FEE_PAYER_SECRET?.trim() || '',
  feePayerSecretFile: process.env.STELLAR_INTEGRITY_FEE_PAYER_SECRET_FILE?.trim() || '',
  adminPublicKey: process.env.STELLAR_INTEGRITY_ADMIN_PUBLIC_KEY?.trim() || '',
  adminMinApprovals: Math.max(1, Math.min(20, Number(process.env.STELLAR_INTEGRITY_ADMIN_MIN_APPROVALS) || 1)),
  pollIntervalMs: Math.max(500, Number(process.env.STELLAR_TRANSACTION_POLL_MS) || 2_000),
  workerIntervalMs: Math.max(1_000, Number(process.env.STELLAR_INTEGRITY_WORKER_INTERVAL_MS) || 5_000),
  maxAttempts: Math.max(1, Number(process.env.STELLAR_INTEGRITY_MAX_ATTEMPTS) || 8),
  ttlSweepEnabled: process.env.STELLAR_INTEGRITY_TTL_SWEEP_ENABLED !== 'false',
  ttlSweepIntervalMs: Math.max(60_000, Number(process.env.STELLAR_INTEGRITY_TTL_SWEEP_INTERVAL_MS) || 21_600_000),
  ttlRefreshDays: Math.max(1, Number(process.env.STELLAR_INTEGRITY_TTL_REFRESH_DAYS) || 14),
  ttlBatchSize: Math.max(1, Math.min(100, Number(process.env.STELLAR_INTEGRITY_TTL_BATCH_SIZE) || 10)),
  pendingAlertSeconds: Math.max(30, Number(process.env.STELLAR_INTEGRITY_PENDING_ALERT_SECONDS) || 300),
  reconciliationEnabled: process.env.STELLAR_INTEGRITY_RECONCILIATION_ENABLED !== 'false',
  reconciliationIntervalMs: Math.max(60_000, Number(process.env.STELLAR_INTEGRITY_RECONCILIATION_INTERVAL_MS) || 3_600_000),
  reconciliationBatchSize: Math.max(1, Math.min(100, Number(process.env.STELLAR_INTEGRITY_RECONCILIATION_BATCH_SIZE) || 20)),
  alertWebhookUrl: process.env.STELLAR_INTEGRITY_ALERT_WEBHOOK_URL?.trim() || '',
  alertWebhookToken: process.env.STELLAR_INTEGRITY_ALERT_WEBHOOK_TOKEN?.trim() || '',
  alertWebhookTokenFile: process.env.STELLAR_INTEGRITY_ALERT_WEBHOOK_TOKEN_FILE?.trim() || '',
  publicDeploymentApproved: process.env.STELLAR_INTEGRITY_PUBLIC_DEPLOYMENT_APPROVED === 'true',
  allowLocalPublicSigner: process.env.STELLAR_INTEGRITY_ALLOW_LOCAL_PUBLIC_SIGNER === 'true',
  eventIngestionEnabled: process.env.STELLAR_INTEGRITY_EVENT_INGESTION_ENABLED !== 'false',
  eventIngestionIntervalMs: Math.max(10_000, Number(process.env.STELLAR_INTEGRITY_EVENT_INGESTION_INTERVAL_MS) || 60_000),
  eventIngestionMaxPages: Math.max(1, Math.min(100, Number(process.env.STELLAR_INTEGRITY_EVENT_INGESTION_MAX_PAGES) || 10)),
  eventStartLedger: Math.max(0, Number(process.env.STELLAR_INTEGRITY_EVENT_START_LEDGER) || 0),
  archiveWebhookUrl: process.env.STELLAR_INTEGRITY_ARCHIVE_WEBHOOK_URL?.trim() || '',
  archiveWebhookToken: process.env.STELLAR_INTEGRITY_ARCHIVE_WEBHOOK_TOKEN?.trim() || '',
  archiveWebhookTokenFile: process.env.STELLAR_INTEGRITY_ARCHIVE_WEBHOOK_TOKEN_FILE?.trim() || '',
  releaseGateId: process.env.STELLAR_INTEGRITY_RELEASE_GATE_ID?.trim() || '',
  releaseSubjectHash: process.env.STELLAR_INTEGRITY_RELEASE_SUBJECT_SHA256?.trim().toLowerCase() || '',
}

export const stellarIntegritySignerMode = (
  config: StellarIntegrityConfig = stellarIntegrityConfig,
): StellarIntegritySignerMode => {
  if (config.signerUrl && config.signerPublicKey) return 'remote'
  if (config.signerSecret || config.signerSecretFile) return 'local'
  return 'unconfigured'
}

export const stellarIntegrityConfigurationErrors = (
  config: StellarIntegrityConfig = stellarIntegrityConfig,
) => {
  if (!config.enabled) return ['Stellar integrity is disabled.']
  const errors: string[] = []
  if (config.network !== 'testnet' && config.network !== 'public') {
    errors.push('STELLAR_NETWORK must be exactly "testnet" or "public".')
  }
  const expectedPassphrase = config.network === 'public' ? Networks.PUBLIC : Networks.TESTNET
  if (config.networkPassphrase !== expectedPassphrase) {
    errors.push(`The network passphrase does not match STELLAR_NETWORK=${config.network}.`)
  }
  if (!urlIsHttps(config.rpcUrl)) errors.push('STELLAR_RPC_URL must be a valid HTTPS URL.')
  if (!StrKey.isValidContract(config.contractId)) errors.push('STELLAR_INTEGRITY_CONTRACT_ID is not a valid contract address.')
  const signerMode = stellarIntegritySignerMode(config)
  if (signerMode === 'unconfigured') errors.push('A local or remote Stellar signer must be configured.')
  if (signerMode === 'remote' && !StrKey.isValidEd25519PublicKey(config.signerPublicKey)) {
    errors.push('STELLAR_INTEGRITY_SIGNER_PUBLIC_KEY is not a valid account address.')
  }
  if (signerMode === 'remote' && !urlIsHttps(config.signerUrl)) {
    errors.push('STELLAR_INTEGRITY_SIGNER_URL must use HTTPS.')
  }
  if (config.authEntrySigning && !config.feePayerSecret && !config.feePayerSecretFile) {
    errors.push('Auth-entry signing requires a separate fee-payer secret or secret file.')
  }
  if (config.network === 'public') {
    if (!config.publicDeploymentApproved) errors.push('Mainnet deployment approval is not enabled.')
    if (signerMode === 'local' && !config.allowLocalPublicSigner) errors.push('Mainnet requires a remote signer.')
    if (signerMode === 'remote' && (config.signerSecret || config.signerSecretFile)) errors.push('Mainnet remote signing must not also expose local signer material to the API.')
    if (signerMode === 'remote' && !config.signerTokenFile) errors.push('Mainnet remote signing requires a file-mounted authentication token.')
    if (!config.authEntrySigning) errors.push('Mainnet requires scoped Soroban auth-entry signing with a separate fee payer.')
    if (!config.feePayerSecretFile || config.feePayerSecret) errors.push('Mainnet fee payer must use file-mounted secret material and must not use an environment secret.')
    if (!StrKey.isValidEd25519PublicKey(config.adminPublicKey)) errors.push('Mainnet requires a valid, explicit administrator public key.')
    if (config.adminPublicKey && config.adminPublicKey === config.signerPublicKey) errors.push('Mainnet administrator and writer identities must be separate.')
    if (config.adminMinApprovals < 2) errors.push('Mainnet administrator governance must require at least two approvals.')
    if (!config.ttlSweepEnabled) errors.push('Mainnet requires TTL maintenance.')
    if (!config.reconciliationEnabled) errors.push('Mainnet requires contract-state reconciliation.')
    if (!config.eventIngestionEnabled || config.eventStartLedger <= 0) errors.push('Mainnet requires event ingestion from the deployment ledger.')
    if (!urlIsHttps(config.alertWebhookUrl)) errors.push('Mainnet requires an HTTPS integrity alert webhook.')
    if (!config.alertWebhookTokenFile) errors.push('Mainnet alert delivery requires a file-mounted authentication token.')
    if (!urlIsHttps(config.archiveWebhookUrl)) errors.push('Mainnet requires an HTTPS integrity archive webhook.')
    if (!config.archiveWebhookTokenFile) errors.push('Mainnet archive delivery requires a file-mounted authentication token.')
    if (!config.releaseGateId) errors.push('Mainnet requires a confirmed multi-party release gate identifier.')
    if (!/^[a-f0-9]{64}$/.test(config.releaseSubjectHash)) errors.push('Mainnet requires the exact release artifact commitment SHA-256.')
  }
  return errors
}

export const stellarIntegrityReady = () => stellarIntegrityConfigurationErrors().length === 0

export const assertStellarIntegrityReady = () => {
  const errors = stellarIntegrityConfigurationErrors()
  if (errors.length) throw new Error(`Stellar integrity is not ready: ${errors.join(' ')}`)
}
