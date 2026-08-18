import React from 'react'

export default function FiltersBar({
  onChange,
}: {
  onChange?: (values: { period?: string; severity?: string }) => void
}) {
  const [period, setPeriod] = React.useState<string>('30d')
  const [severity, setSeverity] = React.useState<string>('all')

  React.useEffect(() => {
    onChange?.({ period, severity })
  }, [period, severity])

  return (
    <div className="filters-bar bg-white/5 border-b border-white/5 p-3 flex items-center gap-3">
      <label className="text-xs text-slate-300">
        Time range
        <select value={period} onChange={e => setPeriod(e.target.value)} className="ml-2 rounded bg-slate-800 text-white text-xs px-2 py-1">
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </label>
      <label className="text-xs text-slate-300">
        Severity
        <select value={severity} onChange={e => setSeverity(e.target.value)} className="ml-2 rounded bg-slate-800 text-white text-xs px-2 py-1">
          <option value="all">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
    </div>
  )
}
