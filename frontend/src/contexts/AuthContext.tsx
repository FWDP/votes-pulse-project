import React, { createContext, useContext, useMemo, useState } from 'react'
import type { GeographySelection } from '../types/geography'

export type TestUser = {
  id: string
  displayName: string
  email: string
  isSuperadmin?: boolean
  homeLocation?: 'Navotas' | 'Cavite' | 'Lucena City' | 'Marilao, Bulacan'
  coverageScope?: 'locality' | 'province'
  coverageValue?: string
  coverageCode?: string
  provinceCode?: string
}

export const TEST_USERS: TestUser[] = [
  {
    id: 'user-superadmin-local',
    displayName: 'Super Admin',
    email: 'superadmin@example.test',
    isSuperadmin: true,
  },
  {
    id: 'user-navotas-local',
    displayName: 'Navotas User',
    email: 'navotas@example.test',
    homeLocation: 'Navotas',
    coverageScope: 'locality',
    coverageValue: 'Navotas',
    coverageCode: '1380900000',
  },
  {
    id: 'user-cavite-local',
    displayName: 'Cavite User',
    email: 'cavite@example.test',
    homeLocation: 'Cavite',
    coverageScope: 'province',
    coverageValue: 'Cavite',
    coverageCode: '0402100000',
  },
  {
    id: 'user-lucena-local',
    displayName: 'Lucena City User',
    email: 'lucena@example.test',
    homeLocation: 'Lucena City',
    coverageScope: 'locality',
    coverageValue: 'Lucena City',
    coverageCode: '0431200000',
    provinceCode: '0431000000',
  },
  {
    id: 'user-marilao-local',
    displayName: 'Marilao User',
    email: 'marilao@example.test',
    homeLocation: 'Marilao, Bulacan',
    coverageScope: 'locality',
    coverageValue: 'Marilao, Bulacan',
    coverageCode: '0314100000',
    provinceCode: '0314000000',
  },
]

export const getCoverageRestriction = (user?: Partial<TestUser>) => {
  if (!user?.homeLocation || user.isSuperadmin) return null

  const matches = TEST_USERS.find(candidate => candidate.homeLocation === user.homeLocation)
  if (!matches) return null

  return {
    field: matches.coverageScope,
    value: matches.coverageCode ?? matches.coverageValue,
    provinceValue: matches.provinceCode || undefined,
  }
}

export const getCoverageLabel = (user?: Partial<TestUser>) => {
  if (!user || user.isSuperadmin) return 'National coverage'

  switch (user.homeLocation) {
    case 'Navotas':
      return 'Coverage: City of Navotas'
    case 'Cavite':
      return 'Coverage: Cavite Province'
    case 'Lucena City':
      return 'Coverage: City of Lucena'
    case 'Marilao, Bulacan':
      return 'Coverage: Municipality of Marilao'
    default:
      return 'National coverage'
  }
}

export const getAssignedGeographySelection = (user?: Partial<TestUser>): GeographySelection => {
  if (!user?.homeLocation || user.isSuperadmin) {
    return { region: '', province: '', district: '', locality: '' }
  }

  switch (user.homeLocation) {
    case 'Navotas':
      return {
        region: '1300000000',
        province: '',
        district: '',
        locality: '1380900000',
      }
    case 'Cavite':
      return {
        region: '0400000000',
        province: '0402100000',
        district: '',
        locality: '',
      }
    case 'Lucena City':
      return {
        region: '0400000000',
        province: '0431000000',
        district: '',
        locality: '0431200000',
      }
    case 'Marilao, Bulacan':
      return {
        region: '0300000000',
        province: '0314000000',
        district: '',
        locality: '0314100000',
      }
    default:
      return { region: '', province: '', district: '', locality: '' }
  }
}

export const hasCoverageLock = (user?: Partial<TestUser>) => Boolean(user?.homeLocation && !user?.isSuperadmin)

const DEFAULT_TEST_USER_ID = TEST_USERS.find(candidate => candidate.homeLocation === 'Marilao, Bulacan')?.id ?? TEST_USERS[0].id
const LEGACY_DEFAULT_USER_ID = 'user-navotas-local'

const AuthContext = createContext<any>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_TEST_USER_ID

    const saved = window.localStorage.getItem('votespulse-user-id')

    if (saved === LEGACY_DEFAULT_USER_ID) {
      window.localStorage.setItem('votespulse-user-id', DEFAULT_TEST_USER_ID)
      return DEFAULT_TEST_USER_ID
    }

    if (saved && TEST_USERS.some(user => user.id === saved)) return saved

    window.localStorage.setItem('votespulse-user-id', DEFAULT_TEST_USER_ID)
    return DEFAULT_TEST_USER_ID
  })

  const user = useMemo(() => {
    return TEST_USERS.find(candidate => candidate.id === selectedUserId) ?? TEST_USERS[0]
  }, [selectedUserId])

  const accessibleWorkspaces = useMemo(() => ([
    {
      tenant: { id: 'tenant-local', slug: 'local', name: 'Local Tenant' },
      workspace: {
        id: 'workspace-local',
        slug: 'local',
        name: 'Local Workspace',
        product: 'votes',
      },
    },
  ]), [])

  const membershipForTenant = (tenantId: string) => ({ role: user.isSuperadmin ? 'owner' : 'member', tenantId })
  const signOut = () => { /* noop for dev */ }
  const switchUser = (nextUserId: string) => {
    if (!TEST_USERS.some(candidate => candidate.id === nextUserId)) return

    setSelectedUserId(nextUserId)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('votespulse-user-id', nextUserId)
    }
  }

  const value = { user, testUsers: TEST_USERS, accessibleWorkspaces, membershipForTenant, signOut, switchUser }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext
