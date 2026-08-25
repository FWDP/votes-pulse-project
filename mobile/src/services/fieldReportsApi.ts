import { requestJson } from './apiClient'
import type {
    FieldReport,
    FieldReportDetailResponse,
    FieldReportListResponse,
} from '@/types/fieldReports'

export const listFieldReports = (token: string) =>
    requestJson<FieldReportListResponse>('/api/reports', { token })

export const submitFieldReport = (report: FieldReport, token: string) =>
    requestJson<FieldReportDetailResponse>('/api/reports', {
        method: 'POST',
        token,
        body: JSON.stringify(report),
    })
