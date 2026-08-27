import assert from 'node:assert/strict'
import test from 'node:test'

import { Keypair, Networks, StrKey } from '@stellar/stellar-sdk'

import {
  stellarIntegrityConfigurationErrors,
  type StellarIntegrityConfig,
} from '../src/integrity/config'
import { hashArtifact, hashArtifactCommitment } from '../src/integrity/canonicalizeArtifact'

const publicConfig = (): StellarIntegrityConfig => ({
  enabled: true,
  network: 'public',
  networkPassphrase: Networks.PUBLIC,
  rpcUrl: 'https://rpc.example.test',
  contractId: StrKey.encodeContract(Buffer.alloc(32, 1)),
  signerSecret: '',
  signerSecretFile: '',
  signerUrl: 'https://signer.example.test/sign',
  signerPublicKey: Keypair.random().publicKey(),
  signerTokenFile: '/run/secrets/signer-token',
  authEntrySigning: true,
  authEntryValidLedgers: 120,
  feePayerSecret: '',
  feePayerSecretFile: '/run/secrets/fee-payer',
  adminPublicKey: Keypair.random().publicKey(),
  adminMinApprovals: 2,
  pollIntervalMs: 2_000,
  workerIntervalMs: 5_000,
  maxAttempts: 8,
  ttlSweepEnabled: true,
  ttlSweepIntervalMs: 21_600_000,
  ttlRefreshDays: 14,
  ttlBatchSize: 10,
  pendingAlertSeconds: 300,
  reconciliationEnabled: true,
  reconciliationIntervalMs: 3_600_000,
  reconciliationBatchSize: 20,
  alertWebhookUrl: 'https://alerts.example.test/integrity',
  alertWebhookToken: '',
  alertWebhookTokenFile: '/run/secrets/alert-token',
  publicDeploymentApproved: true,
  allowLocalPublicSigner: false,
  eventIngestionEnabled: true,
  eventIngestionIntervalMs: 60_000,
  eventIngestionMaxPages: 10,
  eventStartLedger: 12_345,
  archiveWebhookUrl: 'https://archive.example.test/stellar',
  archiveWebhookToken: '',
  archiveWebhookTokenFile: '/run/secrets/archive-token',
  releaseGateId: 'integrity-release-gate-test',
  releaseSubjectHash: 'ab'.repeat(32),
})

test('accepts a fail-closed Mainnet integrity configuration', () => {
  assert.deepEqual(stellarIntegrityConfigurationErrors(publicConfig()), [])
})

test('rejects network aliases and mismatched Mainnet configuration', () => {
  const config = publicConfig()
  config.network = 'mainnet'
  config.publicDeploymentApproved = false
  assert.ok(stellarIntegrityConfigurationErrors(config).some(error => error.includes('exactly')))
  config.network = 'public'
  config.networkPassphrase = Networks.TESTNET
  assert.ok(stellarIntegrityConfigurationErrors(config).some(error => error.includes('passphrase')))
})

test('requires separate Mainnet admin and writer identities plus operational controls', () => {
  const config = publicConfig()
  config.adminPublicKey = config.signerPublicKey
  config.eventStartLedger = 0
  config.alertWebhookUrl = ''
  const errors = stellarIntegrityConfigurationErrors(config)
  assert.ok(errors.some(error => error.includes('separate')))
  assert.ok(errors.some(error => error.includes('deployment ledger')))
  assert.ok(errors.some(error => error.includes('alert webhook')))
})

test('requires scoped signing, multisig governance, archival, and release approval on Mainnet', () => {
  const config = publicConfig()
  config.authEntrySigning = false
  config.feePayerSecretFile = ''
  config.adminMinApprovals = 1
  config.archiveWebhookUrl = ''
  config.archiveWebhookTokenFile = ''
  config.releaseGateId = ''
  config.releaseSubjectHash = ''
  const errors = stellarIntegrityConfigurationErrors(config)
  assert.ok(errors.some(error => error.includes('auth-entry')))
  assert.ok(errors.some(error => error.includes('two approvals')))
  assert.ok(errors.some(error => error.includes('archive webhook')))
  assert.ok(errors.some(error => error.includes('release gate')))
})

test('artifact commitments bind identity, schema, and subject digest', () => {
  const subjectHash = hashArtifact({ rows: [1, 2, 3] })
  const base = { artifactType: 'dataset-snapshot', externalId: 'dataset-2026', schemaVersion: 1, subjectHash }
  const commitment = hashArtifactCommitment(base)
  assert.notEqual(commitment, subjectHash)
  assert.notEqual(commitment, hashArtifactCommitment({ ...base, externalId: 'dataset-2027' }))
  assert.notEqual(commitment, hashArtifactCommitment({ ...base, artifactType: 'survey-batch' }))
  assert.notEqual(commitment, hashArtifactCommitment({ ...base, schemaVersion: 2 }))
})
