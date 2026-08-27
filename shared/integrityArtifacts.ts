export const integrityArtifactTypes = [
  'survey-schema',
  'survey-batch',
  'dataset-snapshot',
  'social-batch',
  'analytics-snapshot',
  'ai-attestation',
  'configuration-approval',
  'export-manifest',
  'admin-audit',
  'release-approval',
  'publisher-attestation',
  'release-gate',
] as const

export type IntegrityArtifactType = typeof integrityArtifactTypes[number]
export type IntegrityArtifactVisibility = 'private' | 'public'
export type IntegrityArtifactStatus = 'pending' | 'submitting' | 'confirmed' | 'failed'

export interface IntegrityArtifactProvenance {
  sourceName: string
  sourceUri?: string
  publisher?: string
  retrievedAt: string
  sourceVersion?: string
  license?: string
  sourceDigest?: string
}

export interface IntegrityArtifactInput {
  artifactType: IntegrityArtifactType
  externalId: string
  payload?: unknown
  contentHash?: string
  schemaVersion?: number
  visibility?: IntegrityArtifactVisibility
  metadata?: Record<string, unknown>
  provenance?: IntegrityArtifactProvenance
}

export interface IntegrityArtifactAnchor {
  id: string
  artifactType: IntegrityArtifactType
  externalId: string
  revision: number
  receipt: string
  contentHash: string
  subjectHash?: string
  previousHash?: string
  schemaVersion: number
  visibility: IntegrityArtifactVisibility
  status: IntegrityArtifactStatus
  transactionHash?: string
  ledgerSequence?: number
  confirmedAt?: string
  reconciliationStatus?: 'verified' | 'missing' | 'mismatch' | 'error'
  provenance?: IntegrityArtifactProvenance
  provenanceHash?: string
  metadata: Record<string, unknown>
}

export interface IntegrityMerkleBatchInput extends Omit<IntegrityArtifactInput, 'payload' | 'contentHash'> {
  items: Array<unknown | { contentHash: string }>
}

export interface IntegrityMerkleProofStep {
  position: 'left' | 'right'
  hash: string
}

export interface IntegrityMerkleProof {
  algorithm: 'sha256-domain-v1'
  rootHash: string
  leafHash: string
  leafIndex: number
  leafCount: number
  proof: IntegrityMerkleProofStep[]
}

export interface PublicIntegrityVerification {
  verified: boolean
  source: 'field-report' | 'artifact'
  network: string
  contractId?: string
  receipt: string
  revision: number
  contentHash: string
  subjectHash?: string
  previousHash?: string
  transactionHash?: string
  ledgerSequence?: number
  confirmedAt?: string
  chainValid: boolean
  artifactType?: IntegrityArtifactType
  schemaVersion: number
  onChainVerified?: boolean
  verifiedAt?: string
}
