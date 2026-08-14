import React, { useState } from 'react'
import { FileText } from 'lucide-react'
import { GeographyControls, topics, regional } from './shared'
import PageShell from '../components/PageShell'

export default function FieldReportsPage() {
  const [reports, setReports] = useState(
    topics.slice(0, 5).map(([label], index) => ({ title: String(label), location: String(regional[index % regional.length][0]), status: index % 2 ? 'Reviewed' : 'Pending' }))
  )
  const [saved, setSaved] = useState(false)
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
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

          <div className="demo-kpis">
            {[
              [String(reports.length), 'Field reports'],
              ['2', 'Regions'],
              ['1', 'Active survey'],
              [String(reports.filter(report => report.status === 'Pending').length), 'Pending review'],
            ].map(([v, l]) => (
              <article key={String(l)}>
                <strong>{v}</strong>
                <span>{l}</span>
              </article>
            ))}
          </div>

          <div className="demo-two-col mt-4">
            <section>
              <h3>Submit field report</h3>
              <form onSubmit={submit}>
                <label className="field-input">
                  <span>Report title</span>
                  <input name="title" required placeholder="Enter report title" />
                </label>
                <label className="field-input">
                  <span>Location</span>
                  <input name="location" required placeholder="Enter location" />
                </label>
                <label className="field-input">
                  <span>Category</span>
                  <select name="category">
                    <option>Community concern</option>
                    <option>Public service</option>
                    <option>Disaster response</option>
                  </select>
                </label>
                <label className="field-input">
                  <span>Observation</span>
                  <textarea name="observation" required placeholder="Enter aggregate observation" />
                </label>
                <button className="demo-primary" type="submit">
                  Save report
                </button>
                {saved && <span className="saved-state">Report saved for review.</span>}
              </form>
            </section>
            <section>
              <h3>Latest reports</h3>
              {reports.map((report, index) => (
                <article className="report-item" key={`${report.title}-${index}`}>
                  <div>
                    <strong>{report.title}</strong>
                    <span>
                      {report.location} · Aug {3 - Math.min(index, 2)}, 2026
                    </span>
                  </div>
                  <em>{report.status}</em>
                </article>
              ))}
            </section>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
