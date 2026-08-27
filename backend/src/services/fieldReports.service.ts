import { randomUUID } from 'node:crypto'

import type {
    FieldReport,
    FieldReportEvidenceRevisionInput,
    FieldReportRecipient,
    FieldReportStatus,
} from '../../../shared/fieldReports'
import { dbEnabled, runTenantOperation } from '../db'
import {
    attachIntegritiesToReports,
    enqueueReportIntegrity,
    enqueueReportRevision,
    enqueueReviewAttestation,
} from '../integrity/integrityRepository'
import { hashReportForIntegrity } from '../integrity/canonicalizeReport'

export interface FieldReportScope {
    tenantId: string
    workspaceId: string
}

export interface FieldReportViewer {
    id?: string
    email?: string
    displayName?: string
    isSuperadmin?: boolean
}

const reportStore = (() => {
    const root = globalThis as typeof globalThis & {
        __votesPulseFieldReports?: Map<string, FieldReport>
    }
    root.__votesPulseFieldReports ??= new Map()
    return root.__votesPulseFieldReports
})()

const useDatabase = () => dbEnabled && process.env.FIELD_REPORTS_MEMORY_ONLY !== 'true'

const fallbackRecipients: FieldReportRecipient[] = [
    { id: 'operations-desk', displayName: 'VOTES Operations Desk' },
]

export interface WebAccountRecipientInput extends FieldReportRecipient {
    isSuperadmin?: boolean
}

const scopeKey = (scope: FieldReportScope, report: Pick<FieldReport, 'id'>) =>
    `${scope.tenantId}:${scope.workspaceId}:${report.id}`

const canViewReport = (report: FieldReport, viewer?: FieldReportViewer) => {
    if (!viewer || viewer.isSuperadmin) return true

    const recipientEmail = report.recipient?.email?.trim().toLowerCase()
    const reporterEmail = report.reporter.email?.trim().toLowerCase()
    const viewerEmail = viewer.email?.trim().toLowerCase()
    return Boolean(
        (viewer.id && report.recipient?.id === viewer.id) ||
        (viewerEmail && recipientEmail === viewerEmail) ||
        (viewer.displayName && report.assignedTo === viewer.displayName) ||
        (viewer.id && report.reporter.id === viewer.id) ||
        (viewerEmail && reporterEmail === viewerEmail),
    )
}

const prepareStoredReport = (input: FieldReport): FieldReport => {
    const now = new Date().toISOString()
    return {
        ...input,
        id: `FR-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        status: 'submitted',
        submittedAt: input.submittedAt ?? now,
        updatedAt: now,
        sync: { state: 'synced', retryCount: input.sync?.retryCount ?? 0 },
        attachments: input.attachments.map(attachment => ({
            ...attachment,
            localUri: undefined,
            uploadStatus: attachment.remoteUrl ? 'uploaded' : attachment.uploadStatus,
        })),
    }
}

export async function listFieldReportRecipients(scope: FieldReportScope): Promise<FieldReportRecipient[]> {
    if (!useDatabase()) return fallbackRecipients

    return runTenantOperation(scope.tenantId, async client => {
        const { rows } = await client.query(`
            SELECT DISTINCT u.id, u.display_name, u.email
            FROM users u
            JOIN memberships m ON m.user_id = u.id
            WHERE m.tenant_id = $1
              AND m.status = 'active'
              AND u.status = 'active'
              AND lower(COALESCE(m.role, '')) <> 'superadmin'
              AND (
                m.workspace_ids IS NULL
                OR m.workspace_ids = 'null'::jsonb
                OR m.workspace_ids ? $2
              )
            ORDER BY u.display_name, u.email
        `, [scope.tenantId, scope.workspaceId])
        return rows.map((row: { id: string; display_name?: string; email?: string }) => ({
            id: row.id,
            displayName: row.display_name ?? row.email ?? 'VOTES account',
            email: row.email,
        }))
    })
}

export async function synchronizeFieldReportRecipients(
    scope: FieldReportScope,
    accounts: WebAccountRecipientInput[],
): Promise<FieldReportRecipient[]> {
    const sanitized = accounts
        .map(account => ({
            id: account.id.trim().slice(0, 160),
            displayName: account.displayName.trim().slice(0, 200),
            email: account.email?.trim().toLowerCase().slice(0, 320),
            isSuperadmin: Boolean(account.isSuperadmin),
        }))
        .filter(account => account.id && account.displayName && account.email)

    if (!useDatabase()) {
        return sanitized
            .filter(account => !account.isSuperadmin)
            .map(({ id, displayName, email }) => ({ id, displayName, email }))
    }

    await runTenantOperation(scope.tenantId, async client => {
        for (const account of sanitized) {
            const existing = await client.query(`
                SELECT id FROM users
                WHERE id = $1 OR lower(email) = $2
                ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
                LIMIT 1
            `, [account.id, account.email])
            const userId = existing.rows[0]?.id ?? account.id

            if (existing.rows[0]) {
                await client.query(`
                    UPDATE users
                    SET email = $2, display_name = $3, status = 'active'
                    WHERE id = $1
                `, [userId, account.email, account.displayName])
            } else {
                await client.query(`
                    INSERT INTO users (id, email, display_name, status)
                    VALUES ($1, $2, $3, 'active')
                `, [userId, account.email, account.displayName])
            }

            await client.query(`
                INSERT INTO memberships (id, tenant_id, user_id, role, status, workspace_ids)
                VALUES ($1, $2, $3, $4, 'active', to_jsonb(ARRAY[$5]::text[]))
                ON CONFLICT (tenant_id, user_id)
                DO UPDATE SET
                  status = 'active',
                  role = CASE
                    WHEN EXCLUDED.role = 'superadmin' THEN EXCLUDED.role
                    WHEN memberships.role IN ('owner', 'administrator', 'superadmin') THEN memberships.role
                    ELSE EXCLUDED.role
                  END,
                  workspace_ids = CASE
                    WHEN memberships.workspace_ids IS NULL OR memberships.workspace_ids = 'null'::jsonb
                      THEN memberships.workspace_ids
                    ELSE memberships.workspace_ids || EXCLUDED.workspace_ids
                  END
            `, [
                `membership-web-${userId}`,
                scope.tenantId,
                userId,
                account.isSuperadmin ? 'superadmin' : 'viewer',
                scope.workspaceId,
            ])
        }
    })

    return listFieldReportRecipients(scope)
}

export async function listFieldReports(
    scope: FieldReportScope,
    viewer?: FieldReportViewer,
): Promise<FieldReport[]> {
    if (!useDatabase()) {
        return [...reportStore.entries()]
            .filter(([key]) => key.startsWith(`${scope.tenantId}:${scope.workspaceId}:`))
            .map(([, report]) => report)
            .filter(report => canViewReport(report, viewer))
            .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    }

    return runTenantOperation(scope.tenantId, async client => {
        const { rows } = await client.query(`
            SELECT payload
            FROM field_reports
            WHERE tenant_id = $1 AND workspace_id = $2
              AND (
                $3::boolean
                OR payload->'recipient'->>'id' = $4
                OR lower(payload->'recipient'->>'email') = $5
                OR payload->>'assignedTo' = $6
                OR payload->'reporter'->>'id' = $4
                OR lower(payload->'reporter'->>'email') = $5
              )
            ORDER BY updated_at DESC, created_at DESC
            LIMIT 500
        `, [
            scope.tenantId,
            scope.workspaceId,
            !viewer || Boolean(viewer.isSuperadmin),
            viewer?.id ?? '',
            viewer?.email?.trim().toLowerCase() ?? '',
            viewer?.displayName ?? '',
        ])
        const reports = rows.map((row: { payload: FieldReport }) => row.payload)
        return attachIntegritiesToReports(client, scope, reports)
    })
}

export async function getFieldReport(
    scope: FieldReportScope,
    id: string,
    viewer?: FieldReportViewer,
): Promise<FieldReport | undefined> {
    if (!useDatabase()) {
        const report = reportStore.get(`${scope.tenantId}:${scope.workspaceId}:${id}`)
        return report && canViewReport(report, viewer) ? report : undefined
    }

    return runTenantOperation(scope.tenantId, async client => {
        const { rows } = await client.query(`
            SELECT payload FROM field_reports
            WHERE tenant_id = $1 AND workspace_id = $2 AND id = $3
              AND (
                $4::boolean
                OR payload->'recipient'->>'id' = $5
                OR lower(payload->'recipient'->>'email') = $6
                OR payload->>'assignedTo' = $7
                OR payload->'reporter'->>'id' = $5
                OR lower(payload->'reporter'->>'email') = $6
              )
            LIMIT 1
        `, [
            scope.tenantId,
            scope.workspaceId,
            id,
            !viewer || Boolean(viewer.isSuperadmin),
            viewer?.id ?? '',
            viewer?.email?.trim().toLowerCase() ?? '',
            viewer?.displayName ?? '',
        ])
        const report = rows[0]?.payload as FieldReport | undefined
        if (!report) return undefined
        return (await attachIntegritiesToReports(client, scope, [report]))[0]
    })
}

export async function createFieldReport(scope: FieldReportScope, input: FieldReport): Promise<FieldReport> {
    const existing = (await listFieldReports(scope)).find(report => report.clientId === input.clientId)
    if (existing) return existing

    const report = prepareStoredReport(input)
    if (!useDatabase()) {
        reportStore.set(scopeKey(scope, report), report)
        return report
    }

    return runTenantOperation(scope.tenantId, async client => {
        const { rows } = await client.query(`
            INSERT INTO field_reports (
                id, tenant_id, workspace_id, client_id, title, observation, topic,
                region, province, district, location, submitted_at, submitted_by,
                created_by_user_id, status, severity, evidence_type, occurred_at,
                assigned_to, payload, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18,
                $19, $20::jsonb, $21
            )
            ON CONFLICT (tenant_id, workspace_id, client_id)
            WHERE client_id IS NOT NULL
            DO UPDATE SET payload = field_reports.payload
            RETURNING payload
        `, [
            report.id,
            scope.tenantId,
            scope.workspaceId,
            report.clientId,
            report.title,
            report.observation,
            report.topic,
            report.location.regionName ?? '',
            report.location.provinceName ?? '',
            report.location.barangayName ?? '',
            report.location.label,
            report.submittedAt,
            report.reporter.displayName,
            report.reporter.id,
            report.status,
            report.severity,
            report.evidenceType,
            report.occurredAt,
            report.assignedTo ?? '',
            JSON.stringify(report),
            report.updatedAt,
        ])
        const storedReport = rows[0].payload as FieldReport
        const integrity = await enqueueReportIntegrity(client, scope, storedReport)
        return { ...storedReport, integrity }
    })
}

export async function updateFieldReport(
    scope: FieldReportScope,
    id: string,
    update: { status?: FieldReportStatus; assignedTo?: string },
    viewer?: FieldReportViewer,
): Promise<FieldReport | undefined> {
    const current = await getFieldReport(scope, id, viewer)
    if (!current) return undefined
    const { integrity: _currentIntegrity, ...currentWithoutIntegrity } = current
    const statusChanged = Boolean(update.status && update.status !== current.status)

    const report: FieldReport = {
        ...currentWithoutIntegrity,
        ...(update.status ? { status: update.status } : {}),
        ...(update.assignedTo !== undefined ? { assignedTo: update.assignedTo } : {}),
        updatedAt: new Date().toISOString(),
    }

    if (!useDatabase()) {
        reportStore.set(scopeKey(scope, report), report)
        return report
    }

    return runTenantOperation(scope.tenantId, async client => {
        const { rows } = await client.query(`
            UPDATE field_reports
            SET status = $4, assigned_to = $5, payload = $6::jsonb, updated_at = $7
            WHERE tenant_id = $1 AND workspace_id = $2 AND id = $3
            RETURNING payload
        `, [scope.tenantId, scope.workspaceId, id, report.status, report.assignedTo ?? '', JSON.stringify(report), report.updatedAt])
        const storedReport = rows[0]?.payload as FieldReport | undefined
        if (!storedReport) return undefined
        if (statusChanged && update.status) {
            await enqueueReviewAttestation(
                client,
                scope,
                storedReport,
                update.status,
                viewer?.id ?? 'system-reviewer',
            )
        }
        return (await attachIntegritiesToReports(client, scope, [storedReport]))[0]
    })
}

export async function reviseFieldReportEvidence(
    scope: FieldReportScope,
    id: string,
    update: FieldReportEvidenceRevisionInput,
    viewer: FieldReportViewer,
): Promise<{ report?: FieldReport; unchanged?: boolean }> {
    const current = await getFieldReport(scope, id, viewer)
    if (!current) return {}
    const { integrity: _currentIntegrity, ...currentWithoutIntegrity } = current
    const report: FieldReport = {
        ...currentWithoutIntegrity,
        ...(update.title !== undefined ? { title: update.title } : {}),
        ...(update.observation !== undefined ? { observation: update.observation } : {}),
        ...(update.topic !== undefined ? { topic: update.topic } : {}),
        ...(update.severity !== undefined ? { severity: update.severity } : {}),
        ...(update.evidenceType !== undefined ? { evidenceType: update.evidenceType } : {}),
        ...(update.location !== undefined ? { location: update.location } : {}),
        ...(update.attachments !== undefined ? { attachments: update.attachments } : {}),
        ...(update.occurredAt !== undefined ? { occurredAt: update.occurredAt } : {}),
        updatedAt: new Date().toISOString(),
    }
    if (hashReportForIntegrity(current).contentHash === hashReportForIntegrity(report).contentHash) {
        return { report: current, unchanged: true }
    }

    if (!useDatabase()) {
        reportStore.set(scopeKey(scope, report), report)
        return { report }
    }

    return runTenantOperation(scope.tenantId, async client => {
        const { rows } = await client.query(`
            UPDATE field_reports
            SET title = $4, observation = $5, topic = $6,
                region = $7, province = $8, district = $9, location = $10,
                severity = $11, evidence_type = $12, occurred_at = $13,
                payload = $14::jsonb, updated_at = $15
            WHERE tenant_id = $1 AND workspace_id = $2 AND id = $3
            RETURNING payload
        `, [
            scope.tenantId,
            scope.workspaceId,
            id,
            report.title,
            report.observation,
            report.topic,
            report.location.regionName ?? '',
            report.location.provinceName ?? '',
            report.location.barangayName ?? '',
            report.location.label,
            report.severity,
            report.evidenceType,
            report.occurredAt,
            JSON.stringify(report),
            report.updatedAt,
        ])
        const storedReport = rows[0]?.payload as FieldReport | undefined
        if (!storedReport) return {}
        const integrity = await enqueueReportRevision(
            client,
            scope,
            storedReport,
            viewer.id ?? 'system-editor',
        )
        return { report: { ...storedReport, integrity } }
    })
}

export const clearMemoryFieldReports = () => reportStore.clear()
