import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes } from 'react'
import { getApiUrl } from '../utils/getApiUrl'
import { CheckCircle2, ClipboardList, FilePlus2, FileText, Search, X } from 'lucide-react'

import PageShell from '../components/PageShell'
import CoverageFilter from '../components/dashboard/CoverageFilter'
import AiInsightPanel from '../components/dashboard/AiInsightPanel'
import {
  ALL_CITIES_FILTER,
  ALL_MUNICIPALITIES_FILTER,
  type GeographySelection,
  type ResolvedGeographySelection,
} from '../types/geography'
import { getCoverageLabel, useAuth } from '../contexts/AuthContext'
import {
  createFieldReport as createFieldReportRecord,
  extendFieldReportIntegrityTtl,
  getFieldReportIntegrityAudit,
  getFieldReportIntegrityHealth,
  getFieldReportIntegrity,
  listFieldReports as listFieldReportRecords,
  listFieldReportTopics,
  retryFieldReportIntegrity,
  reviseFieldReportEvidence,
  updateFieldReport as updateFieldReportRecord,
} from '../services/fieldReportsApi'
import type {
  FieldReport as SharedFieldReport,
  FieldReportIntegrity,
  FieldReportIntegrityAuditEntry,
  FieldReportIntegrityHealth,
  FieldReportStatus,
} from '../../../shared/fieldReports'

type ReportStatus = 'Pending review' | 'Reviewed' | 'Follow-up'
type LocalityType = 'city' | 'municipality'
type ReportSeverity = 'Low' | 'Medium' | 'High' | 'Critical'
type EvidenceType = 'Photo' | 'Interview' | 'Survey' | 'Document' | 'Other'

interface AttachmentRecord {
  name: string
  type: string
  size: number
  path?: string
  sha256?: string
}

interface FieldReport {
  id: string
  title: string
  observation: string
  topic: string
  region: string
  regionCode?: string
  province: string
  provinceCode?: string
  district?: string
  location: string
  localityCode?: string
  localityType: LocalityType
  submittedAt: string
  submittedBy: string
  status: ReportStatus
  severity: ReportSeverity
  evidenceType: EvidenceType
  evidenceCount: number
  assignedTo: string
  attachments: AttachmentRecord[]
  integrity?: FieldReportIntegrity
}

const periodDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
const normalize = (value: string) => value.trim().toLocaleLowerCase()
const sameArea = (left: string, right?: string) => {
  if (!right) return true
  const normalizedLeft = normalize(left)
  const normalizedRight = normalize(right)
  return normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)
}

const dashboardStatusFromApi = (status: FieldReportStatus): ReportStatus => {
  if (status === 'verified' || status === 'rejected') return 'Reviewed'
  if (status === 'needs-follow-up') return 'Follow-up'
  return 'Pending review'
}

const apiStatusFromDashboard = (status: ReportStatus): FieldReportStatus => {
  if (status === 'Reviewed') return 'verified'
  if (status === 'Follow-up') return 'needs-follow-up'
  return 'under-review'
}

const toDashboardReport = (report: SharedFieldReport): FieldReport => ({
  id: report.id,
  title: report.title,
  observation: report.observation,
  topic: report.topic,
  region: report.location.regionName ?? '',
  regionCode: report.location.regionCode,
  province: report.location.provinceName ?? '',
  provinceCode: report.location.provinceCode,
  district: report.location.barangayName,
  location: report.location.localityName ?? report.location.label,
  localityCode: report.location.localityCode,
  localityType: report.location.localityType ?? 'municipality',
  submittedAt: (report.submittedAt ?? report.createdAt).slice(0, 10),
  submittedBy: report.reporter.displayName,
  status: dashboardStatusFromApi(report.status),
  severity: `${report.severity.slice(0, 1).toUpperCase()}${report.severity.slice(1)}` as ReportSeverity,
  evidenceType: `${report.evidenceType.slice(0, 1).toUpperCase()}${report.evidenceType.slice(1)}` as EvidenceType,
  evidenceCount: report.attachments.length,
  assignedTo: report.assignedTo || 'Operations desk',
  attachments: report.attachments.map(attachment => ({
    name: attachment.name,
    type: attachment.mimeType,
    size: attachment.size ?? 0,
    path: attachment.remoteUrl,
    sha256: attachment.sha256,
  })),
  integrity: report.integrity,
})

export default function FieldReportsPage() {
  const {
    user,
    fieldReportsSession,
    fieldReportsConnecting,
    fieldReportsConnectionError,
  } = useAuth()
  const searchParams = new URLSearchParams(window.location.search)
  const workspace = (searchParams.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'
  const [geography, setGeography] = useState<GeographySelection>({ region: '', province: '', district: '', locality: '' })
  const [resolvedGeography, setResolvedGeography] = useState<ResolvedGeographySelection>({})
  const [period, setPeriod] = useState('30d')
  const [reports, setReports] = useState<FieldReport[]>([])
  const [seededTopics, setSeededTopics] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('all')
  const [status, setStatus] = useState<'all' | ReportStatus>('all')
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState('')
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<'all' | ReportSeverity>('all')
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | EvidenceType>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [uploadedAttachments, setUploadedAttachments] = useState<AttachmentRecord[]>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [integrityHealth, setIntegrityHealth] = useState<FieldReportIntegrityHealth | null>(null)
  const [integrityAudit, setIntegrityAudit] = useState<FieldReportIntegrityAuditEntry[]>([])
  const [evidenceRevision, setEvidenceRevision] = useState<{
    title: string
    observation: string
    topic: string
    severity: ReportSeverity
    evidenceType: EvidenceType
  } | null>(null)
  const sessionMatchesUser = fieldReportsSession?.user?.email?.toLowerCase() === user?.email?.toLowerCase()
  const apiToken = sessionMatchesUser ? fieldReportsSession.token : ''

  useEffect(() => {
    const controller = new AbortController()
    if (!user?.email || !apiToken) {
      setReports([])
      if (fieldReportsConnectionError) {
        setNotice(`Unable to connect to the live Field Reports register: ${fieldReportsConnectionError}`)
      } else if (fieldReportsConnecting) {
        setNotice('Connecting this account to the live Field Reports register…')
      }
      return () => controller.abort()
    }

    const loadReports = async () => {
      const [response, topicResponse] = await Promise.all([
        listFieldReportRecords(apiToken, controller.signal),
        listFieldReportTopics(apiToken, controller.signal),
      ])
      if (!controller.signal.aborted) {
        setReports(response.data.map(toDashboardReport))
        setSeededTopics(topicResponse.data)
        setNotice(current => current.startsWith('Connecting this account') ? '' : current)
      }
    }
    const refreshOnFocus = () => {
      void loadReports().catch(error => console.warn('Unable to refresh Field Reports:', error))
    }
    const interval = window.setInterval(refreshOnFocus, 15_000)
    window.addEventListener('focus', refreshOnFocus)

    void loadReports().catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        console.warn('Unable to load live Field Reports:', error)
        const reason = error instanceof Error ? error.message : 'Unknown API error.'
        setNotice(`Unable to connect to the live Field Reports register: ${reason}`)
      })
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [apiToken, fieldReportsConnecting, fieldReportsConnectionError, user?.email])

  useEffect(() => {
    if (!apiToken || !user?.isSuperadmin) {
      setIntegrityHealth(null)
      setIntegrityAudit([])
      return
    }
    const controller = new AbortController()
    const loadOperations = async () => {
      const [health, audit] = await Promise.all([
        getFieldReportIntegrityHealth(apiToken, controller.signal),
        getFieldReportIntegrityAudit(apiToken, controller.signal),
      ])
      if (!controller.signal.aborted) {
        setIntegrityHealth(health.data)
        setIntegrityAudit(audit.data)
      }
    }
    void loadOperations().catch(error => {
      if (error instanceof Error && error.name === 'AbortError') return
      console.warn('Unable to load Stellar integrity operations:', error)
    })
    const interval = window.setInterval(() => void loadOperations(), 30_000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [apiToken, user?.isSuperadmin])

  const topics = useMemo(() => Array.from(new Set([
    ...seededTopics,
    ...reports.map(report => report.topic),
  ])), [reports, seededTopics])
  const evidenceTypes = useMemo(() => Array.from(new Set(reports.map(report => report.evidenceType))).sort(), [reports])
  const assignees = useMemo(() => Array.from(new Set(reports.map(report => report.assignedTo))).sort(), [reports])
  const recipientInbox = !user?.isSuperadmin
  const coverageLabel = recipientInbox
    ? `Reports sent to ${user?.displayName ?? 'this account'}`
    : resolvedGeography.locality?.area_name ?? resolvedGeography.district?.area_name ??
      resolvedGeography.province?.area_name ?? resolvedGeography.region?.area_name ?? 'National coverage'

  const coverageReports = useMemo(() => {
    // Recipient authorization is already enforced by the API. Do not hide an
    // addressed report merely because its observation occurred outside the
    // recipient account's administrative coverage.
    if (recipientInbox) return reports

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - (periodDays[period] ?? 30))

    return reports.filter(report => {
      if (new Date(`${report.submittedAt}T23:59:59+08:00`) < cutoff) return false
      if (geography.region && (
        report.regionCode
          ? report.regionCode !== geography.region
          : (!resolvedGeography.region || !sameArea(report.region, resolvedGeography.region.area_name))
      )) return false
      if (geography.province && (
        report.provinceCode
          ? report.provinceCode !== geography.province
          : (!resolvedGeography.province || !sameArea(report.province, resolvedGeography.province.area_name))
      )) return false
      if (geography.district && (!resolvedGeography.district || !sameArea(report.district ?? '', resolvedGeography.district.area_name))) return false
      if (geography.locality === ALL_CITIES_FILTER && report.localityType !== 'city') return false
      if (geography.locality === ALL_MUNICIPALITIES_FILTER && report.localityType !== 'municipality') return false
      if (geography.locality && geography.locality !== ALL_CITIES_FILTER && geography.locality !== ALL_MUNICIPALITIES_FILTER) {
        if (report.localityCode) {
          if (report.localityCode !== geography.locality) return false
        } else if (!resolvedGeography.locality || !sameArea(report.location, resolvedGeography.locality.area_name)) return false
      }
      return true
    })
  }, [geography, period, recipientInbox, reports, resolvedGeography])

  const visibleReports = useMemo(() => {
    const normalizedQuery = normalize(query)
    return coverageReports.filter(report => {
      if (topic !== 'all' && report.topic !== topic) return false
      if (status !== 'all' && report.status !== status) return false
      if (severityFilter !== 'all' && report.severity !== severityFilter) return false
      if (evidenceFilter !== 'all' && report.evidenceType !== evidenceFilter) return false
      if (assigneeFilter !== 'all' && report.assignedTo !== assigneeFilter) return false
      if (!normalizedQuery) return true
      return [report.id, report.title, report.observation, report.location, report.topic, report.assignedTo]
        .some(value => normalize(value).includes(normalizedQuery))
    })
  }, [assigneeFilter, coverageReports, evidenceFilter, query, severityFilter, status, topic])

  const handleAttachmentSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? [])
    if (nextFiles.length === 0) {
      setUploadedAttachments([])
      return
    }
    if (!apiToken) {
      setNotice('The Field Reports session is still connecting. Please try the upload again.')
      event.target.value = ''
      return
    }

    const formData = new FormData()
    nextFiles.forEach(file => formData.append('attachments', file))

    setUploadingAttachments(true)
    try {
      const response = await fetch(getApiUrl('/api/reports/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}` },
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Unable to upload attachments')
      }

      const payload = await response.json() as { files?: Array<{ name: string; type: string; size: number; path?: string; sha256?: string }> }
      const uploaded = (payload.files ?? []).map(file => ({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        path: file.path,
        sha256: file.sha256,
      }))

      setUploadedAttachments(current => [...current, ...uploaded])
      event.target.value = ''
    } catch (error) {
      console.error('Attachment upload failed', error)
      setNotice('Attachment upload failed. Please try again.')
    } finally {
      setUploadingAttachments(false)
    }
  }

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const title = String(data.get('title') ?? '').trim()
    const observation = String(data.get('observation') ?? '').trim()
    const reportTopic = String(data.get('topic') ?? '').trim()
    const location = String(data.get('location') ?? '').trim()
    if (!title || !observation || !reportTopic || !location) return

    const severity = String(data.get('severity') ?? 'Medium') as ReportSeverity
    const evidenceType = String(data.get('evidenceType') ?? 'Photo') as EvidenceType
    const evidenceCount = Number(data.get('evidenceCount') ?? 1) || 1
    const assignee = String(data.get('assignee') ?? 'Operations desk')
    const attachments = uploadedAttachments.map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
      path: file.path,
      sha256: file.sha256,
    }))

    const now = new Date().toISOString()
    const newReport: FieldReport = {
      id: `WEB-PENDING-${Date.now()}`,
      title, observation, topic: reportTopic,
      region: resolvedGeography.region?.area_name ?? 'National coverage',
      regionCode: resolvedGeography.region?.code,
      province: resolvedGeography.province?.area_name ?? '',
      provinceCode: resolvedGeography.province?.code,
      district: resolvedGeography.district?.area_name,
      location,
      localityCode: resolvedGeography.locality?.code,
      localityType: resolvedGeography.locality?.geographic_level.toLowerCase() === 'city' ? 'city' : 'municipality',
      submittedAt: now.slice(0, 10), submittedBy: user?.displayName ?? 'Dashboard user', status: 'Pending review', severity, evidenceType, evidenceCount, assignedTo: assignee, attachments,
    }
    const canonicalReport: SharedFieldReport = {
      id: newReport.id,
      clientId: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      observation,
      topic: reportTopic,
      severity: severity.toLowerCase() as SharedFieldReport['severity'],
      evidenceType: evidenceType.toLowerCase() as SharedFieldReport['evidenceType'],
      status: 'queued',
      location: {
        label: location,
        localityType: newReport.localityType,
        regionCode: resolvedGeography.region?.code,
        regionName: newReport.region,
        provinceCode: resolvedGeography.province?.code,
        provinceName: newReport.province,
        localityCode: resolvedGeography.locality?.code,
        localityName: location,
      },
      reporter: {
        id: user?.id ?? 'dashboard-user',
        displayName: user?.displayName ?? 'Dashboard user',
        email: user?.email,
      },
      recipient: !user?.isSuperadmin && fieldReportsSession?.user?.id && user?.displayName
        ? { id: fieldReportsSession.user.id, displayName: user.displayName, email: user.email }
        : undefined,
      assignedTo: assignee,
      attachments: attachments.map((attachment, index) => ({
        id: `web-attachment-${Date.now()}-${index}`,
        kind: attachment.type.startsWith('image/') ? 'image' : 'document',
        name: attachment.name,
        mimeType: attachment.type,
        size: attachment.size,
        remoteUrl: attachment.path,
        sha256: attachment.sha256,
        uploadStatus: attachment.path ? 'uploaded' : 'local',
      })),
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      sync: { state: 'queued', retryCount: 0 },
    }

    try {
      if (!apiToken) throw new Error('The Field Reports session is not ready.')
      const response = await createFieldReportRecord(canonicalReport, apiToken)
      const savedReport = toDashboardReport(response.data)
      setReports(current => [savedReport, ...current])
      setNotice(`${savedReport.id} was added to ${coverageLabel}${attachments.length ? ` with ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}` : ''}.`)
      setShowForm(false)
      setUploadedAttachments([])
      form.reset()
    } catch (error) {
      console.warn('Unable to persist Field Report:', error)
      const reason = error instanceof Error ? error.message : 'The live Field Reports API is unavailable.'
      setNotice(`The report was not saved: ${reason} Your form remains open so you can retry.`)
    }
  }

  const updateStatus = async (id: string, nextStatus: ReportStatus) => {
    if (!apiToken) {
      setNotice(`${id} was not updated because the live Field Reports session is unavailable.`)
      return
    }
    try {
      const response = await updateFieldReportRecord(id, { status: apiStatusFromDashboard(nextStatus) }, apiToken)
      const savedReport = toDashboardReport(response.data)
      setReports(current => current.map(report => report.id === id ? savedReport : report))
      setNotice(`${id} is now marked ${nextStatus.toLowerCase()}.`)
    } catch (error) {
      console.warn('Unable to persist Field Report status:', error)
      setNotice(`${id} was not updated because the live API could not save the change.`)
    }
  }

  const assignReport = async (id: string, assignee: string) => {
    if (!apiToken) {
      setNotice(`${id} was not reassigned because the live Field Reports session is unavailable.`)
      return
    }
    try {
      const response = await updateFieldReportRecord(id, { assignedTo: assignee }, apiToken)
      const savedReport = toDashboardReport(response.data)
      setReports(current => current.map(report => report.id === id ? savedReport : report))
      setNotice(`${id} was assigned to ${assignee}.`)
    } catch (error) {
      console.warn('Unable to persist Field Report assignment:', error)
      setNotice(`${id} was not reassigned because the live API could not save the change.`)
    }
  }

  const saveEvidenceRevision = async (id: string) => {
    if (!apiToken || !evidenceRevision) return
    try {
      const response = await reviseFieldReportEvidence(id, {
        title: evidenceRevision.title,
        observation: evidenceRevision.observation,
        topic: evidenceRevision.topic,
        severity: evidenceRevision.severity.toLowerCase() as SharedFieldReport['severity'],
        evidenceType: evidenceRevision.evidenceType.toLowerCase() as SharedFieldReport['evidenceType'],
      }, apiToken)
      const integrityResponse = await getFieldReportIntegrity(id, apiToken)
      const savedReport = toDashboardReport({ ...response.data, integrity: integrityResponse.data })
      setReports(current => current.map(report => report.id === id ? savedReport : report))
      setEvidenceRevision(null)
      setNotice(`${id} evidence revision ${savedReport.integrity?.revision ?? ''} was queued for Stellar verification.`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unable to save evidence revision.'
      setNotice(`${id} evidence was not revised: ${reason}`)
    }
  }

  const pendingCount = coverageReports.filter(report => report.status === 'Pending review').length
  const followUpCount = coverageReports.filter(report => report.status === 'Follow-up').length
  const reviewedCount = coverageReports.filter(report => report.status === 'Reviewed').length

  const generateSummary = () => {
    const topicMap = new Map<string, number>()
    coverageReports.forEach(report => {
      topicMap.set(report.topic, (topicMap.get(report.topic) ?? 0) + 1)
    })

    const topTopic = [...topicMap.entries()].sort((a, b) => b[1] - a[1])[0]
    const criticalCount = coverageReports.filter(report => report.severity === 'Critical').length
    const highPriorityCount = coverageReports.filter(report => ['High', 'Critical'].includes(report.severity)).length

    const nextSummary = [
      `${coverageReports.length} total reports in ${coverageLabel}.`,
      `${pendingCount} pending review, ${followUpCount} for follow-up, and ${reviewedCount} already reviewed.`,
      topTopic ? `Top reported issue: ${topTopic[0]} (${topTopic[1]} reports).` : 'No topic trends detected yet.',
      `${highPriorityCount} reports are high-priority or critical, with ${criticalCount} critical cases flagged.`,
    ].join(' ')

    setSummaryText(nextSummary)
    setNotice('Coverage summary generated for this report set.')
  }

  const exportReports = () => {
    const rows = [
      ['id', 'title', 'topic', 'location', 'status', 'severity', 'evidenceType', 'evidenceCount', 'assignedTo', 'submittedAt', 'submittedBy'],
      ...visibleReports.map(report => [
        report.id,
        report.title,
        report.topic,
        report.location,
        report.status,
        report.severity,
        report.evidenceType,
        String(report.evidenceCount),
        report.assignedTo,
        report.submittedAt,
        report.submittedBy,
      ]),
    ]

    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `field-reports-${coverageLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'coverage'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice(`Exported ${visibleReports.length} report${visibleReports.length === 1 ? '' : 's'} to CSV.`)
  }

  const selectedReport = useMemo(
    () => coverageReports.find(report => report.id === selectedReportId) ?? null,
    [coverageReports, selectedReportId],
  )

  useEffect(() => setEvidenceRevision(null), [selectedReportId])

  useEffect(() => {
    if (!selectedReportId || !apiToken) return
    void getFieldReportIntegrity(selectedReportId, apiToken)
      .then(response => {
        setReports(current => current.map(report =>
          report.id === selectedReportId ? { ...report, integrity: response.data } : report,
        ))
      })
      .catch(error => console.warn('Unable to load integrity history:', error))
  }, [apiToken, selectedReportId])

  const retryIntegrity = async (id: string) => {
    if (!apiToken) return
    try {
      await retryFieldReportIntegrity(id, apiToken)
      setReports(current => current.map(report => report.id === id && report.integrity
        ? { ...report, integrity: { ...report.integrity, status: 'pending', lastError: undefined } }
        : report))
      setNotice(`${id} was requeued for Stellar anchoring.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to retry Stellar anchoring.')
    }
  }

  const extendIntegrityTtl = async (id: string) => {
    if (!apiToken) return
    try {
      await extendFieldReportIntegrityTtl(id, apiToken)
      setNotice(`${id} integrity TTL was extended on Stellar.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to extend Stellar TTL.')
    }
  }

  const aiReportContext = useMemo(() => {
    const topicCounts = new Map<string, number>()

    coverageReports.forEach(report => {
      topicCounts.set(report.topic, (topicCounts.get(report.topic) ?? 0) + 1)
    })

    const topTopic = [...topicCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    const priorityTopic = topTopic?.[0] ?? 'Local service delivery'
    const urgency = pendingCount + followUpCount

    return {
      coverageLabel: coverageLabel || 'Selected coverage',
      periodLabel: period,
      sentiment: {
        positive: Math.max(18, 38 - Math.min(12, urgency)),
        neutral: Math.max(24, 41 - Math.min(10, pendingCount)),
        negative: Math.max(20, 30 + Math.min(18, followUpCount)),
      },
      topics: [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, mentions]) => ({
        name,
        mentions,
        positive: 22,
        neutral: 34,
        negative: 44,
      })),
      insights: [{
        title: 'Review queue',
        description: `${pendingCount} reports are pending review and ${followUpCount} need follow-up actions in this coverage window.`,
      }],
    }
  }, [coverageLabel, coverageReports, followUpCount, pendingCount, period])

  const reportPrompts = [
    'Which reports need urgent attention in this coverage?',
    'Summarize the main issues reported for this area in plain language.',
    'What is the most common topic appearing across the reports?',
    'Give me a short leadership briefing on the current review queue.',
  ]

  return (
    <PageShell title="Field Reports" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : getCoverageLabel(user)}>
      <div className="space-y-5">
        {user?.isSuperadmin ? (
          <CoverageFilter geography={geography} onGeographyChange={setGeography} onResolvedGeographyChange={setResolvedGeography} period={period} onPeriodChange={setPeriod} />
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recipient inbox</p>
            <p className="mt-1 text-sm text-slate-700">Showing every Field Report sent to {user?.displayName ?? 'this account'}, regardless of where the observation was recorded.</p>
          </section>
        )}

        <AiInsightPanel
          title="Field Reports AI Brief"
          prompts={reportPrompts}
          context={aiReportContext}
        />

        <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-white p-2 text-slate-700 shadow-sm"><FileText size={20} aria-hidden="true" /></span>
              <div>
                <h2 className="font-bold text-slate-800">Field reports & survey instrument</h2>
                <p className="mt-1 text-sm text-slate-600">Qualitative observations linked to coverage, date, topic, and a review status.</p>
              </div>
            </div>
            <button type="button" onClick={() => setShowForm(current => !current)} aria-expanded={showForm} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
              <FilePlus2 size={17} aria-hidden="true" />{showForm ? 'Cancel entry' : 'New field report'}
            </button>
          </div>
        </section>

        {showForm && (
          <form onSubmit={submitReport} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5"><h2 className="font-bold text-slate-800">Add field report</h2><p className="mt-1 text-xs text-slate-500">The report will be attached to {coverageLabel} and submitted for review.</p></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Report title" name="title" placeholder="Summarize the observation" required />
              <Field label="City / Municipality" name="location" defaultValue={resolvedGeography.locality?.area_name ?? ''} placeholder="Enter the observed location" required />
              <label className="text-xs font-semibold text-slate-600">Topic
                <select name="topic" required defaultValue="" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                  <option value="" disabled>Select a topic</option>{topics.map(item => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">Severity
                <select name="severity" defaultValue="Medium" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                  <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">Evidence type
                <select name="evidenceType" defaultValue="Photo" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                  <option>Photo</option><option>Interview</option><option>Survey</option><option>Other</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">Evidence count
                <input name="evidenceCount" type="number" min={1} defaultValue={1} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              <label className="text-xs font-semibold text-slate-600">Assigned to
                <select name="assignee" defaultValue="Operations desk" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                  {['Operations desk', 'Local response desk', 'Engineering review', 'Health coordination', 'Emergency coordination', 'Agriculture desk'].map(item => <option key={item}>{item}</option>)}
                </select>
              </label>
              <Field label="Submitted by" name="submittedBy" defaultValue="Dashboard user" disabled />
              <label className="md:col-span-2 text-xs font-semibold text-slate-600">Attachments
                <input
                  type="file"
                  name="attachments"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                  onChange={handleAttachmentSelection}
                  className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {uploadingAttachments && (
                  <div className="mt-2 text-xs font-medium text-blue-700">Uploading attachments...</div>
                )}
                {uploadedAttachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                    {uploadedAttachments.map(attachment => (
                      <span key={`${attachment.name}-${attachment.size}`} className="rounded-full bg-slate-100 px-2.5 py-1">
                        {attachment.name}
                      </span>
                    ))}
                  </div>
                )}
              </label>
            </div>
            <label className="mt-4 block text-xs font-semibold text-slate-600">Observation
              <textarea name="observation" required rows={4} placeholder="Record the evidence, context, and consent-safe aggregate observation" className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </label>
            <div className="mt-4 flex justify-end"><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Submit for review</button></div>
          </form>
        )}

        {notice && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 size={17} aria-hidden="true" /><span>{notice}</span>
            <button type="button" onClick={() => setNotice('')} className="ml-auto font-semibold text-green-900">Dismiss</button>
          </div>
        )}

        {user?.isSuperadmin && integrityHealth && (
          <section className={`rounded-xl border p-4 shadow-sm ${integrityHealth.healthy ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-700">Stellar operations</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {integrityHealth.healthy ? 'Integrity pipeline healthy' : 'Integrity pipeline needs attention'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                <span className="rounded-full bg-white px-2.5 py-1">Pending {integrityHealth.pending}</span>
                <span className="rounded-full bg-white px-2.5 py-1">Failed {integrityHealth.failed}</span>
                <span className="rounded-full bg-white px-2.5 py-1">TTL due {integrityHealth.ttlDue}</span>
                <span className="rounded-full bg-white px-2.5 py-1">Incidents {integrityHealth.openIncidents ?? 0}</span>
                <span className="rounded-full bg-white px-2.5 py-1">Reconcile failures {integrityHealth.reconciliationFailures ?? 0}</span>
                <span className="rounded-full bg-white px-2.5 py-1">Alert failures {integrityHealth.alertDeliveryFailures ?? 0}</span>
                <span className="rounded-full bg-white px-2.5 py-1 capitalize">Signer {integrityHealth.signerMode}</span>
              </div>
            </div>
            {integrityHealth.alerts.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-900">
                {integrityHealth.alerts.map(alert => <li key={alert}>{alert}</li>)}
              </ul>
            )}
          </section>
        )}

        {summaryText && (
          <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-700">Report summary</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{summaryText}</p>
              </div>
              <button type="button" onClick={() => setSummaryText('')} className="text-xs font-semibold text-sky-700 hover:text-sky-900">Clear</button>
            </div>
          </section>
        )}

        {selectedReport && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Report detail</p>
                <h2 className="mt-1 text-xl font-bold text-slate-800">{selectedReport.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportId(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                aria-label="Close report detail"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-600">{selectedReport.id}</span>
              <span aria-hidden="true">·</span>
              <span>{new Date(`${selectedReport.submittedAt}T12:00:00`).toLocaleDateString('en-PH', { dateStyle: 'medium' })}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedReport.location}</span>
              <IntegrityBadge integrity={selectedReport.integrity} />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Topic</div>
                <div className="mt-2 text-sm font-semibold text-slate-700">{selectedReport.topic}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Status</div>
                <div className="mt-2"><StatusBadge status={selectedReport.status} /></div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Severity</div>
                <div className="mt-2"><SeverityBadge severity={selectedReport.severity} /></div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Assigned to</div>
                <div className="mt-2 text-sm font-semibold text-slate-700">{selectedReport.assignedTo}</div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Observation</div>
                {!evidenceRevision && (user?.isSuperadmin || selectedReport.submittedBy === user?.displayName) && (
                  <button
                    type="button"
                    onClick={() => setEvidenceRevision({
                      title: selectedReport.title,
                      observation: selectedReport.observation,
                      topic: selectedReport.topic,
                      severity: selectedReport.severity,
                      evidenceType: selectedReport.evidenceType,
                    })}
                    className="text-xs font-semibold text-violet-700 hover:text-violet-900"
                  >Create evidence revision</button>
                )}
              </div>
              {evidenceRevision ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input value={evidenceRevision.title} onChange={event => setEvidenceRevision(current => current ? { ...current, title: event.target.value } : current)} aria-label="Revised report title" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                  <input value={evidenceRevision.topic} onChange={event => setEvidenceRevision(current => current ? { ...current, topic: event.target.value } : current)} aria-label="Revised report topic" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                  <select value={evidenceRevision.severity} onChange={event => setEvidenceRevision(current => current ? { ...current, severity: event.target.value as ReportSeverity } : current)} aria-label="Revised severity" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
                  <select value={evidenceRevision.evidenceType} onChange={event => setEvidenceRevision(current => current ? { ...current, evidenceType: event.target.value as EvidenceType } : current)} aria-label="Revised evidence type" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option>Photo</option><option>Interview</option><option>Survey</option><option>Document</option><option>Other</option></select>
                  <textarea value={evidenceRevision.observation} onChange={event => setEvidenceRevision(current => current ? { ...current, observation: event.target.value } : current)} aria-label="Revised observation" rows={4} className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
                  <div className="flex justify-end gap-2 md:col-span-2">
                    <button type="button" onClick={() => setEvidenceRevision(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button>
                    <button type="button" onClick={() => void saveEvidenceRevision(selectedReport.id)} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white">Save & anchor revision</button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedReport.observation}</p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">Evidence: {selectedReport.evidenceType}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{selectedReport.evidenceCount} item(s)</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">Submitted by {selectedReport.submittedBy}</span>
              {selectedReport.attachments.length > 0 && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">{selectedReport.attachments.length} attachment{selectedReport.attachments.length > 1 ? 's' : ''}</span>
              )}
            </div>

            {selectedReport.integrity?.history?.length ? (
              <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-700">Stellar integrity chain</div>
                  <span className={`text-xs font-bold ${selectedReport.integrity.chainValid === true ? 'text-green-700' : selectedReport.integrity.chainValid === false ? 'text-red-700' : 'text-amber-700'}`}>
                    {selectedReport.integrity.chainValid === true ? 'Chain valid' : selectedReport.integrity.chainValid === false ? 'Chain mismatch' : 'Confirmation pending'}
                  </span>
                </div>
                <ol className="mt-3 space-y-2">
                  {selectedReport.integrity.history.map(revision => (
                    <li key={revision.revision} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs">
                      <span className="font-semibold text-slate-700">Revision {revision.revision} · {revision.anchorType === 'review-attestation' ? 'Review attestation' : 'Report evidence'}</span>
                      <span className="font-mono text-slate-500">{revision.contentHash?.slice(0, 12)}…</span>
                      <span className="capitalize text-slate-500">{revision.status}</span>
                    </li>
                  ))}
                </ol>
                {selectedReport.integrity.status === 'confirmed' && selectedReport.integrity.reportKey && (
                  <a
                    href={`/verify/${selectedReport.integrity.reportKey}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-800"
                  >Open privacy-safe verification receipt</a>
                )}
                {user?.isSuperadmin && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedReport.integrity.status === 'failed' && (
                      <button type="button" onClick={() => void retryIntegrity(selectedReport.id)} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white">Retry anchor</button>
                    )}
                    {selectedReport.integrity.status === 'confirmed' && (
                      <button type="button" onClick={() => void extendIntegrityTtl(selectedReport.id)} className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-800">Extend TTL</button>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {selectedReport.attachments.length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Attachments</div>
                <ul className="mt-3 space-y-2">
                  {selectedReport.attachments.map(attachment => (
                    <li key={`${selectedReport.id}-${attachment.name}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <div className="min-w-0">
                        <span className="block truncate font-medium">{attachment.name}</span>
                        {attachment.path ? (
                          <a href={getApiUrl(attachment.path)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] font-semibold text-blue-700 underline-offset-2 hover:underline">Open attachment</a>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
                        {attachment.type.length > 0 ? attachment.type.split('/').pop() || attachment.type : 'file'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateStatus(selectedReport.id, 'Reviewed')}
                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
              >
                Mark reviewed
              </button>
              <button
                type="button"
                onClick={() => updateStatus(selectedReport.id, 'Follow-up')}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:border-amber-300 hover:bg-amber-100"
              >
                Request follow-up
              </button>
              <select
                aria-label="Assign report"
                defaultValue={selectedReport.assignedTo}
                onChange={event => assignReport(selectedReport.id, event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
              >
                {assignees.map(item => <option key={item}>{item}</option>)}
              </select>
            </div>
          </section>
        )}

        {user?.isSuperadmin && (
          <section className="rounded-xl border border-violet-200 bg-white shadow-sm">
            <div className="border-b border-violet-100 p-4 sm:p-5">
              <h2 className="font-bold text-slate-800">Stellar-verified field report audit trail</h2>
              <p className="mt-1 text-xs text-slate-500">Confirmed submissions, evidence revisions, and review attestations across this workspace.</p>
            </div>
            <div className="max-h-96 overflow-auto">
              {integrityAudit.length ? (
                <table className="w-full min-w-[780px] text-left text-xs">
                  <thead className="sticky top-0 bg-violet-50 text-violet-800"><tr><th className="px-4 py-3">Report</th><th className="px-4 py-3">Revision</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Ledger</th><th className="px-4 py-3">Confirmed</th><th className="px-4 py-3">Transaction</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {integrityAudit.map(entry => (
                      <tr key={`${entry.transactionHash}-${entry.revision}`}>
                        <td className="px-4 py-3"><button type="button" onClick={() => setSelectedReportId(entry.reportId)} className="font-semibold text-slate-800 hover:text-violet-700">{entry.reportTitle}</button><div className="mt-1 font-mono text-[10px] text-slate-400">{entry.reportId}</div></td>
                        <td className="px-4 py-3 font-semibold">{entry.revision}</td>
                        <td className="px-4 py-3">{entry.anchorType === 'review-attestation' ? 'Review' : 'Evidence'}</td>
                        <td className="px-4 py-3 font-mono">{entry.ledgerSequence}</td>
                        <td className="px-4 py-3">{new Date(entry.confirmedAt).toLocaleString('en-PH')}</td>
                        <td className="px-4 py-3"><a href={`https://stellar.expert/explorer/${integrityHealth?.network === 'public' ? 'public' : 'testnet'}/tx/${entry.transactionHash}`} target="_blank" rel="noreferrer" className="font-mono text-violet-700 hover:underline">{entry.transactionHash.slice(0, 12)}…</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="p-5 text-sm text-slate-500">No confirmed Stellar anchors yet.</p>}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ReportMetric label="Reports in coverage" value={coverageReports.length} />
          <ReportMetric label="Pending review" value={pendingCount} tone="text-red-600" />
          <ReportMetric label="Follow-up" value={followUpCount} tone="text-amber-600" />
          <ReportMetric label="Reviewed" value={reviewedCount} tone="text-green-600" />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={generateSummary} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 hover:border-sky-300 hover:bg-sky-100">Generate summary</button>
          <button type="button" onClick={exportReports} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50">Export CSV</button>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="font-bold text-slate-800">Report register</h2><p className="mt-1 text-xs text-slate-500">Showing {visibleReports.length} of {coverageReports.length} reports · {coverageLabel}</p></div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <label className="relative sm:min-w-56"><span className="sr-only">Search reports</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search reports" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                <select aria-label="Filter by topic" value={topic} onChange={event => setTopic(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="all">All topics</option>{topics.map(item => <option key={item}>{item}</option>)}</select>
                <select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value as 'all' | ReportStatus)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="all">All statuses</option><option>Pending review</option><option>Follow-up</option><option>Reviewed</option></select>
                <select aria-label="Filter by severity" value={severityFilter} onChange={event => setSeverityFilter(event.target.value as 'all' | ReportSeverity)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="all">All severities</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
                <select aria-label="Filter by evidence type" value={evidenceFilter} onChange={event => setEvidenceFilter(event.target.value as 'all' | EvidenceType)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="all">All evidence</option>{evidenceTypes.map(item => <option key={item}>{item}</option>)}</select>
                <select aria-label="Filter by assignee" value={assigneeFilter} onChange={event => setAssigneeFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="all">All assignees</option>{assignees.map(item => <option key={item}>{item}</option>)}</select>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {visibleReports.map(report => (
              <article
                key={report.id}
                className="cursor-pointer p-4 transition hover:bg-slate-50 sm:p-5"
                onClick={() => setSelectedReportId(report.id)}
                aria-label={`Open details for ${report.title}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-mono font-semibold text-slate-600">{report.id}</span><span aria-hidden="true">·</span><span>{new Date(`${report.submittedAt}T12:00:00`).toLocaleDateString('en-PH', { dateStyle: 'medium' })}</span><span aria-hidden="true">·</span><span>{report.location}</span></div>
                    <h3 className="mt-2 font-bold text-slate-800">{report.title}</h3>
                    <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">{report.observation}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{report.topic}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{report.evidenceType}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{report.evidenceCount} evidence</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">Assigned: {report.assignedTo}</span>
                      <span className="text-slate-400">Submitted by {report.submittedBy}</span>
                      <IntegrityBadge integrity={report.integrity} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <StatusBadge status={report.status} />
                    <button type="button" onClick={event => { event.stopPropagation(); updateStatus(report.id, report.status === 'Reviewed' ? 'Follow-up' : 'Reviewed') }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-green-300 hover:text-green-700">{report.status === 'Reviewed' ? 'Request follow-up' : 'Mark reviewed'}</button>
                  </div>
                </div>
              </article>
            ))}
            {visibleReports.length === 0 && <div className="p-10 text-center"><ClipboardList size={28} className="mx-auto text-slate-300" aria-hidden="true" /><h3 className="mt-3 font-semibold text-slate-700">No reports found</h3><p className="mt-1 text-sm text-slate-500">Try a broader geography, date range, or report filter.</p></div>}
          </div>
        </section>
      </div>
    </PageShell>
  )
}

function Field({ label, name, ...props }: { label: string; name: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="text-xs font-semibold text-slate-600">{label}<input name={name} {...props} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-700 outline-none disabled:bg-slate-50 disabled:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
}

function ReportMetric({ label, value, tone = 'text-slate-800' }: { label: string; value: number; tone?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><strong className={`text-2xl font-black tabular-nums ${tone}`}>{value}</strong><p className="mt-1 text-xs font-semibold text-slate-500">{label}</p></div>
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const classes = status === 'Reviewed' ? 'bg-green-100 text-green-700' : status === 'Follow-up' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${classes}`}>{status}</span>
}

function IntegrityBadge({ integrity }: { integrity?: FieldReportIntegrity }) {
  if (!integrity) return null
  const confirmed = integrity.status === 'confirmed'
  const failed = integrity.status === 'failed'
  const label = confirmed ? 'Verified on Stellar' : failed ? 'Stellar anchor failed' : 'Stellar anchor pending'
  const classes = confirmed
    ? 'bg-violet-100 text-violet-800'
    : failed
      ? 'bg-red-100 text-red-700'
      : 'bg-blue-100 text-blue-700'
  const badge = <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${classes}`}>{label}</span>
  if (!confirmed || !integrity.transactionHash) return badge
  const network = integrity.network === 'public' ? 'public' : 'testnet'
  return (
    <a
      href={`https://stellar.expert/explorer/${network}/tx/${integrity.transactionHash}`}
      target="_blank"
      rel="noreferrer"
      onClick={event => event.stopPropagation()}
      title={`Ledger ${integrity.ledgerSequence ?? 'confirmed'}`}
    >
      {badge}
    </a>
  )
}

function SeverityBadge({ severity }: { severity: ReportSeverity }) {
  const classes = severity === 'Critical'
    ? 'bg-rose-100 text-rose-700'
    : severity === 'High'
      ? 'bg-orange-100 text-orange-700'
      : severity === 'Medium'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-emerald-100 text-emerald-700'

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${classes}`}>{severity}</span>
}
