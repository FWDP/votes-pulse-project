import React from 'react'

export default function MapLegend() {
  return (
    <div className="absolute right-3 bottom-3 z-20 flex items-center gap-3 rounded-md bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow">
      <span className="inline-flex items-center gap-2">
        <i className="h-2.5 w-2.5 rounded-sm bg-green-500" />
        Positive
      </span>

      <span className="inline-flex items-center gap-2">
        <i className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
        Mixed
      </span>

      <span className="inline-flex items-center gap-2">
        <i className="h-2.5 w-2.5 rounded-sm bg-red-500" />
        Negative
      </span>
    </div>
  )
}
