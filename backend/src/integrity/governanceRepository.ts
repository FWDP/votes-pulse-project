import { randomUUID } from 'node:crypto'

import { Keypair, StrKey } from '@stellar/stellar-sdk'

import type { IntegrityArtifactAnchor } from '../../../shared/integrityArtifacts'
import { query, runTenantOperation } from '../db'
import { enqueueIntegrityArtifact, getIntegrityArtifactById } from './artifactRepository'
import { hashArtifact } from './canonicalizeArtifact'
import type { IntegrityScope } from './integrityRepository'

const parseSignature = (value: string) => {
  const signature = Buffer.from(value, 'base64')
  if (signature.length !== 64) throw new Error('signature must be a base64-encoded Ed25519 signature.')
  return signature
}

const assertPublicKey = (value: string) => {
  if (!StrKey.isValidEd25519PublicKey(value)) throw new Error('attestorPublicKey must be a valid Stellar account.')
  return value
}

export const buildPublisherAttestationStatement = (input: {
  subject: IntegrityArtifactAnchor
  attestorPublicKey: string
  organization: string
  signedAt: string
}) => ({
  domain: 'votes-publisher-attestation/v1',
  subject: {
    id: input.subject.id,
    artifactType: input.subject.artifactType,
    externalId: input.subject.externalId,
    revision: input.subject.revision,
    contentHash: input.subject.contentHash,
  },
  attestorPublicKey: input.attestorPublicKey,
  organization: input.organization,
  signedAt: input.signedAt,
})

export async function createPublisherAttestationChallenge(
  scope: IntegrityScope,
  input: {
    subjectArtifactId: string
    attestorPublicKey: string
    organization: string
    signedAt?: string
  },
) {
  const subject = await getIntegrityArtifactById(scope, input.subjectArtifactId)
  if (!subject) throw new Error('Subject integrity artifact was not found.')
  const attestorPublicKey = assertPublicKey(input.attestorPublicKey)
  const organization = input.organization.trim()
  if (!organization || organization.length > 200) throw new Error('organization must contain 1 to 200 characters.')
  const signedDate = input.signedAt ? new Date(input.signedAt) : new Date()
  if (!Number.isFinite(signedDate.getTime())) throw new Error('signedAt must be a valid timestamp.')
  const statement = buildPublisherAttestationStatement({
    subject,
    attestorPublicKey,
    organization,
    signedAt: signedDate.toISOString(),
  })
  return {
    statement,
    statementHash: hashArtifact(statement),
    signingEncoding: 'hex-sha256',
    signatureEncoding: 'base64-ed25519',
  }
}

export async function createPublisherAttestation(
  scope: IntegrityScope,
  input: {
    subjectArtifactId: string
    attestorPublicKey: string
    organization: string
    signedAt: string
    signature: string
    visibility?: 'private' | 'public'
  },
  actorId: string,
) {
  const challenge = await createPublisherAttestationChallenge(scope, input)
  const subject = await getIntegrityArtifactById(scope, input.subjectArtifactId)
  if (!subject) throw new Error('Subject integrity artifact was not found.')
  const attestorPublicKey = challenge.statement.attestorPublicKey
  const organization = challenge.statement.organization
  const signedAt = challenge.statement.signedAt
  const statement = challenge.statement
  const statementHash = challenge.statementHash
  const signature = parseSignature(input.signature)
  if (!Keypair.fromPublicKey(attestorPublicKey).verify(Buffer.from(statementHash, 'hex'), signature)) {
    throw new Error('Publisher attestation signature is invalid.')
  }
  const existing = await runTenantOperation<{ rows: Array<{ id: string; attestation_artifact_id: string }> }>(
    scope.tenantId,
    client => client.query(`
      SELECT id, attestation_artifact_id FROM integrity_publisher_attestations
      WHERE tenant_id = $1 AND workspace_id = $2
        AND subject_artifact_id = $3 AND attestor_public_key = $4
    `, [scope.tenantId, scope.workspaceId, subject.id, attestorPublicKey]),
  )
  if (existing.rows[0]) throw new Error('This Stellar account has already attested to the artifact.')
  const attestationArtifact = await enqueueIntegrityArtifact(scope, {
    artifactType: 'publisher-attestation',
    externalId: `publisher:${subject.id}:${attestorPublicKey}`.slice(0, 200),
    payload: { statement, signature: input.signature },
    visibility: input.visibility ?? subject.visibility,
    metadata: { subjectArtifactId: subject.id, organization, attestorPublicKey },
  }, actorId)
  const id = `integrity-attestation-${randomUUID()}`
  await runTenantOperation(scope.tenantId, client => client.query(`
    INSERT INTO integrity_publisher_attestations (
      id, tenant_id, workspace_id, subject_artifact_id, attestation_artifact_id,
      attestor_public_key, organization, statement_hash, signature, signed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (subject_artifact_id, attestor_public_key) DO NOTHING
  `, [
    id, scope.tenantId, scope.workspaceId, subject.id, attestationArtifact.id,
    attestorPublicKey, organization, statementHash, input.signature, signedAt,
  ]))
  return { id, subject, attestationArtifact, statementHash, verified: true }
}

export async function createReleaseGate(
  scope: IntegrityScope,
  input: {
    externalId: string
    subjectArtifactId: string
    requiredApprovals: number
    allowedApproverKeys: string[]
  },
  actorId: string,
) {
  const externalId = input.externalId.trim()
  if (!externalId || externalId.length > 200) throw new Error('externalId must contain 1 to 200 characters.')
  const subject = await getIntegrityArtifactById(scope, input.subjectArtifactId)
  if (!subject) throw new Error('Release subject artifact was not found.')
  const existing = await runTenantOperation<{ rows: Array<{ id: string }> }>(scope.tenantId, client => client.query(`
    SELECT id FROM integrity_release_gates
    WHERE tenant_id = $1 AND workspace_id = $2 AND external_id = $3
  `, [scope.tenantId, scope.workspaceId, externalId]))
  if (existing.rows[0]) throw new Error('A release gate with this externalId already exists.')
  const allowedApproverKeys = [...new Set(input.allowedApproverKeys.map(assertPublicKey))].sort()
  const requiredApprovals = Math.floor(input.requiredApprovals)
  if (requiredApprovals < 2 || requiredApprovals > allowedApproverKeys.length) {
    throw new Error('Release gates require at least two approvals and enough allowed approvers.')
  }
  const gateArtifact = await enqueueIntegrityArtifact(scope, {
    artifactType: 'release-gate',
    externalId,
    payload: {
      domain: 'votes-release-gate/v1',
      subjectArtifactId: subject.id,
      subjectContentHash: subject.contentHash,
      requiredApprovals,
      allowedApproverKeys,
    },
    visibility: 'private',
  }, actorId)
  const id = `integrity-release-gate-${randomUUID()}`
  const { rows } = await runTenantOperation<{ rows: Record<string, unknown>[] }>(scope.tenantId, client => client.query(`
    INSERT INTO integrity_release_gates (
      id, tenant_id, workspace_id, external_id, subject_artifact_id,
      required_approvals, allowed_approver_keys
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING *
  `, [id, scope.tenantId, scope.workspaceId, externalId, subject.id, requiredApprovals, JSON.stringify(allowedApproverKeys)]))
  const gate = rows[0]!
  return {
    id: String(gate.id),
    externalId: String(gate.external_id),
    status: String(gate.status),
    requiredApprovals: Number(gate.required_approvals),
    allowedApproverKeys,
    gateArtifact,
    subject,
  }
}

export async function approveReleaseGate(
  scope: IntegrityScope,
  gateId: string,
  input: {
    attestorPublicKey: string
    organization: string
    signedAt: string
    signature: string
  },
  actorId: string,
) {
  const { rows } = await runTenantOperation<{ rows: Record<string, any>[] }>(scope.tenantId, client => client.query(`
    SELECT gate.*, artifact.id AS gate_artifact_id
    FROM integrity_release_gates gate
    JOIN integrity_artifact_anchors artifact
      ON artifact.tenant_id = gate.tenant_id AND artifact.workspace_id = gate.workspace_id
      AND artifact.artifact_type = 'release-gate' AND artifact.external_id = gate.external_id
    WHERE gate.tenant_id = $1 AND gate.workspace_id = $2 AND gate.id = $3
    ORDER BY artifact.revision DESC LIMIT 1
  `, [scope.tenantId, scope.workspaceId, gateId]))
  const gate = rows[0]
  if (!gate) throw new Error('Release gate was not found.')
  const allowed = gate.allowed_approver_keys as string[]
  if (!allowed.includes(input.attestorPublicKey)) throw new Error('This Stellar account is not an allowed release approver.')
  const attestation = await createPublisherAttestation(scope, {
    subjectArtifactId: gate.gate_artifact_id,
    ...input,
    visibility: 'private',
  }, actorId)
  await runTenantOperation(scope.tenantId, client => client.query(`
    INSERT INTO integrity_release_gate_approvals (
      id, tenant_id, workspace_id, gate_id, attestation_id, approver_public_key
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (gate_id, approver_public_key) DO NOTHING
  `, [
    `integrity-release-approval-${randomUUID()}`, scope.tenantId, scope.workspaceId,
    gateId, attestation.id, input.attestorPublicKey,
  ]))
  return evaluateReleaseGate(scope, gateId)
}

export async function evaluateReleaseGate(scope: IntegrityScope, gateId: string) {
  const { rows } = await runTenantOperation<{ rows: Record<string, any>[] }>(scope.tenantId, client => client.query(`
    SELECT gate.*,
      subject.status AS subject_status,
      subject.artifact_type AS subject_artifact_type,
      subject.content_hash AS subject_content_hash,
      gate_artifact.status AS gate_artifact_status,
      count(DISTINCT approval.approver_public_key) FILTER (
        WHERE attestation_artifact.status = 'confirmed'
      )::integer AS confirmed_approvals
    FROM integrity_release_gates gate
    JOIN integrity_artifact_anchors subject ON subject.id = gate.subject_artifact_id
    JOIN LATERAL (
      SELECT artifact.status, artifact.revision
      FROM integrity_artifact_anchors artifact
      WHERE artifact.tenant_id = gate.tenant_id AND artifact.workspace_id = gate.workspace_id
        AND artifact.artifact_type = 'release-gate' AND artifact.external_id = gate.external_id
      ORDER BY artifact.revision DESC LIMIT 1
    ) gate_artifact ON true
    LEFT JOIN integrity_release_gate_approvals approval ON approval.gate_id = gate.id
    LEFT JOIN integrity_publisher_attestations attestation ON attestation.id = approval.attestation_id
    LEFT JOIN integrity_artifact_anchors attestation_artifact ON attestation_artifact.id = attestation.attestation_artifact_id
    WHERE gate.tenant_id = $1 AND gate.workspace_id = $2 AND gate.id = $3
    GROUP BY gate.id, subject.status, subject.artifact_type, subject.content_hash, gate_artifact.status
    LIMIT 1
  `, [scope.tenantId, scope.workspaceId, gateId]))
  const gate = rows[0]
  if (!gate) return undefined
  const approved = gate.status !== 'revoked' && gate.subject_status === 'confirmed' &&
    gate.gate_artifact_status === 'confirmed' && Number(gate.confirmed_approvals) >= Number(gate.required_approvals)
  await runTenantOperation(scope.tenantId, client => client.query(`
    UPDATE integrity_release_gates SET status = CASE WHEN status = 'revoked' THEN status ELSE $2 END,
      approved_at = CASE WHEN $2 = 'approved' THEN COALESCE(approved_at, now()) ELSE NULL END,
      updated_at = now() WHERE id = $1
  `, [gateId, approved ? 'approved' : 'pending']))
  return {
    id: gate.id,
    externalId: gate.external_id,
    status: gate.status === 'revoked' ? 'revoked' : approved ? 'approved' : 'pending',
    subjectStatus: gate.subject_status,
    subjectArtifactType: gate.subject_artifact_type,
    subjectContentHash: gate.subject_content_hash,
    gateArtifactStatus: gate.gate_artifact_status,
    requiredApprovals: Number(gate.required_approvals),
    confirmedApprovals: Number(gate.confirmed_approvals),
    approved,
  }
}

export async function evaluateReleaseGateUnscoped(gateId: string) {
  const { rows } = await query(`SELECT tenant_id, workspace_id FROM integrity_release_gates WHERE id = $1`, [gateId])
  if (!rows[0]) return undefined
  return evaluateReleaseGate({ tenantId: rows[0].tenant_id, workspaceId: rows[0].workspace_id }, gateId)
}
