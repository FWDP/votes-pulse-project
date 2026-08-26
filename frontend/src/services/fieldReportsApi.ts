import type {
    FieldReport,
    FieldReportDetailResponse,
    FieldReportEvidenceRevisionInput,
    FieldReportListResponse,
    FieldReportIntegrity,
    FieldReportIntegrityAuditEntry,
    FieldReportIntegrityHealth,
    FieldReportRecipientListResponse,
    FieldReportStatus,
} from '../../../shared/fieldReports'
import type { MobileSession } from '../../../shared/mobileSessions'
import { getApiUrl } from '../utils/getApiUrl'

const requestJson = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers)
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
    }
    const response = await fetch(getApiUrl(path), {
        credentials: 'include',
        ...options,
        headers,
    })
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? `Field Reports API returned ${response.status}`)
    }
    return response.json() as Promise<T>
}

const withToken = (token: string) => ({ Authorization: `Bearer ${token}` })

export const createFieldReportsSession = (
    email: string,
    signal?: AbortSignal,
    prototypeProfile?: { id: string; displayName: string },
) =>
    requestJson<MobileSession>('/api/mobile/session', {
        method: 'POST',
        signal,
        body: JSON.stringify({
            email,
            password: import.meta.env.VITE_MOBILE_PROTOTYPE_PASSWORD ?? 'prototype',
            userId: prototypeProfile?.id,
            displayName: prototypeProfile?.displayName,
        }),
    })

export const synchronizeFieldReportRecipients = (
    token: string,
    accounts: Array<{ id: string; displayName: string; email: string; isSuperadmin?: boolean }>,
    signal?: AbortSignal,
) => requestJson<FieldReportRecipientListResponse>('/api/reports/recipients', {
    method: 'PUT',
    signal,
    headers: withToken(token),
    body: JSON.stringify({ accounts }),
})

export const listFieldReports = (token: string, signal?: AbortSignal) =>
    requestJson<FieldReportListResponse>('/api/reports', {
        signal,
        headers: withToken(token),
    })

export const createFieldReport = (report: FieldReport, token: string) =>
    requestJson<FieldReportDetailResponse>('/api/reports', {
        method: 'POST',
        headers: withToken(token),
        body: JSON.stringify(report),
    })

export const updateFieldReport = (
    id: string,
    update: { status?: FieldReportStatus; assignedTo?: string },
    token: string,
) => requestJson<FieldReportDetailResponse>(`/api/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: withToken(token),
    body: JSON.stringify(update),
})

export const reviseFieldReportEvidence = (
    id: string,
    update: FieldReportEvidenceRevisionInput,
    token: string,
) => requestJson<FieldReportDetailResponse>(`/api/reports/${encodeURIComponent(id)}/evidence`, {
    method: 'PUT',
    headers: withToken(token),
    body: JSON.stringify(update),
})

export const getFieldReportIntegrity = (id: string, token: string) =>
    requestJson<{ data: FieldReportIntegrity }>(`/api/reports/${encodeURIComponent(id)}/integrity`, {
        headers: withToken(token),
    })

export const retryFieldReportIntegrity = (id: string, token: string) =>
    requestJson<{ accepted: boolean }>(`/api/reports/${encodeURIComponent(id)}/integrity/retry`, {
        method: 'POST',
        headers: withToken(token),
    })

export const extendFieldReportIntegrityTtl = (id: string, token: string) =>
    requestJson<{ data: { transactionHash: string; ledgerSequence: number; extendedAt?: string } }>(
        `/api/reports/${encodeURIComponent(id)}/integrity/extend-ttl`,
        { method: 'POST', headers: withToken(token) },
    )

export const getFieldReportIntegrityHealth = (token: string, signal?: AbortSignal) =>
    requestJson<{ data: FieldReportIntegrityHealth }>('/api/reports/integrity/health', {
        headers: withToken(token),
        signal,
    })

export const getFieldReportIntegrityAudit = (token: string, signal?: AbortSignal) =>
    requestJson<{ data: FieldReportIntegrityAuditEntry[]; count: number }>('/api/reports/integrity/audit', {
        headers: withToken(token),
        signal,
    })
