import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import PageShell from '../components/PageShell'
import LocationSentimentPanel from '../components/location/LocationSentimentPanel'
import CoverageFilter from '../components/dashboard/CoverageFilter'
import AiInsightPanel from '../components/dashboard/AiInsightPanel'
import type {
  GeographySelection,
} from '../types/geography'
import { getAssignedGeographySelection, getCoverageLabel, useAuth } from '../contexts/AuthContext'
import { isSameGeography } from '../utils/geography'
import { usePersistedElectionSelection } from '../hooks/usePersistedElectionSelection'
import type { LegislativeDistrict } from '../types/elections'

const getLocationFocus = (user: ReturnType<typeof useAuth>['user']) => {
  if (!user?.homeLocation) return 'local service delivery and public trust'

  if (user.homeLocation.includes('Marilao')) return 'flood control, drainage, and local infrastructure'
  if (user.homeLocation.includes('Cavite')) return 'traffic flow, mobility, and public service access'
  if (user.homeLocation.includes('Lucena')) return 'public safety, mobility, and local service responsiveness'
  if (user.homeLocation.includes('Navotas')) return 'drainage, flood preparedness, and urban service delivery'

  return 'service delivery, local sentiment, and civic trust'
}

export default function LocationPage() {
  const { user } = useAuth()
  const search = new URLSearchParams(window.location.search)
  const workspace = (search.get('workspace') as 'national' | 'candidate') || 'national'
  const candidate = workspace === 'candidate'
  const [geography, setGeography] = useState<GeographySelection>(getAssignedGeographySelection(user))
  const [period, setPeriod] = useState('30d')
  const [election, setElection] = usePersistedElectionSelection()
  const [selectedLegislativeDistrict, setSelectedLegislativeDistrict] =
    useState<LegislativeDistrict>()

  useEffect(() => {
    if (!user?.homeLocation || user.isSuperadmin) return

    const assigned = getAssignedGeographySelection(user)
    setGeography(current => isSameGeography(current, assigned) ? current : assigned)
  }, [user])

  const locationSummary = useMemo(() => {
    const coverage = selectedLegislativeDistrict?.label ??
      (getCoverageLabel(user) || 'Selected location')
    const focusArea = getLocationFocus(user)

    return {
      coverageLabel: coverage,
      periodLabel: period,
      sentiment: { positive: 31, neutral: 46, negative: 23 },
      topics: [
        { name: 'Public service delivery', mentions: 2148, positive: 28, neutral: 42, negative: 30 },
        { name: 'Infrastructure and mobility', mentions: 1846, positive: 22, neutral: 39, negative: 39 },
        { name: 'Flooding and drainage', mentions: 1580, positive: 20, neutral: 35, negative: 45 },
      ],
      insights: [{
        title: 'Location watch',
        description: `The selected geography is currently centered on ${focusArea}.`,
      }],
    }
  }, [period, selectedLegislativeDistrict, user])

  const locationPrompts = [
    'What is driving sentiment in this area right now?',
    'Which local issues need attention first?',
    'How does this place compare with nearby coverage?',
    'Give me a clear summary for leadership and field teams.',
  ]

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
          election={election}
          onElectionChange={setElection}
          onResolvedElectionChange={district => {
            setSelectedLegislativeDistrict(district)
          }}
          period={period}
          onPeriodChange={setPeriod}
        />

        <AiInsightPanel
          title="Location AI Brief"
          prompts={locationPrompts}
          context={locationSummary}
        />

        <LocationSentimentPanel
          geography={geography}
          onGeographyChange={setGeography}
          election={election}
          legislativeDistrict={selectedLegislativeDistrict}
          period={period}
        />
      </div>
    </PageShell>
  )
}
