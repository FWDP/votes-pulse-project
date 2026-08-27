import assert from 'node:assert/strict'
import test from 'node:test'

import { Keypair } from '@stellar/stellar-sdk'

import type { IntegrityArtifactAnchor } from '../../shared/integrityArtifacts'
import { hashArtifact, hashArtifactCommitment } from '../src/integrity/canonicalizeArtifact'
import { buildPublisherAttestationStatement } from '../src/integrity/governanceRepository'
import {
  buildIntegrityMerkleProof,
  buildIntegrityMerkleTree,
  verifyIntegrityMerkleProof,
} from '../src/integrity/merkle'

test('Merkle batches produce verifiable record-level proofs', () => {
  const tree = buildIntegrityMerkleTree([
    { id: 'row-a', value: 1 },
    { id: 'row-b', value: 2 },
    { id: 'row-c', value: 3 },
  ])
  assert.equal(tree.rootHash.length, 64)
  assert.equal(tree.leafHashes.length, 3)
  for (let index = 0; index < tree.leafHashes.length; index += 1) {
    assert.equal(verifyIntegrityMerkleProof(buildIntegrityMerkleProof(tree.leafHashes, index)), true)
  }
  const tampered = buildIntegrityMerkleProof(tree.leafHashes, 1)
  tampered.leafHash = '00'.repeat(32)
  assert.equal(verifyIntegrityMerkleProof(tampered), false)
})

test('provenance changes the artifact commitment without exposing source content', () => {
  const subjectHash = hashArtifact({ rows: [1, 2, 3] })
  const firstProvenance = hashArtifact({
    domain: 'votes-integrity-provenance/v1',
    sourceName: 'PSA PSGC',
    sourceVersion: 'Q2-2024',
  })
  const secondProvenance = hashArtifact({
    domain: 'votes-integrity-provenance/v1',
    sourceName: 'PSA PSGC',
    sourceVersion: 'Q3-2024',
  })
  const base = { artifactType: 'dataset-snapshot', externalId: 'psgc', schemaVersion: 1, subjectHash }
  assert.notEqual(
    hashArtifactCommitment({ ...base, provenanceHash: firstProvenance }),
    hashArtifactCommitment({ ...base, provenanceHash: secondProvenance }),
  )
})

test('publisher statements bind the Stellar signer to one exact artifact revision', () => {
  const signer = Keypair.random()
  const subject: IntegrityArtifactAnchor = {
    id: 'artifact-test',
    artifactType: 'dataset-snapshot',
    externalId: 'psgc-2026',
    revision: 2,
    receipt: '11'.repeat(32),
    contentHash: '22'.repeat(32),
    schemaVersion: 1,
    visibility: 'public',
    status: 'confirmed',
    metadata: {},
  }
  const statement = buildPublisherAttestationStatement({
    subject,
    attestorPublicKey: signer.publicKey(),
    organization: 'Independent Observer',
    signedAt: '2026-08-27T05:00:00.000Z',
  })
  const statementHash = Buffer.from(hashArtifact(statement), 'hex')
  const signature = signer.sign(statementHash)
  assert.equal(signer.verify(statementHash, signature), true)
  const changed = buildPublisherAttestationStatement({ ...statement, subject: { ...subject, revision: 3 } })
  assert.equal(signer.verify(Buffer.from(hashArtifact(changed), 'hex'), signature), false)
})
