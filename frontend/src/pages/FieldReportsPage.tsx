import { useMemo, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { CheckCircle2, ClipboardList, FilePlus2, FileText, Search } from 'lucide-react'

import PageShell from '../components/PageShell'
import CoverageFilter from '../components/dashboard/CoverageFilter'
import {
  ALL_CITIES_FILTER,
  ALL_MUNICIPALITIES_FILTER,
  type GeographySelection,
  type ResolvedGeographySelection,
} from '../types/geography'

type ReportStatus = 'Pending review' | 'Reviewed' | 'Follow-up'
type LocalityType = 'city' | 'municipality'

interface FieldReport {
  id: string
  title: string
  observation: string
  topic: string
  region: string
  province: string
  district?: string
  location: string
  localityType: LocalityType
  submittedAt: string
  submittedBy: string
  status: ReportStatus
}

const DATA_AS_OF = new Date('2026-03-31T12:00:00+08:00')

const INITIAL_REPORTS: FieldReport[] = [
  {
    id: 'FR-2026-031',
    title: 'Recurring flooding near the market access road',
    observation: 'Residents reported ankle-deep water after sustained rain, limiting access for vendors and public transport.',
    topic: 'Flooding & Disaster Risk', region: 'MIMAROPA Region', province: 'Oriental Mindoro',
    location: 'Pinamalayan', localityType: 'municipality', submittedAt: '2026-03-29',
    submittedBy: 'Municipal field coordinator', status: 'Follow-up',
  },
  {
    id: 'FR-2026-030',
    title: 'Road surface deterioration along Palayan Road',
    observation: 'Photos and resident interviews indicate expanding potholes affecting motorcycles and farm deliveries.',
    topic: 'Infrastructure & Roads', region: 'MIMAROPA Region', province: 'Oriental Mindoro',
    location: 'Calapan City', localityType: 'city', submittedAt: '2026-03-27',
    submittedBy: 'City observation team', status: 'Pending review',
  },
  {
    id: 'FR-2026-028',
    title: 'Health-center staffing gap raised by residents',
    observation: 'Interview participants cited irregular physician schedules and long travel times for follow-up care.',
    topic: 'Health Services', region: 'MIMAROPA Region', province: 'Oriental Mindoro',
    location: 'Naujan', localityType: 'municipality', submittedAt: '2026-03-20',
    submittedBy: 'Community liaison', status: 'Reviewed',
  },
  {
    id: 'FR-2026-024',
    title: 'Tourism transport improvements positively received',
    observation: 'Operators and visitors described the upgraded pier flow as safer and easier to navigate during peak arrivals.',
    topic: 'Tourism Development', region: 'MIMAROPA Region', province: 'Oriental Mindoro',
    location: 'Puerto Galera', localityType: 'municipality', submittedAt: '2026-03-08',
    submittedBy: 'Tourism monitoring desk', status: 'Reviewed',
  },
  {
    id: 'FR-2026-019',
    title: 'Farmers seek more predictable seedling support',
    observation: 'Participants welcomed the latest distribution while noting that quantities did not cover all registered growers.',
    topic: 'Agriculture & Livelihood', region: 'MIMAROPA Region', province: 'Oriental Mindoro',
    location: 'Baco', localityType: 'municipality', submittedAt: '2026-02-18',
    submittedBy: 'Agriculture field desk', status: 'Follow-up',
  },
  {
    id: 'FR-2026-013',
    title: 'Coastal signal gaps affect emergency coordination',
    observation: 'Fishers identified shoreline areas where mobile coverage becomes unreliable during poor weather.',
    topic: 'Power & Utilities', region: 'MIMAROPA Region', province: 'Oriental Mindoro',
    location: 'Roxas', localityType: 'municipality', submittedAt: '2026-01-22',
    submittedBy: 'Coastal observation team', status: 'Pending review',
  },
  {
    id: 'FR-2025-087',
    title: 'Classroom repairs completed before enrollment',
    observation: 'Teachers confirmed that roof and ventilation repairs were completed, with two rooms still awaiting furniture.',
    topic: 'Education', region: 'MIMAROPA Region', province: 'Occidental Mindoro',
    location: 'Mamburao', localityType: 'municipality', submittedAt: '2025-11-19',
    submittedBy: 'Education monitoring desk', status: 'Reviewed',
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

export default function FieldReportsPage() {
  const searchParams = new URLSearchParams(window.location.search)
  const workspace = (searchParams.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'
  const [geography, setGeography] = useState<GeographySelection>({ region: '', province: '', district: '', locality: '' })
  const [resolvedGeography, setResolvedGeography] = useState<ResolvedGeographySelection>({})
  const [period, setPeriod] = useState('30d')
  const [reports, setReports] = useState(INITIAL_REPORTS)
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('all')
  const [status, setStatus] = useState<'all' | ReportStatus>('all')
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState('')

  const topics = useMemo(() => Array.from(new Set(reports.map(report => report.topic))).sort(), [reports])
  const coverageLabel = resolvedGeography.locality?.area_name ?? resolvedGeography.district?.area_name ??
    resolvedGeography.province?.area_name ?? resolvedGeography.region?.area_name ?? 'National coverage'

  const coverageReports = useMemo(() => {
    const cutoff = new Date(DATA_AS_OF)
    cutoff.setDate(cutoff.getDate() - (periodDays[period] ?? 30))

    return reports.filter(report => {
      if (new Date(`${report.submittedAt}T23:59:59+08:00`) < cutoff) return false
      if (geography.region && (!resolvedGeography.region || !sameArea(report.region, resolvedGeography.region.area_name))) return false
      if (geography.province && (!resolvedGeography.province || !sameArea(report.province, resolvedGeography.province.area_name))) return false
      if (geography.district && (!resolvedGeography.district || !sameArea(report.district ?? '', resolvedGeography.district.area_name))) return false
      if (geography.locality === ALL_CITIES_FILTER && report.localityType !== 'city') return false
      if (geography.locality === ALL_MUNICIPALITIES_FILTER && report.localityType !== 'municipality') return false
      if (geography.locality && geography.locality !== ALL_CITIES_FILTER && geography.locality !== ALL_MUNICIPALITIES_FILTER) {
        if (!resolvedGeography.locality || !sameArea(report.location, resolvedGeography.locality.area_name)) return false
      }
      return true
    })
  }, [geography, period, reports, resolvedGeography])

  const visibleReports = useMemo(() => {
    const normalizedQuery = normalize(query)
    return coverageReports.filter(report => {
      if (topic !== 'all' && report.topic !== topic) return false
      if (status !== 'all' && report.status !== status) return false
      if (!normalizedQuery) return true
      return [report.id, report.title, report.observation, report.location, report.topic]
        .some(value => normalize(value).includes(normalizedQuery))
    })
  }, [coverageReports, query, status, topic])

  const submitReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const title = String(data.get('title') ?? '').trim()
    const observation = String(data.get('observation') ?? '').trim()
    const reportTopic = String(data.get('topic') ?? '').trim()
    const location = String(data.get('location') ?? '').trim()
    if (!title || !observation || !reportTopic || !location) return

    const nextNumber = reports.length + 32
    const newReport: FieldReport = {
      id: `FR-2026-${String(nextNumber).padStart(3, '0')}`,
      title, observation, topic: reportTopic,
      region: resolvedGeography.region?.area_name ?? 'National coverage',
      province: resolvedGeography.province?.area_name ?? '',
      district: resolvedGeography.district?.area_name,
      location,
      localityType: resolvedGeography.locality?.geographic_level.toLowerCase() === 'city' ? 'city' : 'municipality',
      submittedAt: '2026-03-31', submittedBy: 'Dashboard user', status: 'Pending review',
    }
    setReports(current => [newReport, ...current])
    setNotice(`${newReport.id} was added to ${coverageLabel}.`)
    setShowForm(false)
    form.reset()
  }

  const updateStatus = (id: string, nextStatus: ReportStatus) => {
    setReports(current => current.map(report => report.id === id ? { ...report, status: nextStatus } : report))
    setNotice(`${id} is now marked ${nextStatus.toLowerCase()}.`)
  }

  const pendingCount = coverageReports.filter(report => report.status === 'Pending review').length
  const followUpCount = coverageReports.filter(report => report.status === 'Follow-up').length
  const reviewedCount = coverageReports.filter(report => report.status === 'Reviewed').length

  return (
    <PageShell title="Field Reports" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : 'Structured field observations and review workflow'}>
      <div className="space-y-5">
        <CoverageFilter geography={geography} onGeographyChange={setGeography} onResolvedGeographyChange={setResolvedGeography} period={period} onPeriodChange={setPeriod} />

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
              <Field label="Submitted by" name="submittedBy" defaultValue="Dashboard user" disabled />
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

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ReportMetric label="Reports in coverage" value={coverageReports.length} />
          <ReportMetric label="Pending review" value={pendingCount} tone="text-red-600" />
          <ReportMetric label="Follow-up" value={followUpCount} tone="text-amber-600" />
          <ReportMetric label="Reviewed" value={reviewedCount} tone="text-green-600" />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="font-bold text-slate-800">Report register</h2><p className="mt-1 text-xs text-slate-500">Showing {visibleReports.length} of {coverageReports.length} reports · {coverageLabel}</p></div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="relative sm:min-w-56"><span className="sr-only">Search reports</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search reports" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                <select aria-label="Filter by topic" value={topic} onChange={event => setTopic(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="all">All topics</option>{topics.map(item => <option key={item}>{item}</option>)}</select>
                <select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value as 'all' | ReportStatus)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="all">All statuses</option><option>Pending review</option><option>Follow-up</option><option>Reviewed</option></select>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {visibleReports.map(report => (
              <article key={report.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-mono font-semibold text-slate-600">{report.id}</span><span aria-hidden="true">·</span><span>{new Date(`${report.submittedAt}T12:00:00`).toLocaleDateString('en-PH', { dateStyle: 'medium' })}</span><span aria-hidden="true">·</span><span>{report.location}</span></div>
                    <h3 className="mt-2 font-bold text-slate-800">{report.title}</h3>
                    <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">{report.observation}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{report.topic}</span><span className="text-slate-400">Submitted by {report.submittedBy}</span></div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <StatusBadge status={report.status} />
                    {report.status !== 'Reviewed' ? <button type="button" onClick={() => updateStatus(report.id, 'Reviewed')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-green-300 hover:text-green-700">Mark reviewed</button> : <button type="button" onClick={() => updateStatus(report.id, 'Follow-up')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-amber-300 hover:text-amber-700">Request follow-up</button>}
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
