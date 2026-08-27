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
] as const

export type IntegrityArtifactType = typeof integrityArtifactTypes[number]
export type IntegrityArtifactVisibility = 'private' | 'public'
export type IntegrityArtifactStatus = 'pending' | 'submitting' | 'confirmed' | 'failed'

export interface IntegrityArtifactInput {
  artifactType: IntegrityArtifactType
  externalId: string
  payload?: unknown
  contentHash?: string
  schemaVersion?: number
  visibility?: IntegrityArtifactVisibility
  metadata?: Record<string, unknown>
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
  metadata: Record<string, unknown>
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
