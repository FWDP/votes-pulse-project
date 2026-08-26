import type {
    FieldReport,
    FieldReportDetailResponse,
    FieldReportListResponse,
    FieldReportRecipientListResponse,
    FieldReportStatus,
} from '../../../shared/fieldReports'
import type { MobileSession } from '../../../shared/mobileSessions'
import { getApiUrl } from '../utils/getApiUrl'

const requestJson = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(getApiUrl(path), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...options.headers,
        },
        ...options,
    })
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? `Field Reports API returned ${response.status}`)
    }
    return response.json() as Promise<T>
}

const withToken = (token: string) => ({ Authorization: `Bearer ${token}` })

export const createFieldReportsSession = (email: string, signal?: AbortSignal) =>
    requestJson<MobileSession>('/api/mobile/session', {
        method: 'POST',
        signal,
        body: JSON.stringify({
            email,
            password: import.meta.env.VITE_MOBILE_PROTOTYPE_PASSWORD ?? 'prototype',
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
