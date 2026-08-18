import {
  useEffect,
  useState,
} from 'react'
import PageShell from '../components/PageShell'
import LocationSentimentPanel from '../components/location/LocationSentimentPanel'
import CoverageFilter from '../components/dashboard/CoverageFilter'
import type {
  GeographySelection,
} from '../types/geography'
import { getAssignedGeographySelection, getCoverageLabel, useAuth } from '../contexts/AuthContext'
import { isSameGeography } from '../utils/geography'

export default function LocationPage() {
  const { user } = useAuth()
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'
  const [geography, setGeography] = useState<GeographySelection>(getAssignedGeographySelection(user))
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    if (!user?.homeLocation || user.isSuperadmin) return

    const assigned = getAssignedGeographySelection(user)
    setGeography(current => isSameGeography(current, assigned) ? current : assigned)
  }, [user])

  return (
    <PageShell
      title="Location View"
      subtitle={candidate ? 'Candidate workspace · Ramon de la Cruz' : getCoverageLabel(user)}
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
