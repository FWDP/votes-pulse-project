import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
} from '@stellar/stellar-sdk'
import { readFile } from 'node:fs/promises'

import type { FieldReportIntegrityAnchorType } from '../../../shared/fieldReports'
import { stellarIntegrityConfig } from './config'
import { loadIntegritySigner } from './signer'

export interface AnchorSubmission {
  reportKey: string
  revision: number
  contentHash: string
  previousHash?: string
  schemaVersion: number
  anchorType?: FieldReportIntegrityAnchorType
}

export interface AnchorConfirmation {
  transactionHash: string
  ledgerSequence: number
}

export interface OnChainAnchor {
  contentHash: string
  previousHash?: string
  ledger: number
  schemaVersion: number
}

export type SubmittedTransactionState =
  | { status: 'not-found' }
  | { status: 'failed'; ledgerSequence: number }
  | { status: 'confirmed'; transactionHash: string; ledgerSequence: number }

export class SubmittedTransactionPendingError extends Error {
  constructor(readonly transactionHash: string) {
    super(`Stellar transaction ${transactionHash} is still pending confirmation.`)
    this.name = 'SubmittedTransactionPendingError'
  }
}

export class SubmittedTransactionRejectedError extends Error {
  constructor(readonly transactionHash: string, message: string) {
    super(message)
    this.name = 'SubmittedTransactionRejectedError'
  }
}

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))
const bytes = (hex: string) => nativeToScVal(new Uint8Array(Buffer.from(hex, 'hex')))

async function submitContractOperation(
  buildOperation: (contract: Contract, signerAddress: string) => ReturnType<Contract['call']>,
  onSubmitted?: (transactionHash: string) => Promise<void>,
): Promise<AnchorConfirmation> {
  const config = stellarIntegrityConfig
  const signer = await loadIntegritySigner()
  const server = new rpc.Server(config.rpcUrl)
  const source = await server.getAccount(signer.publicKey)
  const contract = new Contract(config.contractId)
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(buildOperation(contract, signer.publicKey))
    .setTimeout(30)
    .build()

  const prepared = await server.prepareTransaction(transaction)
  const signed = await signer.sign(prepared)
  const transactionHash = Buffer.from(signed.hash()).toString('hex')
  await onSubmitted?.(transactionHash)
  let submitted
  try {
    submitted = await server.sendTransaction(signed)
  } catch {
    throw new SubmittedTransactionPendingError(transactionHash)
  }
  if (submitted.status === 'ERROR') {
    throw new SubmittedTransactionRejectedError(transactionHash, 'Stellar RPC rejected the transaction.')
  }
  if (submitted.status === 'TRY_AGAIN_LATER') {
    throw new SubmittedTransactionPendingError(transactionHash)
  }

  for (let poll = 0; poll < 30; poll += 1) {
    await wait(config.pollIntervalMs)
    const result = await server.getTransaction(submitted.hash)
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { transactionHash: submitted.hash, ledgerSequence: result.ledger }
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new SubmittedTransactionRejectedError(
        submitted.hash,
        `Soroban transaction failed in ledger ${result.ledger}.`,
      )
    }
  }
  throw new SubmittedTransactionPendingError(submitted.hash)
}

export async function submitReportAnchor(
  input: AnchorSubmission,
  onSubmitted?: (transactionHash: string) => Promise<void>,
): Promise<AnchorConfirmation> {
  return submitContractOperation((contract, signerAddress) => {
    const common = [
      Address.fromString(signerAddress).toScVal(),
      bytes(input.reportKey),
      nativeToScVal(input.revision, { type: 'u32' }),
      bytes(input.contentHash),
    ]
    if (input.revision === 1) {
      return contract.call(
        'anchor',
        ...common,
        nativeToScVal(input.schemaVersion, { type: 'u32' }),
      )
    }
    if (!input.previousHash) throw new Error('A chained anchor requires previousHash.')
    return contract.call(
      'anchor_revision',
      ...common,
      bytes(input.previousHash),
      nativeToScVal(input.schemaVersion, { type: 'u32' }),
      nativeToScVal(input.anchorType === 'review-attestation' ? 1 : 0, { type: 'u32' }),
    )
  }, onSubmitted)
}

export async function estimateReportAnchorCost(input: AnchorSubmission) {
  const config = stellarIntegrityConfig
  const signer = await loadIntegritySigner()
  const server = new rpc.Server(config.rpcUrl)
  const source = await server.getAccount(signer.publicKey)
  const contract = new Contract(config.contractId)
  const operation = contract.call(
    'anchor',
    Address.fromString(signer.publicKey).toScVal(),
    bytes(input.reportKey),
    nativeToScVal(1, { type: 'u32' }),
    bytes(input.contentHash),
    nativeToScVal(input.schemaVersion, { type: 'u32' }),
  )
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  }).addOperation(operation).setTimeout(30).build()
  const simulation = await server.simulateTransaction(transaction)
  if (!rpc.Api.isSimulationSuccess(simulation)) {
    throw new Error(`Unable to estimate Soroban anchor cost: ${simulation.error}`)
  }
  return {
    minimumResourceFeeStroops: simulation.minResourceFee,
    latestLedger: simulation.latestLedger,
  }
}

export async function extendReportAnchorTtl(reportKey: string, revision: number) {
  return submitContractOperation((contract, signerAddress) => contract.call(
    'touch_anchor',
    Address.fromString(signerAddress).toScVal(),
    bytes(reportKey),
    nativeToScVal(revision, { type: 'u32' }),
  ))
}

export async function readReportAnchor(reportKey: string, revision: number): Promise<OnChainAnchor | undefined> {
  const config = stellarIntegrityConfig
  const signer = await loadIntegritySigner()
  const server = new rpc.Server(config.rpcUrl)
  const source = await server.getAccount(signer.publicKey)
  const contract = new Contract(config.contractId)
  const operation = revision === 1
    ? contract.call('get_anchor', bytes(reportKey), nativeToScVal(revision, { type: 'u32' }))
    : contract.call('get_revision', bytes(reportKey), nativeToScVal(revision, { type: 'u32' }))
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  }).addOperation(operation).setTimeout(30).build()
  const simulation = await server.simulateTransaction(transaction)
  if (!rpc.Api.isSimulationSuccess(simulation)) {
    throw new Error(`Unable to read Soroban anchor: ${simulation.error}`)
  }
  if (!simulation.result) return undefined
  const native = scValToNative(simulation.result.retval) as Record<string, unknown> | null
  if (!native) return undefined
  const toHex = (value: unknown) => value instanceof Uint8Array
    ? Buffer.from(value).toString('hex')
    : undefined
  const contentHash = toHex(native.content_hash)
  if (!contentHash) throw new Error('Soroban returned an invalid anchor content hash.')
  return {
    contentHash,
    previousHash: toHex(native.previous_hash),
    ledger: Number(native.ledger),
    schemaVersion: Number(native.schema_version),
  }
}

export async function inspectSubmittedTransaction(transactionHash: string): Promise<SubmittedTransactionState> {
  const server = new rpc.Server(stellarIntegrityConfig.rpcUrl)
  const result = await server.getTransaction(transactionHash)
  if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    return { status: 'confirmed', transactionHash, ledgerSequence: result.ledger }
  }
  if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
    return { status: 'failed', ledgerSequence: result.ledger }
  }
  return { status: 'not-found' }
}

async function readContractAddress(method: 'writer' | 'admin') {
  const config = stellarIntegrityConfig
  const signer = await loadIntegritySigner()
  const server = new rpc.Server(config.rpcUrl)
  const source = await server.getAccount(signer.publicKey)
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  }).addOperation(new Contract(config.contractId).call(method)).setTimeout(30).build()
  const simulation = await server.simulateTransaction(transaction)
  if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) {
    throw new Error(`Unable to read contract ${method}.`)
  }
  return String(scValToNative(simulation.result.retval))
}

export async function validateStellarRuntime() {
  const config = stellarIntegrityConfig
  const signer = await loadIntegritySigner()
  const server = new rpc.Server(config.rpcUrl)
  const network = await server.getNetwork()
  if (network.passphrase !== config.networkPassphrase) {
    throw new Error('The Stellar RPC network passphrase does not match the configured network.')
  }
  if (config.network === 'public') {
    const [signerToken, alertToken] = await Promise.all([
      readFile(config.signerTokenFile, 'utf8'),
      readFile(config.alertWebhookTokenFile, 'utf8'),
    ])
    if (!signerToken.trim() || !alertToken.trim()) {
      throw new Error('Mainnet signer and alert authentication token files must not be empty.')
    }
  }
  const [writer, admin] = await Promise.all([readContractAddress('writer'), readContractAddress('admin')])
  if (writer !== signer.publicKey) throw new Error('The configured signer is not the contract writer.')
  if (config.adminPublicKey && admin !== config.adminPublicKey) {
    throw new Error('The configured administrator does not match the contract administrator.')
  }
  if (config.network === 'public' && admin === writer) {
    throw new Error('Mainnet contract administrator and writer must be separate identities.')
  }
  return { networkPassphrase: network.passphrase, protocolVersion: network.protocolVersion, writer, admin }
}
