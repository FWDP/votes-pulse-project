import assert from 'node:assert/strict'
import test from 'node:test'

import {
    clearMemoryFieldReports,
    createFieldReport,
    getFieldReport,
    listFieldReportRecipients,
    listFieldReports,
    reviseFieldReportEvidence,
    synchronizeFieldReportRecipients,
    updateFieldReport,
} from '../src/services/fieldReports.service'
import { validateFieldReportPayload, type FieldReport } from '../../shared/fieldReports'

const scope = { tenantId: 'tenant-test', workspaceId: 'workspace-test' }

const makeReport = (): FieldReport => ({
    id: 'FR-LOCAL-001',
    clientId: 'client-test-001',
    title: 'Road obstruction near evacuation route',
    observation: 'A fallen tree is blocking one lane and requires follow-up.',
    topic: 'Infrastructure & Roads',
    severity: 'high',
    evidenceType: 'photo',
    status: 'queued',
    location: {
        label: 'Barangay Test',
        coordinates: {
            latitude: 14.5995,
            longitude: 120.9842,
            capturedAt: '2026-08-25T08:00:00.000Z',
        },
    },
    reporter: { id: 'reporter-test', displayName: 'Test Reporter' },
    attachments: [],
    occurredAt: '2026-08-25T08:00:00.000Z',
    createdAt: '2026-08-25T08:01:00.000Z',
    updatedAt: '2026-08-25T08:01:00.000Z',
    sync: { state: 'queued', retryCount: 0 },
})

test.beforeEach(() => clearMemoryFieldReports())

test('validates required report fields', () => {
    assert.deepEqual(validateFieldReportPayload(makeReport()), [])
    assert.ok(validateFieldReportPayload({ title: '' }).length > 0)
})

test('creates an idempotent report and updates review state', async () => {
    const input = makeReport()
    const created = await createFieldReport(scope, input)
    const duplicate = await createFieldReport(scope, input)

    assert.equal(created.id, duplicate.id)
    assert.equal(created.status, 'submitted')
    assert.equal(created.sync.state, 'synced')
    assert.equal((await listFieldReports(scope)).length, 1)
    assert.equal((await getFieldReport(scope, created.id))?.clientId, input.clientId)

    const updated = await updateFieldReport(scope, created.id, {
        status: 'under-review',
        assignedTo: 'Operations desk',
    })
    assert.equal(updated?.status, 'under-review')
    assert.equal(updated?.assignedTo, 'Operations desk')
})

test('creates an intentional evidence revision without changing report identity', async () => {
    const created = await createFieldReport(scope, makeReport())
    const revised = await reviseFieldReportEvidence(scope, created.id, {
        observation: `${created.observation} Additional verified detail.`,
        severity: 'critical',
    }, {
        id: created.reporter.id,
        email: created.reporter.email,
        displayName: created.reporter.displayName,
    })

    assert.equal(revised.unchanged, undefined)
    assert.equal(revised.report?.id, created.id)
    assert.equal(revised.report?.severity, 'critical')
    assert.match(revised.report?.observation ?? '', /Additional verified detail/)
})

test('isolates report lists by tenant and workspace', async () => {
    await createFieldReport(scope, makeReport())
    assert.deepEqual(await listFieldReports({ tenantId: 'another-tenant', workspaceId: 'workspace-test' }), [])
    assert.deepEqual(await listFieldReports({ tenantId: 'tenant-test', workspaceId: 'another-workspace' }), [])
})

test('exposes an authorized fallback recipient without a database', async () => {
    const recipients = await listFieldReportRecipients(scope)
    assert.equal(recipients.length, 1)
    assert.equal(recipients[0]?.id, 'operations-desk')
})

test('normalizes web accounts before synchronizing report recipients', async () => {
    const recipients = await synchronizeFieldReportRecipients(scope, [
        {
            id: ' user-marilao-local ',
            displayName: ' Marilao User ',
            email: ' MARILAO@EXAMPLE.TEST ',
        },
        {
            id: 'invalid-user',
            displayName: 'Missing email',
        },
        {
            id: 'user-superadmin-local',
            displayName: 'Super Admin',
            email: 'superadmin@example.test',
            isSuperadmin: true,
        },
    ])

    assert.deepEqual(recipients, [{
        id: 'user-marilao-local',
        displayName: 'Marilao User',
        email: 'marilao@example.test',
    }])
})

test('limits regular accounts to their reports while superadmins see every recipient', async () => {
    const marilaoReport = await createFieldReport(scope, {
        ...makeReport(),
        clientId: 'client-marilao',
        recipient: {
            id: 'user-marilao-local',
            displayName: 'Marilao User',
            email: 'marilao@example.test',
        },
        assignedTo: 'Marilao User',
    })
    await createFieldReport(scope, {
        ...makeReport(),
        clientId: 'client-navotas',
        recipient: {
            id: 'user-navotas-local',
            displayName: 'Navotas User',
            email: 'navotas@example.test',
        },
        assignedTo: 'Navotas User',
    })

    const marilaoReports = await listFieldReports(scope, {
        id: 'user-marilao-local',
        email: 'marilao@example.test',
        displayName: 'Marilao User',
    })
    const superadminReports = await listFieldReports(scope, {
        id: 'user-superadmin-local',
        isSuperadmin: true,
    })
    const reporterReports = await listFieldReports(scope, {
        id: 'reporter-test',
        displayName: 'Test Reporter',
    })

    assert.deepEqual(marilaoReports.map(report => report.clientId), ['client-marilao'])
    assert.equal(superadminReports.length, 2)
    assert.equal(reporterReports.length, 2)
    assert.equal(await getFieldReport(scope, marilaoReport.id, { id: 'user-navotas-local' }), undefined)
})
