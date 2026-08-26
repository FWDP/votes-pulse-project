import { readFile } from 'node:fs/promises'

import {
  Keypair,
  StrKey,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk'

import {
  assertStellarIntegrityReady,
  stellarIntegrityConfig,
  stellarIntegritySignerMode,
} from './config'

export interface IntegritySigner {
  publicKey: string
  mode: 'local' | 'remote'
  sign(transaction: Transaction): Promise<Transaction>
}

const readOptionalSecret = async (filePath: string) => filePath
  ? (await readFile(filePath, 'utf8')).trim()
  : ''

const loadLocalSigner = async (): Promise<IntegritySigner> => {
  const fileSecret = await readOptionalSecret(stellarIntegrityConfig.signerSecretFile)
  const secret = fileSecret || stellarIntegrityConfig.signerSecret
  if (!secret) throw new Error('The Stellar integrity signer secret is empty.')
  const keypair = Keypair.fromSecret(secret)
  return {
    publicKey: keypair.publicKey(),
    mode: 'local',
    async sign(transaction) {
      transaction.sign(keypair)
      return transaction
    },
  }
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
    async sign(transaction) {
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
  }
}

export async function loadIntegritySigner(): Promise<IntegritySigner> {
  assertStellarIntegrityReady()
  return stellarIntegritySignerMode() === 'remote'
    ? loadRemoteSigner()
    : loadLocalSigner()
}
