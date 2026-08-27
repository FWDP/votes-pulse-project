import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
} from '@stellar/stellar-sdk'
import { readFile } from 'node:fs/promises'

import type { FieldReportIntegrityAnchorType } from '../../../shared/fieldReports'
import { stellarIntegrityConfig } from './config'
import { loadFeePayerSigner, loadIntegritySigner } from './signer'

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
  const feePayer = config.authEntrySigning ? await loadFeePayerSigner() : undefined
  const server = new rpc.Server(config.rpcUrl)
  const source = await server.getAccount(feePayer?.publicKey ?? signer.publicKey)
  const contract = new Contract(config.contractId)
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(buildOperation(contract, signer.publicKey))
    .setTimeout(30)
    .build()

  let signed
  if (feePayer) {
    if (feePayer.publicKey === signer.publicKey) {
      throw new Error('The Stellar fee payer and contract writer must be separate accounts.')
    }
    const simulation = await server.simulateTransaction(transaction)
    if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) {
      const detail = rpc.Api.isSimulationError(simulation) ? simulation.error : 'missing authorization entries'
      throw new Error(`Unable to prepare scoped Soroban authorization: ${detail}`)
    }
    const invoke = transaction.operations[0]
    if (invoke?.type !== 'invokeHostFunction') {
      throw new Error('Scoped signing requires exactly one invokeHostFunction operation.')
    }
    const validUntilLedgerSeq = simulation.latestLedger + config.authEntryValidLedgers
    const auth = await Promise.all(
      simulation.result.auth.map(entry => signer.signAuthorizationEntry(entry, validUntilLedgerSeq)),
    )
    const assembled = rpc.assembleTransaction(transaction, simulation)
      .clearOperations()
      .addOperation(Operation.invokeHostFunction({
        source: invoke.source,
        func: invoke.func,
        auth,
      }))
      .build()
    signed = await feePayer.signTransaction(assembled)
  } else {
    const prepared = await server.prepareTransaction(transaction)
    signed = await signer.signTransaction(prepared)
  }
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
  const feePayer = config.authEntrySigning ? await loadFeePayerSigner() : undefined
  const server = new rpc.Server(config.rpcUrl)
  const source = await server.getAccount(feePayer?.publicKey ?? signer.publicKey)
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

export async function restoreArchivedReportAnchor(reportKey: string, revision: number) {
  if (!/^[a-f0-9]{64}$/.test(reportKey) || !Number.isInteger(revision) || revision < 1) {
    throw new Error('A valid report key and positive revision are required for restoration.')
  }
  const config = stellarIntegrityConfig
  const signer = await loadIntegritySigner()
  const feePayer = config.authEntrySigning ? await loadFeePayerSigner() : undefined
  const envelopeSigner = feePayer ?? signer
  const server = new rpc.Server(config.rpcUrl)
  const source = await server.getAccount(envelopeSigner.publicKey)
  const contract = new Contract(config.contractId)
  const readOperation = revision === 1
    ? contract.call('get_anchor', bytes(reportKey), nativeToScVal(revision, { type: 'u32' }))
    : contract.call('get_revision', bytes(reportKey), nativeToScVal(revision, { type: 'u32' }))
  const readTransaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  }).addOperation(readOperation).setTimeout(30).build()
  const simulation = await server.simulateTransaction(readTransaction)
  if (!rpc.Api.isSimulationRestore(simulation)) {
    if (rpc.Api.isSimulationError(simulation)) throw new Error(`Unable to inspect archived anchor: ${simulation.error}`)
    return { restored: false as const, reason: 'anchor-is-live' as const }
  }
  const restoreTransaction = new TransactionBuilder(source, {
    fee: simulation.restorePreamble.minResourceFee,
    networkPassphrase: config.networkPassphrase,
  })
    .setSorobanData(simulation.restorePreamble.transactionData.build())
    .addOperation(Operation.restoreFootprint({}))
    .setTimeout(30)
    .build()
  const prepared = await server.prepareTransaction(restoreTransaction)
  const signed = await envelopeSigner.signTransaction(prepared)
  const submitted = await server.sendTransaction(signed)
  if (submitted.status === 'ERROR') throw new Error('Stellar RPC rejected the state-restoration transaction.')
  if (submitted.status === 'TRY_AGAIN_LATER') throw new SubmittedTransactionPendingError(Buffer.from(signed.hash()).toString('hex'))
  for (let poll = 0; poll < 30; poll += 1) {
    await wait(config.pollIntervalMs)
    const result = await server.getTransaction(submitted.hash)
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { restored: true as const, transactionHash: submitted.hash, ledgerSequence: result.ledger }
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Soroban state restoration failed in ledger ${result.ledger}.`)
    }
  }
  throw new SubmittedTransactionPendingError(submitted.hash)
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
  const feePayer = config.authEntrySigning ? await loadFeePayerSigner() : undefined
  const server = new rpc.Server(config.rpcUrl)
  const source = await server.getAccount(feePayer?.publicKey ?? signer.publicKey)
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
  const feePayer = config.authEntrySigning ? await loadFeePayerSigner() : undefined
  const server = new rpc.Server(config.rpcUrl)
  const network = await server.getNetwork()
  if (network.passphrase !== config.networkPassphrase) {
    throw new Error('The Stellar RPC network passphrase does not match the configured network.')
  }
  if (config.network === 'public') {
    const [signerToken, alertToken, archiveToken] = await Promise.all([
      readFile(config.signerTokenFile, 'utf8'),
      readFile(config.alertWebhookTokenFile, 'utf8'),
      readFile(config.archiveWebhookTokenFile, 'utf8'),
    ])
    if (!signerToken.trim() || !alertToken.trim() || !archiveToken.trim()) {
      throw new Error('Mainnet signer, alert, and archive authentication token files must not be empty.')
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
  if (feePayer?.publicKey === writer || feePayer?.publicKey === admin) {
    throw new Error('The Mainnet fee payer must be separate from the contract writer and administrator.')
  }
  let adminGovernance: { signerCount: number; mediumThreshold: number; minimumApprovals: number } | undefined
  if (config.network === 'public') {
    const key = xdr.LedgerKey.account(new xdr.LedgerKeyAccount({
      accountId: Keypair.fromPublicKey(admin).xdrAccountId(),
    }))
    const entry = await server.getLedgerEntry(key)
    if (entry.val.type !== 'account') throw new Error('Mainnet administrator is not a Stellar account entry.')
    const account = entry.val.account
    const [masterWeight, , mediumThreshold] = account.thresholds.toBytes()
    const weights = [masterWeight, ...account.signers.map(item => item.weight)].filter(weight => weight > 0)
    const minimumApprovals = [...weights]
      .sort((left, right) => right - left)
      .reduce((state, weight) => state.total >= mediumThreshold
        ? state
        : { total: state.total + weight, count: state.count + 1 }, { total: 0, count: 0 }).count
    if (!mediumThreshold || weights.length < config.adminMinApprovals || minimumApprovals < config.adminMinApprovals) {
      throw new Error(`Mainnet administrator must require at least ${config.adminMinApprovals} independent approvals.`)
    }
    adminGovernance = { signerCount: weights.length, mediumThreshold, minimumApprovals }
  }
  return {
    networkPassphrase: network.passphrase,
    protocolVersion: network.protocolVersion,
    writer,
    admin,
    feePayer: feePayer?.publicKey,
    adminGovernance,
  }
}
