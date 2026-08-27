import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import test from 'node:test'

import { config } from 'dotenv'
import { Keypair } from '@stellar/stellar-sdk'
import { Pool } from 'pg'

import { enqueueMerkleIntegrityArtifact, getMerkleIntegrityProof } from '../src/integrity/artifactRepository'
import { close } from '../src/db'
import {
  approveReleaseGate,
  createPublisherAttestation,
  createPublisherAttestationChallenge,
  createReleaseGate,
} from '../src/integrity/governanceRepository'

config({ path: path.resolve(process.cwd(), 'backend', '.env') })

test('persists Merkle manifests, signed attestations, and fail-closed release gates', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const suffix = randomUUID()
  const tenantId = `tenant-critical-integrity-${suffix}`
  const workspaceId = `workspace-critical-integrity-${suffix}`
  const scope = { tenantId, workspaceId }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const signerOne = Keypair.random()
  const signerTwo = Keypair.random()
  try {
    await pool.query('INSERT INTO tenants (id, slug) VALUES ($1, $2)', [tenantId, tenantId])
    await pool.query('INSERT INTO workspaces (id, tenant_id, slug) VALUES ($1, $2, $3)', [workspaceId, tenantId, workspaceId])
    const batch = await enqueueMerkleIntegrityArtifact(scope, {
      artifactType: 'dataset-snapshot',
      externalId: `psgc-${suffix}`,
      items: [{ code: '010000000' }, { code: '020000000' }, { code: '030000000' }],
      provenance: {
        sourceName: 'PSA PSGC',
        sourceUri: 'https://psa.gov.ph/classification/psgc',
        retrievedAt: '2026-08-27T05:00:00.000Z',
        sourceVersion: 'Q2-2026',
      },
      visibility: 'public',
    }, 'test-superadmin')
    const proof = await getMerkleIntegrityProof(scope, batch.artifact.id, 1)
    assert.equal(proof?.rootHash, batch.rootHash)
    assert.equal(batch.artifact.provenance?.sourceName, 'PSA PSGC')

    const publisherChallenge = await createPublisherAttestationChallenge(scope, {
      subjectArtifactId: batch.artifact.id,
      attestorPublicKey: signerOne.publicKey(),
      organization: 'Source Publisher',
      signedAt: '2026-08-27T05:01:00.000Z',
    })
    const publisher = await createPublisherAttestation(scope, {
      subjectArtifactId: batch.artifact.id,
      attestorPublicKey: signerOne.publicKey(),
      organization: 'Source Publisher',
      signedAt: publisherChallenge.statement.signedAt,
      signature: Buffer.from(signerOne.sign(Buffer.from(publisherChallenge.statementHash, 'hex'))).toString('base64'),
    }, 'test-superadmin')
    assert.equal(publisher.verified, true)

    const gate = await createReleaseGate(scope, {
      externalId: `release-${suffix}`,
      subjectArtifactId: batch.artifact.id,
      requiredApprovals: 2,
      allowedApproverKeys: [signerOne.publicKey(), signerTwo.publicKey()],
    }, 'test-superadmin')
    const gateChallenge = await createPublisherAttestationChallenge(scope, {
      subjectArtifactId: gate.gateArtifact.id,
      attestorPublicKey: signerTwo.publicKey(),
      organization: 'Independent Reviewer',
      signedAt: '2026-08-27T05:02:00.000Z',
    })
    const result = await approveReleaseGate(scope, String(gate.id), {
      attestorPublicKey: signerTwo.publicKey(),
      organization: 'Independent Reviewer',
      signedAt: gateChallenge.statement.signedAt,
      signature: Buffer.from(signerTwo.sign(Buffer.from(gateChallenge.statementHash, 'hex'))).toString('base64'),
    }, 'test-superadmin')
    assert.equal(result?.approved, false)
    assert.equal(result?.status, 'pending')
  } finally {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId])
      await client.query('DELETE FROM integrity_release_gate_approvals WHERE tenant_id = $1', [tenantId])
      await client.query('DELETE FROM integrity_publisher_attestations WHERE tenant_id = $1', [tenantId])
      await client.query('DELETE FROM integrity_release_gates WHERE tenant_id = $1', [tenantId])
      await client.query('DELETE FROM integrity_merkle_manifests WHERE tenant_id = $1', [tenantId])
      await client.query('DELETE FROM integrity_artifact_anchors WHERE tenant_id = $1', [tenantId])
      await client.query('DELETE FROM workspaces WHERE tenant_id = $1', [tenantId])
      await client.query('DELETE FROM tenants WHERE id = $1', [tenantId])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
      await pool.end()
      await close()
    }
  }
})
