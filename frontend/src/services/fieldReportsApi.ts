import type {
    FieldReport,
    FieldReportDetailResponse,
    FieldReportListResponse,
    FieldReportStatus,
} from '../../../shared/fieldReports'
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

export const listFieldReports = (signal?: AbortSignal) =>
    requestJson<FieldReportListResponse>('/api/reports', { signal })

export const createFieldReport = (report: FieldReport) =>
    requestJson<FieldReportDetailResponse>('/api/reports', {
        method: 'POST',
        body: JSON.stringify(report),
    })

export const updateFieldReport = (
    id: string,
    update: { status?: FieldReportStatus; assignedTo?: string },
) => requestJson<FieldReportDetailResponse>(`/api/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
})
