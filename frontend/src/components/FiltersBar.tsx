import React from 'react'

export default function FiltersBar({
  onChange,
  showPeriod = true,
}: {
  onChange?: (values: { period?: string; severity?: string }) => void
  showPeriod?: boolean
}) {
  const [period, setPeriod] = React.useState<string>('30d')
  const [severity, setSeverity] = React.useState<string>('all')

  React.useEffect(() => {
    onChange?.({ period, severity })
  }, [period, severity, onChange])

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {showPeriod && <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <span>Time range</span>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        >
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </label>}

      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <span>Severity</span>
        <select
          value={severity}
          onChange={e => setSeverity(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        >
          <option value="all">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
    </div>
  )
}
