import React from 'react'
import { MapPin } from 'lucide-react'

export default function MapPanelPlaceholder({ children }: { children?: React.ReactNode }) {
  return (
    <div className="map-panel bg-slate-50 rounded-lg p-6 border border-slate-100 text-slate-600">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-slate-100">
          <MapPin size={18} />
        </div>
        <div>
          <div className="text-sm font-semibold">Map data unavailable</div>
          <div className="text-xs">Boundary data not loaded for the current selection.</div>
        </div>
      </div>
      {children}
    </div>
  )
}
