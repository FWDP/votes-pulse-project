import assert from 'node:assert/strict'
import test from 'node:test'

import type { FieldReport } from '../../shared/fieldReports'
import {
  buildReportIntegrityManifest,
  canonicalizeJson,
  hashReportForIntegrity,
  hashReviewAttestation,
} from '../src/integrity/canonicalizeReport'
import { canonicalizeArtifact, hashArtifact } from '../src/integrity/canonicalizeArtifact'

const makeReport = (): FieldReport => ({
  id: 'FR-2026-TEST',
  clientId: 'client-test',
  title: 'Road obstruction',
  observation: 'A fallen tree blocks the evacuation route.',
  topic: 'Infrastructure & Roads',
  severity: 'high',
  evidenceType: 'photo',
  status: 'submitted',
  location: {
    label: 'Barangay Test',
    regionCode: '13',
    coordinates: {
      latitude: 14.5995,
      longitude: 120.9842,
      capturedAt: '2026-08-25T08:00:00.000Z',
    },
  },
  reporter: { id: 'reporter-test', displayName: 'Test Reporter' },
  attachments: [{
    id: 'attachment-1',
    kind: 'image',
    name: 'evidence.jpg',
    mimeType: 'image/jpeg',
    size: 1234,
    sha256: 'ab'.repeat(32),
    uploadStatus: 'uploaded',
  }],
  occurredAt: '2026-08-25T08:00:00.000Z',
  createdAt: '2026-08-25T08:01:00.000Z',
  updatedAt: '2026-08-25T08:01:00.000Z',
  submittedAt: '2026-08-25T08:01:00.000Z',
  sync: { state: 'synced', retryCount: 0 },
})

test('canonical JSON is stable across object property order', () => {
  assert.equal(
    canonicalizeJson({ z: 3, a: { y: 2, x: 1 } }),
    canonicalizeJson({ a: { x: 1, y: 2 }, z: 3 }),
  )
})

test('generic integrity artifacts produce stable SHA-256 commitments', () => {
  const left = { version: 2, rows: [{ id: 'a', score: 9 }], source: 'survey' }
  const right = { source: 'survey', rows: [{ score: 9, id: 'a' }], version: 2 }
  assert.equal(canonicalizeArtifact(left), canonicalizeArtifact(right))
  assert.equal(hashArtifact(left), hashArtifact(right))
  assert.equal(hashArtifact(left).length, 64)
})

test('report digest includes evidence but excludes operational state', () => {
  const report = makeReport()
  const original = hashReportForIntegrity(report)
  const workflowUpdate = hashReportForIntegrity({
    ...report,
    status: 'under-review',
    assignedTo: 'Operations desk',
    updatedAt: '2026-08-26T10:00:00.000Z',
    sync: { state: 'failed', retryCount: 4, lastError: 'offline' },
  })
  const evidenceUpdate = hashReportForIntegrity({
    ...report,
    observation: `${report.observation} Updated evidence.`,
  })

  assert.equal(original.contentHash, workflowUpdate.contentHash)
  assert.notEqual(original.contentHash, evidenceUpdate.contentHash)
  assert.equal(original.contentHash.length, 64)
})

test('integrity manifest never exposes sync, assignment, email, or remote URLs', () => {
  const report = makeReport()
  report.reporter.email = 'private@example.test'
  report.assignedTo = 'Private recipient'
  report.attachments[0]!.remoteUrl = '/api/reports/files/private.jpg'
  const manifest = JSON.stringify(buildReportIntegrityManifest(report))

  assert.equal(manifest.includes('private@example.test'), false)
  assert.equal(manifest.includes('Private recipient'), false)
  assert.equal(manifest.includes('/api/reports/files/private.jpg'), false)
  assert.equal(manifest.includes('sync'), false)
})

test('review attestations bind status changes to the previous digest', () => {
  const base = {
    reportId: 'FR-2026-TEST',
    revision: 2,
    status: 'verified' as const,
    actorId: 'reviewer-1',
    attestedAt: '2026-08-26T12:00:00.000Z',
    previousHash: 'ab'.repeat(32),
  }
  const verified = hashReviewAttestation(base)
  const rejected = hashReviewAttestation({ ...base, status: 'rejected' })

  assert.equal(verified.contentHash.length, 64)
  assert.notEqual(verified.contentHash, rejected.contentHash)
})
