import { randomUUID } from 'node:crypto'

import type { FieldReport, FieldReportRecipient, FieldReportStatus } from '../../../shared/fieldReports'
import { dbEnabled, runTenantOperation } from '../db'

export interface FieldReportScope {
    tenantId: string
    workspaceId: string
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

const scopeKey = (scope: FieldReportScope, report: Pick<FieldReport, 'id'>) =>
    `${scope.tenantId}:${scope.workspaceId}:${report.id}`

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
            FROM memberships m
            JOIN users u ON u.id = m.user_id
            WHERE m.tenant_id = $1
              AND m.status = 'active'
              AND u.status = 'active'
              AND (m.workspace_ids IS NULL OR m.workspace_ids ? $2)
            ORDER BY u.display_name, u.email
        `, [scope.tenantId, scope.workspaceId])
        return rows.map((row: { id: string; display_name?: string; email?: string }) => ({
            id: row.id,
            displayName: row.display_name ?? row.email ?? 'VOTES account',
            email: row.email,
        }))
    })
}

export async function listFieldReports(scope: FieldReportScope): Promise<FieldReport[]> {
    if (!useDatabase()) {
        return [...reportStore.entries()]
            .filter(([key]) => key.startsWith(`${scope.tenantId}:${scope.workspaceId}:`))
            .map(([, report]) => report)
            .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    }

    return runTenantOperation(scope.tenantId, async client => {
        const { rows } = await client.query(`
            SELECT payload
            FROM field_reports
            WHERE tenant_id = $1 AND workspace_id = $2
            ORDER BY updated_at DESC, created_at DESC
            LIMIT 500
        `, [scope.tenantId, scope.workspaceId])
        return rows.map((row: { payload: FieldReport }) => row.payload)
    })
}

export async function getFieldReport(scope: FieldReportScope, id: string): Promise<FieldReport | undefined> {
    if (!useDatabase()) return reportStore.get(`${scope.tenantId}:${scope.workspaceId}:${id}`)

    return runTenantOperation(scope.tenantId, async client => {
        const { rows } = await client.query(`
            SELECT payload FROM field_reports
            WHERE tenant_id = $1 AND workspace_id = $2 AND id = $3
            LIMIT 1
        `, [scope.tenantId, scope.workspaceId, id])
        return rows[0]?.payload as FieldReport | undefined
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
        return rows[0].payload as FieldReport
    })
}

export async function updateFieldReport(
    scope: FieldReportScope,
    id: string,
    update: { status?: FieldReportStatus; assignedTo?: string },
): Promise<FieldReport | undefined> {
    const current = await getFieldReport(scope, id)
    if (!current) return undefined

    const report: FieldReport = {
        ...current,
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
        return rows[0]?.payload as FieldReport | undefined
    })
}

export const clearMemoryFieldReports = () => reportStore.clear()
