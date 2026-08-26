import { Networks } from '@stellar/stellar-sdk'

export const stellarIntegrityConfig = {
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
  publicDeploymentApproved: process.env.STELLAR_INTEGRITY_PUBLIC_DEPLOYMENT_APPROVED === 'true',
  allowLocalPublicSigner: process.env.STELLAR_INTEGRITY_ALLOW_LOCAL_PUBLIC_SIGNER === 'true',
  eventIngestionEnabled: process.env.STELLAR_INTEGRITY_EVENT_INGESTION_ENABLED !== 'false',
  eventIngestionIntervalMs: Math.max(10_000, Number(process.env.STELLAR_INTEGRITY_EVENT_INGESTION_INTERVAL_MS) || 60_000),
  eventStartLedger: Math.max(0, Number(process.env.STELLAR_INTEGRITY_EVENT_START_LEDGER) || 0),
}

export const stellarIntegritySignerMode = (): 'local' | 'remote' | 'unconfigured' => {
  if (stellarIntegrityConfig.signerUrl && stellarIntegrityConfig.signerPublicKey) return 'remote'
  if (stellarIntegrityConfig.signerSecret || stellarIntegrityConfig.signerSecretFile) return 'local'
  return 'unconfigured'
}

export const stellarIntegrityReady = () => Boolean(
  stellarIntegrityConfig.enabled &&
  stellarIntegrityConfig.contractId &&
  stellarIntegritySignerMode() !== 'unconfigured' &&
  (stellarIntegrityConfig.network !== 'public' || stellarIntegrityConfig.publicDeploymentApproved) &&
  (stellarIntegrityConfig.network !== 'public' || stellarIntegritySignerMode() !== 'local' || stellarIntegrityConfig.allowLocalPublicSigner),
)

export const assertStellarIntegrityReady = () => {
  if (!stellarIntegrityReady()) {
    throw new Error(
      'Stellar integrity is not configured or its public-network deployment has not passed the explicit approval and signer guards.',
    )
  }
}
