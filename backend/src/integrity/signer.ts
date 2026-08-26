import { readFile } from 'node:fs/promises'

import { Keypair } from '@stellar/stellar-sdk'

import { assertStellarIntegrityReady, stellarIntegrityConfig } from './config'

export async function loadIntegritySigner(): Promise<Keypair> {
  assertStellarIntegrityReady()
  const fileSecret = stellarIntegrityConfig.signerSecretFile
    ? (await readFile(stellarIntegrityConfig.signerSecretFile, 'utf8')).trim()
    : ''
  const secret = fileSecret || stellarIntegrityConfig.signerSecret
  if (!secret) throw new Error('The Stellar integrity signer secret is empty.')
  return Keypair.fromSecret(secret)
}
