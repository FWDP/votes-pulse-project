export type FieldReportSeverity = 'low' | 'medium' | 'high' | 'critical'

export const FIELD_REPORT_SEVERITIES: FieldReportSeverity[] = ['low', 'medium', 'high', 'critical']

export type FieldReportStatus =
    | 'draft'
    | 'queued'
    | 'submitted'
    | 'under-review'
    | 'verified'
    | 'needs-follow-up'
    | 'rejected'
    | 'sync-failed'

export type FieldReportEvidenceType =
    | 'photo'
    | 'interview'
    | 'survey'
    | 'document'
    | 'other'

export const FIELD_REPORT_EVIDENCE_TYPES: FieldReportEvidenceType[] = [
    'photo',
    'interview',
    'survey',
    'document',
    'other',
]

export type FieldReportAttachmentKind = 'image' | 'document' | 'audio' | 'other'

export interface FieldReportCoordinates {
    latitude: number
    longitude: number
    accuracyMeters?: number
    capturedAt: string
}

export interface FieldReportLocation {
    label: string
    localityType?: 'city' | 'municipality'
    regionCode?: string
    regionName?: string
    provinceCode?: string
    provinceName?: string
    localityCode?: string
    localityName?: string
    barangayCode?: string
    barangayName?: string
    coordinates?: FieldReportCoordinates
}

export interface FieldReportAttachment {
    id: string
    kind: FieldReportAttachmentKind
    name: string
    mimeType: string
    size?: number
    localUri?: string
    remoteUrl?: string
    /** SHA-256 of the uploaded bytes, calculated by the API. */
    sha256?: string
    uploadStatus: 'local' | 'queued' | 'uploading' | 'uploaded' | 'failed'
}

export type FieldReportIntegrityStatus =
    | 'not-configured'
    | 'pending'
    | 'submitting'
    | 'confirmed'
    | 'failed'

export type FieldReportIntegrityAnchorType = 'report' | 'review-attestation'

export interface FieldReportIntegrityRevision {
    status: FieldReportIntegrityStatus
    revision: number
    anchorType: FieldReportIntegrityAnchorType
    contentHash?: string
    previousHash?: string
    transactionHash?: string
    ledgerSequence?: number
    confirmedAt?: string
}

export interface FieldReportIntegrity {
    status: FieldReportIntegrityStatus
    revision: number
    anchorType?: FieldReportIntegrityAnchorType
    network?: string
    contractId?: string
    reportKey?: string
    contentHash?: string
    previousHash?: string
    transactionHash?: string
    ledgerSequence?: number
    attempts?: number
    lastError?: string
    confirmedAt?: string
    matchesCurrentReport?: boolean
    chainValid?: boolean
    history?: FieldReportIntegrityRevision[]
}

export interface FieldReportIntegrityHealth {
    configured: boolean
    enabled: boolean
    healthy: boolean
    network: string
    contractId?: string
    signerMode: 'local' | 'remote' | 'unconfigured'
    pending: number
    stalePending: number
    failed: number
    ttlDue: number
    artifactPending?: number
    reconciliationFailures?: number
    openIncidents?: number
    eventLastIngestedAt?: string
    oldestPendingAt?: string
    alerts: string[]
}

export interface FieldReportIntegrityAuditEntry {
    reportId: string
    reportTitle: string
    revision: number
    anchorType: FieldReportIntegrityAnchorType
    contentHash: string
    previousHash?: string
    transactionHash: string
    ledgerSequence: number
    confirmedAt: string
    actorId?: string
}

export interface FieldReportReporter {
    id: string
    displayName: string
    email?: string
}

export interface FieldReportRecipient {
    id: string
    displayName: string
    email?: string
}

export interface FieldReportSyncState {
    state: 'local' | 'queued' | 'syncing' | 'synced' | 'failed'
    retryCount: number
    lastAttemptAt?: string
    lastError?: string
}

export interface FieldReport {
    id: string
    serverId?: string
    clientId: string
    title: string
    observation: string
    topic: string
    severity: FieldReportSeverity
    evidenceType: FieldReportEvidenceType
    status: FieldReportStatus
    location: FieldReportLocation
    reporter: FieldReportReporter
    recipient?: FieldReportRecipient
    assignedTo?: string
    attachments: FieldReportAttachment[]
    occurredAt: string
    createdAt: string
    updatedAt: string
    submittedAt?: string
    sync: FieldReportSyncState
    integrity?: FieldReportIntegrity
}

export interface CreateFieldReportInput {
    title: string
    observation: string
    topic: string
    severity: FieldReportSeverity
    evidenceType: FieldReportEvidenceType
    location: FieldReportLocation
    recipient?: FieldReportRecipient
    attachments: FieldReportAttachment[]
    occurredAt: string
}

export interface FieldReportEvidenceRevisionInput {
    title?: string
    observation?: string
    topic?: string
    severity?: FieldReportSeverity
    evidenceType?: FieldReportEvidenceType
    location?: FieldReportLocation
    attachments?: FieldReportAttachment[]
    occurredAt?: string
}

export interface FieldReportListResponse {
    data: FieldReport[]
    count: number
}

export interface FieldReportDetailResponse {
    data: FieldReport
}

export interface FieldReportRecipientListResponse {
    data: FieldReportRecipient[]
    count: number
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const validateFieldReportPayload = (value: unknown): string[] => {
    if (!isObject(value)) return ['Report payload must be an object.']

    const errors: string[] = []
    const requiredText: Array<[string, number]> = [
        ['clientId', 160],
        ['title', 240],
        ['observation', 5000],
        ['topic', 160],
        ['occurredAt', 80],
    ]

    requiredText.forEach(([field, maxLength]) => {
        const fieldValue = value[field]
        if (typeof fieldValue !== 'string' || !fieldValue.trim()) {
            errors.push(`${field} is required.`)
        } else if (fieldValue.length > maxLength) {
            errors.push(`${field} exceeds ${maxLength} characters.`)
        }
    })

    if (!FIELD_REPORT_SEVERITIES.includes(value.severity as FieldReportSeverity)) {
        errors.push('severity is invalid.')
    }
    if (!FIELD_REPORT_EVIDENCE_TYPES.includes(value.evidenceType as FieldReportEvidenceType)) {
        errors.push('evidenceType is invalid.')
    }

    if (!isObject(value.location) || typeof value.location.label !== 'string' || !value.location.label.trim()) {
        errors.push('location.label is required.')
    } else if (isObject(value.location.coordinates)) {
        const latitude = value.location.coordinates.latitude
        const longitude = value.location.coordinates.longitude
        if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
            errors.push('location.coordinates.latitude is invalid.')
        }
        if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
            errors.push('location.coordinates.longitude is invalid.')
        }
    }
    if (!Array.isArray(value.attachments) || value.attachments.length > 10) {
        errors.push('attachments must contain at most 10 items.')
    }
    if (!isObject(value.reporter) || typeof value.reporter.id !== 'string' || typeof value.reporter.displayName !== 'string') {
        errors.push('reporter identity is required.')
    }

    return errors
}
