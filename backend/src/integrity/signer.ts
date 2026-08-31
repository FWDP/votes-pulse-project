import { readFile } from 'node:fs/promises'

import {
  authorizeEntry,
  Keypair,
  StrKey,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk'

import {
  assertStellarIntegrityReady,
  stellarIntegrityConfig,
  stellarIntegritySignerMode,
} from './config'

export interface IntegritySigner {
  publicKey: string
  mode: 'local' | 'remote'
  signTransaction(transaction: Transaction): Promise<Transaction>
  signAuthorizationEntry(
    entry: xdr.SorobanAuthorizationEntry,
    validUntilLedgerSeq: number,
  ): Promise<xdr.SorobanAuthorizationEntry>
}

export interface FeePayerSigner {
  publicKey: string
  signTransaction(transaction: Transaction): Promise<Transaction>
}

const readOptionalSecret = async (filePath: string) => filePath
  ? (await readFile(filePath, 'utf8')).trim()
  : ''

const signerFromKeypair = (keypair: Keypair): IntegritySigner => ({
  publicKey: keypair.publicKey(),
  mode: 'local',
  async signTransaction(transaction) {
    transaction.sign(keypair)
    return transaction
  },
  async signAuthorizationEntry(entry, validUntilLedgerSeq) {
    return authorizeEntry(
      entry,
      keypair,
      validUntilLedgerSeq,
      stellarIntegrityConfig.networkPassphrase,
    )
  },
})

const loadLocalSigner = async (): Promise<IntegritySigner> => {
  const fileSecret = await readOptionalSecret(stellarIntegrityConfig.signerSecretFile)
  const secret = fileSecret || stellarIntegrityConfig.signerSecret
  if (!secret) throw new Error('The Stellar integrity signer secret is empty.')
  const keypair = Keypair.fromSecret(secret)
  return signerFromKeypair(keypair)
}

const loadRemoteSigner = async (): Promise<IntegritySigner> => {
  const { signerPublicKey, signerTokenFile, signerUrl, networkPassphrase } = stellarIntegrityConfig
  if (!StrKey.isValidEd25519PublicKey(signerPublicKey)) {
    throw new Error('STELLAR_INTEGRITY_SIGNER_PUBLIC_KEY is not a valid Stellar account.')
  }
  const url = new URL(signerUrl)
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('The remote Stellar signer must use HTTPS outside localhost.')
  }
  const token = await readOptionalSecret(signerTokenFile)
  return {
    publicKey: signerPublicKey,
    mode: 'remote',
    async signTransaction(transaction) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          networkPassphrase,
          publicKey: signerPublicKey,
          transactionXdr: transaction.toXDR(),
        }),
        signal: AbortSignal.timeout(15_000),
      })
      const body = await response.json().catch(() => null) as { signedTransactionXdr?: string; error?: string } | null
      if (!response.ok || !body?.signedTransactionXdr) {
        throw new Error(body?.error || `Remote Stellar signer returned HTTP ${response.status}.`)
      }
      const signed = TransactionBuilder.fromXDR(body.signedTransactionXdr, networkPassphrase)
      if (!(signed instanceof Transaction)) throw new Error('Remote signer returned an unsupported fee-bump transaction.')
      if (!Buffer.from(signed.hash()).equals(Buffer.from(transaction.hash()))) {
        throw new Error('Remote signer changed the prepared Stellar transaction body.')
      }
      return signed
    },
    async signAuthorizationEntry(entry, validUntilLedgerSeq) {
      return authorizeEntry(entry, async (preimage, payload) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            version: 2,
            kind: 'soroban-authorization-entry',
            networkPassphrase,
            publicKey: signerPublicKey,
            authorizationPreimageXdr: preimage.toXDR('base64'),
            payloadSha256: Buffer.from(payload).toString('hex'),
            validUntilLedgerSeq,
          }),
          signal: AbortSignal.timeout(15_000),
        })
        const body = await response.json().catch(() => null) as {
          signature?: string
          signatureEncoding?: 'base64' | 'hex'
          error?: string
        } | null
        if (!response.ok || !body?.signature) {
          throw new Error(body?.error || `Remote Stellar auth-entry signer returned HTTP ${response.status}.`)
        }
        const signature = Buffer.from(body.signature, body.signatureEncoding === 'hex' ? 'hex' : 'base64')
        if (signature.length !== 64 || !Keypair.fromPublicKey(signerPublicKey).verify(payload, signature)) {
          throw new Error('Remote signer returned an invalid Soroban authorization signature.')
        }
        return { publicKey: signerPublicKey, signature }
      }, validUntilLedgerSeq, networkPassphrase)
    },
  }
}

export async function loadIntegritySigner(): Promise<IntegritySigner> {
  assertStellarIntegrityReady()
  return stellarIntegritySignerMode() === 'remote'
    ? loadRemoteSigner()
    : loadLocalSigner()
}

export async function loadFeePayerSigner(): Promise<FeePayerSigner> {
  assertStellarIntegrityReady()
  const fileSecret = await readOptionalSecret(stellarIntegrityConfig.feePayerSecretFile)
  const secret = fileSecret || stellarIntegrityConfig.feePayerSecret
  if (!secret) throw new Error('The Stellar integrity fee-payer secret is empty.')
  const keypair = Keypair.fromSecret(secret)
  return {
    publicKey: keypair.publicKey(),
    async signTransaction(transaction) {
      transaction.sign(keypair)
      return transaction
    },
  }
}
