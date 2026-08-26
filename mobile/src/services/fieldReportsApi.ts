import { requestJson } from './apiClient'
import type {
    FieldReport,
    FieldReportAttachment,
    FieldReportDetailResponse,
    FieldReportListResponse,
    FieldReportRecipientListResponse,
} from '@/types/fieldReports'

export const listFieldReports = (token: string) =>
    requestJson<FieldReportListResponse>('/api/reports', { token })

export const listFieldReportRecipients = (token: string) =>
    requestJson<FieldReportRecipientListResponse>('/api/reports/recipients', { token })

export const submitFieldReport = (report: FieldReport, token: string) =>
    requestJson<FieldReportDetailResponse>('/api/reports', {
        method: 'POST',
        token,
        body: JSON.stringify(report),
    })

export async function uploadFieldReportAttachments(
    attachments: FieldReportAttachment[],
    token: string,
): Promise<FieldReportAttachment[]> {
    const pending = attachments.filter(attachment => attachment.localUri && !attachment.remoteUrl)
    if (!pending.length) return attachments

    const formData = new FormData()
    pending.forEach(attachment => {
        formData.append('attachments', {
            uri: attachment.localUri,
            name: attachment.name,
            type: attachment.mimeType,
        } as unknown as Blob)
    })

    const response = await requestJson<{ files: FieldReportAttachment[] }>('/api/reports/upload', {
        method: 'POST',
        token,
        body: formData,
    })
    let uploadedIndex = 0
    return attachments.map(attachment => {
        if (!attachment.localUri || attachment.remoteUrl) return attachment
        const uploaded = response.files[uploadedIndex++]
        return uploaded ? { ...uploaded, localUri: attachment.localUri } : attachment
    })
}

export const updateFieldReport = (
    id: string,
    update: Pick<FieldReport, 'status' | 'assignedTo'>,
    token: string,
) => requestJson<FieldReportDetailResponse>(`/api/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(update),
})
