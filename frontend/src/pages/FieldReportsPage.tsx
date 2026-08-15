import React, { useState } from 'react'
import { FileText } from 'lucide-react'
import { GeographyControls, topics, regional } from './shared'
import PageShell from '../components/PageShell'

export default function FieldReportsPage() {
  const [reports, setReports] = useState(
    topics.slice(0, 5).map(([label], index) => ({ title: String(label), location: String(regional[index % regional.length][0]), status: index % 2 ? 'Reviewed' : 'Pending' }))
  )
  const [saved, setSaved] = useState(false)
  const submit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') || '').trim()
    const location = String(data.get('location') || '').trim()
    if (!title || !location) return
    setReports(current => [{ title, location, status: 'Pending' }, ...current])
    setSaved(true)
    event.currentTarget.reset()
  }

  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'

  return (
    <PageShell title="Field Reports" subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : 'National Pulse'}>
      <div className="space-y-4">
        <div className="flex justify-end">
          <select aria-label="Date range">
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>Election period</option>
          </select>
        </div>
        <GeographyControls />

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="field-banner">
            <FileText />
            <div>
              <h3>Field reports & survey instrument</h3>
              <p>Structured qualitative reports linked to location, date, topic and consent-safe aggregate observations.</p>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
