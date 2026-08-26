import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
} from '@stellar/stellar-sdk'

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

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))
const bytes = (hex: string) => nativeToScVal(new Uint8Array(Buffer.from(hex, 'hex')))

async function submitContractOperation(
  buildOperation: (contract: Contract, signerAddress: string) => ReturnType<Contract['call']>,
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
  const submitted = await server.sendTransaction(signed)
  if (submitted.status === 'ERROR' || submitted.status === 'TRY_AGAIN_LATER') {
    throw new Error(`Stellar RPC rejected the transaction with status ${submitted.status}.`)
  }

  for (let poll = 0; poll < 30; poll += 1) {
    await wait(config.pollIntervalMs)
    const result = await server.getTransaction(submitted.hash)
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { transactionHash: submitted.hash, ledgerSequence: result.ledger }
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Soroban transaction failed in ledger ${result.ledger}.`)
    }
  }
  throw new Error(`Timed out waiting for Soroban transaction ${submitted.hash}.`)
}

export async function submitReportAnchor(input: AnchorSubmission): Promise<AnchorConfirmation> {
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
  })
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
