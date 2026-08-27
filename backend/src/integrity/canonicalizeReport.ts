import { createHash } from 'node:crypto'

import type { FieldReport, FieldReportStatus } from '../../../shared/fieldReports'

export const REPORT_INTEGRITY_SCHEMA_VERSION = 1
export const REPORT_INTEGRITY_SCHEMA = `pulse-field-report-integrity/v${REPORT_INTEGRITY_SCHEMA_VERSION}`

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

/** Deterministic JSON encoding: object keys are sorted and undefined values are omitted. */
export const canonicalizeJson = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Integrity manifests cannot contain non-finite numbers.')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(item => canonicalizeJson(item ?? null)).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const entries = Object.keys(record)
      .filter(key => record[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalizeJson(record[key])}`)
    return `{${entries.join(',')}}`
  }
  throw new Error(`Unsupported integrity manifest value: ${typeof value}`)
}

export const buildReportIntegrityManifest = (report: FieldReport): JsonValue => ({
  schema: REPORT_INTEGRITY_SCHEMA,
  reportId: report.id,
  revision: 1,
  submittedAt: report.submittedAt ?? report.createdAt,
  content: {
    title: report.title,
    observation: report.observation,
    topic: report.topic,
    severity: report.severity,
    evidenceType: report.evidenceType,
    occurredAt: report.occurredAt,
    location: {
      label: report.location.label,
      localityType: report.location.localityType ?? null,
      regionCode: report.location.regionCode ?? null,
      regionName: report.location.regionName ?? null,
      provinceCode: report.location.provinceCode ?? null,
      provinceName: report.location.provinceName ?? null,
      localityCode: report.location.localityCode ?? null,
      localityName: report.location.localityName ?? null,
      barangayCode: report.location.barangayCode ?? null,
      barangayName: report.location.barangayName ?? null,
      coordinates: report.location.coordinates
        ? {
            latitude: report.location.coordinates.latitude,
            longitude: report.location.coordinates.longitude,
            accuracyMeters: report.location.coordinates.accuracyMeters ?? null,
            capturedAt: report.location.coordinates.capturedAt,
          }
        : null,
    },
    reporter: {
      id: report.reporter.id,
      displayName: report.reporter.displayName,
    },
    attachments: report.attachments.map(attachment => ({
      id: attachment.id,
      kind: attachment.kind,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size ?? null,
      sha256: attachment.sha256 ?? null,
    })),
  },
})

export const hashReportForIntegrity = (report: FieldReport) => {
  const manifest = buildReportIntegrityManifest(report)
  const canonicalManifest = canonicalizeJson(manifest)
  return {
    schemaVersion: REPORT_INTEGRITY_SCHEMA_VERSION,
    canonicalManifest,
    contentHash: createHash('sha256').update(canonicalManifest, 'utf8').digest('hex'),
  }
}

export interface ReviewAttestationInput {
  reportId: string
  revision: number
  status: FieldReportStatus
  actorId: string
  attestedAt: string
  previousHash: string
}

export const hashReviewAttestation = (input: ReviewAttestationInput) => {
  const manifest = {
    schema: 'pulse-field-report-review-attestation/v1',
    reportId: input.reportId,
    revision: input.revision,
    status: input.status,
    actorId: input.actorId,
    attestedAt: input.attestedAt,
    previousHash: input.previousHash,
  }
  const canonicalManifest = canonicalizeJson(manifest)
  return {
    schemaVersion: 1,
    canonicalManifest,
    contentHash: createHash('sha256').update(canonicalManifest, 'utf8').digest('hex'),
  }
}
