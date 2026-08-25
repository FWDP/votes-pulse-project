export type FieldReportSeverity = 'low' | 'medium' | 'high' | 'critical'

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

export type FieldReportAttachmentKind = 'image' | 'document' | 'audio' | 'other'

export interface FieldReportCoordinates {
    latitude: number
    longitude: number
    accuracyMeters?: number
    capturedAt: string
}

export interface FieldReportLocation {
    label: string
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
    uploadStatus: 'local' | 'queued' | 'uploading' | 'uploaded' | 'failed'
}

export interface FieldReportReporter {
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
    clientId: string
    title: string
    observation: string
    topic: string
    severity: FieldReportSeverity
    evidenceType: FieldReportEvidenceType
    status: FieldReportStatus
    location: FieldReportLocation
    reporter: FieldReportReporter
    attachments: FieldReportAttachment[]
    occurredAt: string
    createdAt: string
    updatedAt: string
    submittedAt?: string
    sync: FieldReportSyncState
}

export interface CreateFieldReportInput {
    title: string
    observation: string
    topic: string
    severity: FieldReportSeverity
    evidenceType: FieldReportEvidenceType
    location: FieldReportLocation
    attachments: FieldReportAttachment[]
    occurredAt: string
}

export interface FieldReportListResponse {
    data: FieldReport[]
    count: number
}

export interface FieldReportDetailResponse {
    data: FieldReport
}
