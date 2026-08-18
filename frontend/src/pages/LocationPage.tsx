import {
  useState,
} from 'react'
import PageShell from '../components/PageShell'
import LocationSentimentPanel from '../components/location/LocationSentimentPanel'
import CoverageFilter from '../components/dashboard/CoverageFilter'
import type {
  GeographySelection,
} from '../types/geography'

export default function LocationPage() {
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'
  const [geography, setGeography] = useState<GeographySelection>({
    region: '',
    province: '',
    district: '',
    locality: '',
  })
  const [period, setPeriod] = useState('30d')

  return (
    <PageShell
      title="Location View"
      subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : 'National Pulse'}
      dataMode="placeholder"
    >
      <div className="space-y-6">
        <CoverageFilter
          geography={geography}
          onGeographyChange={setGeography}
          period={period}
          onPeriodChange={setPeriod}
        />

        <LocationSentimentPanel
          geography={geography}
          onGeographyChange={setGeography}
          period={period}
        />
      </div>
    </PageShell>
  )
}
