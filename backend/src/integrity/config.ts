import { Networks } from '@stellar/stellar-sdk'

export const stellarIntegrityConfig = {
  enabled: process.env.STELLAR_INTEGRITY_ENABLED === 'true',
  network: process.env.STELLAR_NETWORK?.trim() || 'testnet',
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE?.trim() || Networks.TESTNET,
  rpcUrl: process.env.STELLAR_RPC_URL?.trim() || 'https://soroban-testnet.stellar.org',
  contractId: process.env.STELLAR_INTEGRITY_CONTRACT_ID?.trim() || '',
  signerSecret: process.env.STELLAR_INTEGRITY_SIGNER_SECRET?.trim() || '',
  signerSecretFile: process.env.STELLAR_INTEGRITY_SIGNER_SECRET_FILE?.trim() || '',
  pollIntervalMs: Math.max(500, Number(process.env.STELLAR_TRANSACTION_POLL_MS) || 2_000),
  workerIntervalMs: Math.max(1_000, Number(process.env.STELLAR_INTEGRITY_WORKER_INTERVAL_MS) || 5_000),
  maxAttempts: Math.max(1, Number(process.env.STELLAR_INTEGRITY_MAX_ATTEMPTS) || 8),
}

export const stellarIntegrityReady = () => Boolean(
  stellarIntegrityConfig.enabled &&
  stellarIntegrityConfig.contractId &&
  (stellarIntegrityConfig.signerSecret || stellarIntegrityConfig.signerSecretFile),
)

export const assertStellarIntegrityReady = () => {
  if (!stellarIntegrityReady()) {
    throw new Error(
      'Stellar integrity is not configured. Set the enable flag, contract ID, and a signer secret or signer secret file.',
    )
  }
}
