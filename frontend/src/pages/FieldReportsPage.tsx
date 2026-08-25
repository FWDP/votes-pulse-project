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
import { getAssignedGeographySelection, getCoverageLabel, useAuth } from '../contexts/AuthContext'
import { isSameGeography } from '../utils/geography'
import {
  createFieldReportsSession,
  createFieldReport as createFieldReportRecord,
  listFieldReports as listFieldReportRecords,
  updateFieldReport as updateFieldReportRecord,
} from '../services/fieldReportsApi'
import type {
  FieldReport as SharedFieldReport,
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
}

const DATA_AS_OF = new Date('2026-03-31T12:00:00+08:00')

const INITIAL_REPORTS: FieldReport[] = [
  {
    id: 'FR-2026-031',
    title: 'Recurring flooding near the market access road',
    observation: 'Residents reported ankle-deep water after sustained rain, limiting access for vendors and public transport.',
    topic: 'Flooding & Disaster Risk', region: 'MIMAROPA Region', province: 'Oriental Mindoro',
    location: 'Pinamalayan', localityType: 'municipality', submittedAt: '2026-03-29',
    submittedBy: 'Municipal field coordinator', status: 'Follow-up', severity: 'High', evidenceType: 'Photo', evidenceCount: 4, assignedTo: 'Local response desk',
    attachments: [{ name: 'market-flooding-01.jpg', type: 'image/jpeg', size: 842000 }, { name: 'vendor-traffic-notes.pdf', type: 'application/pdf', size: 240000 }],
  },
  {
    id: 'FR-2026-030',
    title: 'Road surface deterioration along Palayan Road',
    observation: 'Photos and resident interviews indicate expanding potholes affecting motorcycles and farm deliveries.',
    topic: 'Infrastructure & Roads', region: 'MIMAROPA Region', province: 'Oriental Mindoro',
    location: 'Calapan City', localityType: 'city', submittedAt: '2026-03-27',
    submittedBy: 'City observation team', status: 'Pending review', severity: 'Medium', evidenceType: 'Photo', evidenceCount: 3, assignedTo: 'Engineering review',
    attachments: [{ name: 'road-surface-crack.jpg', type: 'image/jpeg', size: 480000 }],
  },
  {
    id: 'FR-2026-028',
    title: 'Health-center staffing gap raised by residents',
    observation: 'Interview participants cited irregular physician schedules and long travel times for follow-up care.',
    topic: 'Health Services', region: 'MIMAROPA Region', province: 'Oriental Mindoro',
    location: 'Naujan', localityType: 'municipality', submittedAt: '2026-03-20',
    submittedBy: 'Community liaison', status: 'Reviewed', severity: 'High', evidenceType: 'Interview', evidenceCount: 8, assignedTo: 'Health coordination',
    attachments: [{ name: 'clinic-operations-summary.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 174000 }],
  },
  {
    id: 'FR-2026-024',
    title: 'Tourism transport improvements positively received',
    observation: 'Operators and visitors described the upgraded pier flow as safer and easier to navigate during peak arrivals.',
    topic: 'Tourism Development', region: 'MIMAROPA Region', province: 'Oriental Mindoro',
    location: 'Puerto Galera', localityType: 'municipality', submittedAt: '2026-03-08',
    submittedBy: 'Tourism monitoring desk', status: 'Reviewed', severity: 'Low', evidenceType: 'Survey', evidenceCount: 5, assignedTo: 'Tourism desk',
    attachments: [],
  },
  {
    id: 'FR-2026-019',
    title: 'Farmers seek more predictable seedling support',
    observation: 'Participants welcomed the latest distribution while noting that quantities did not cover all registered growers.',
    topic: 'Agriculture & Livelihood', region: 'MIMAROPA Region', province: 'Oriental Mindoro',
    location: 'Baco', localityType: 'municipality', submittedAt: '2026-02-18',
    submittedBy: 'Agriculture field desk', status: 'Follow-up', severity: 'Medium', evidenceType: 'Interview', evidenceCount: 6, assignedTo: 'Agriculture desk',
    attachments: [{ name: 'seedling-feedback.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 96000 }],
  },
  {
    id: 'FR-2026-013',
    title: 'Coastal signal gaps affect emergency coordination',
    observation: 'Fishers identified shoreline areas where mobile coverage becomes unreliable during poor weather.',
    topic: 'Power & Utilities', region: 'MIMAROPA Region', province: 'Oriental Mindoro',
    location: 'Roxas', localityType: 'municipality', submittedAt: '2026-01-22',
    submittedBy: 'Coastal observation team', status: 'Pending review', severity: 'Critical', evidenceType: 'Other', evidenceCount: 2, assignedTo: 'Emergency coordination',
    attachments: [],
  },
  {
    id: 'FR-2025-087',
    title: 'Classroom repairs completed before enrollment',
    observation: 'Teachers confirmed that roof and ventilation repairs were completed, with two rooms still awaiting furniture.',
    topic: 'Education', region: 'MIMAROPA Region', province: 'Occidental Mindoro',
    location: 'Mamburao', localityType: 'municipality', submittedAt: '2025-11-19',
    submittedBy: 'Education monitoring desk', status: 'Reviewed', severity: 'Low', evidenceType: 'Survey', evidenceCount: 3, assignedTo: 'Education desk',
    attachments: [{ name: 'classroom-repair-photos.zip', type: 'application/zip', size: 198000 }],
  },
]

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
  })),
})

export default function FieldReportsPage() {
  const { user } = useAuth()
  const searchParams = new URLSearchParams(window.location.search)
  const workspace = (searchParams.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'
  const [geography, setGeography] = useState<GeographySelection>(getAssignedGeographySelection(user))
  const [resolvedGeography, setResolvedGeography] = useState<ResolvedGeographySelection>({})
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    if (!user?.homeLocation || user.isSuperadmin) return

    const assigned = getAssignedGeographySelection(user)
    setGeography(current => isSameGeography(current, assigned) ? current : assigned)
  }, [user])
  const [reports, setReports] = useState(INITIAL_REPORTS)
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
  const [apiToken, setApiToken] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    if (!user?.email) return () => controller.abort()

    let token = ''
    const loadReports = async () => {
      if (!token) return
      const response = await listFieldReportRecords(token, controller.signal)
      if (!controller.signal.aborted) {
        if (response.data.length) setReports(response.data.map(toDashboardReport))
      }
    }
    const connect = async () => {
      const session = await createFieldReportsSession(user.email, controller.signal)
      token = session.token
      setApiToken(token)
      await loadReports()
    }
    const refreshOnFocus = () => {
      void loadReports().catch(error => console.warn('Unable to refresh Field Reports:', error))
    }
    const interval = window.setInterval(refreshOnFocus, 15_000)
    window.addEventListener('focus', refreshOnFocus)

    void connect().catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        console.warn('Using local Field Reports fallback:', error)
      })
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [user?.email])

  const topics = useMemo(() => Array.from(new Set(reports.map(report => report.topic))).sort(), [reports])
  const evidenceTypes = useMemo(() => Array.from(new Set(reports.map(report => report.evidenceType))).sort(), [reports])
  const assignees = useMemo(() => Array.from(new Set(reports.map(report => report.assignedTo))).sort(), [reports])
  const coverageLabel = resolvedGeography.locality?.area_name ?? resolvedGeography.district?.area_name ??
    resolvedGeography.province?.area_name ?? resolvedGeography.region?.area_name ?? 'National coverage'

  const coverageReports = useMemo(() => {
    const latestReportTime = reports.reduce(
      (latest, report) => Math.max(latest, Date.parse(`${report.submittedAt}T12:00:00+08:00`)),
      DATA_AS_OF.getTime(),
    )
    const cutoff = new Date(latestReportTime)
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
  }, [geography, period, reports, resolvedGeography])

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

      const payload = await response.json() as { files?: Array<{ name: string; type: string; size: number; path?: string }> }
      const uploaded = (payload.files ?? []).map(file => ({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        path: file.path,
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

    const nextNumber = reports.length + 32
    const severity = String(data.get('severity') ?? 'Medium') as ReportSeverity
    const evidenceType = String(data.get('evidenceType') ?? 'Photo') as EvidenceType
    const evidenceCount = Number(data.get('evidenceCount') ?? 1) || 1
    const assignee = String(data.get('assignee') ?? 'Operations desk')
    const attachments = uploadedAttachments.map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
      path: file.path,
    }))

    const newReport: FieldReport = {
      id: `FR-2026-${String(nextNumber).padStart(3, '0')}`,
      title, observation, topic: reportTopic,
      region: resolvedGeography.region?.area_name ?? 'National coverage',
      regionCode: resolvedGeography.region?.code,
      province: resolvedGeography.province?.area_name ?? '',
      provinceCode: resolvedGeography.province?.code,
      district: resolvedGeography.district?.area_name,
      location,
      localityCode: resolvedGeography.locality?.code,
      localityType: resolvedGeography.locality?.geographic_level.toLowerCase() === 'city' ? 'city' : 'municipality',
      submittedAt: '2026-03-31', submittedBy: 'Dashboard user', status: 'Pending review', severity, evidenceType, evidenceCount, assignedTo: assignee, attachments,
    }
    const now = new Date().toISOString()
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
      assignedTo: assignee,
      attachments: attachments.map((attachment, index) => ({
        id: `web-attachment-${Date.now()}-${index}`,
        kind: attachment.type.startsWith('image/') ? 'image' : 'document',
        name: attachment.name,
        mimeType: attachment.type,
        size: attachment.size,
        remoteUrl: attachment.path,
        uploadStatus: attachment.path ? 'uploaded' : 'local',
      })),
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      sync: { state: 'queued', retryCount: 0 },
    }

    let savedReport = newReport
    let persisted = true
    try {
      if (!apiToken) throw new Error('The Field Reports session is not ready.')
      const response = await createFieldReportRecord(canonicalReport, apiToken)
      savedReport = toDashboardReport(response.data)
    } catch (error) {
      persisted = false
      console.warn('Field Report API unavailable; retaining local report:', error)
    }
    setReports(current => [savedReport, ...current])
    setNotice(persisted
      ? `${savedReport.id} was added to ${coverageLabel}${attachments.length ? ` with ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}` : ''}.`
      : 'The report was retained in this browser because the Field Reports API is unavailable.')
    setShowForm(false)
    setUploadedAttachments([])
    form.reset()
  }

  const updateStatus = (id: string, nextStatus: ReportStatus) => {
    setReports(current => current.map(report => report.id === id ? { ...report, status: nextStatus } : report))
    setNotice(`${id} is now marked ${nextStatus.toLowerCase()}.`)
    if (!apiToken) {
      setNotice(`${id} was updated locally, but the Field Reports session is unavailable.`)
      return
    }
    void updateFieldReportRecord(id, { status: apiStatusFromDashboard(nextStatus) }, apiToken).catch(error => {
      console.warn('Unable to persist Field Report status:', error)
      setNotice(`${id} was updated locally, but the server update could not be saved.`)
    })
  }

  const assignReport = (id: string, assignee: string) => {
    setReports(current => current.map(report => report.id === id ? { ...report, assignedTo: assignee } : report))
    setNotice(`${id} was assigned to ${assignee}.`)
    if (!apiToken) {
      setNotice(`${id} was assigned locally, but the Field Reports session is unavailable.`)
      return
    }
    void updateFieldReportRecord(id, { assignedTo: assignee }, apiToken).catch(error => {
      console.warn('Unable to persist Field Report assignment:', error)
      setNotice(`${id} was assigned locally, but the server update could not be saved.`)
    })
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
        <CoverageFilter geography={geography} onGeographyChange={setGeography} onResolvedGeographyChange={setResolvedGeography} period={period} onPeriodChange={setPeriod} />

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
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Observation</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedReport.observation}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">Evidence: {selectedReport.evidenceType}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{selectedReport.evidenceCount} item(s)</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">Submitted by {selectedReport.submittedBy}</span>
              {selectedReport.attachments.length > 0 && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">{selectedReport.attachments.length} attachment{selectedReport.attachments.length > 1 ? 's' : ''}</span>
              )}
            </div>

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
