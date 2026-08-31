import React, { createContext, useContext, useMemo, useState } from 'react'
import {
  getLicenseTierDefinition,
  inferLicenseTier,
  type LicenseTier,
} from '../config/licenseTiers'
import type { GeographySelection } from '../types/geography'
import type { MobileSession } from '../../../shared/mobileSessions'
import {
  createFieldReportsSession,
  synchronizeFieldReportRecipients,
} from '../services/fieldReportsApi'

export type TestUser = {
  id: string
  displayName: string
  email: string
  licenseTier: LicenseTier
  isSuperadmin?: boolean
  homeLocation?: 'Navotas' | 'Cavite' | 'Lucena City' | 'Marilao, Bulacan' | string
  coverageScope?: 'national' | 'region' | 'locality' | 'province'
  coverageValue?: string
  coverageCode?: string
  provinceCode?: string
  regionCode?: string
}

export const TEST_USERS: TestUser[] = [
  {
    id: 'user-superadmin-local',
    displayName: 'Super Admin',
    email: 'superadmin@example.test',
    licenseTier: 'national',
    isSuperadmin: true,
  },
  {
    id: 'user-navotas-local',
    displayName: 'Navotas User',
    email: 'navotas@example.test',
    licenseTier: 'city-district-municipality',
    homeLocation: 'Navotas',
    coverageScope: 'locality',
    coverageValue: 'Navotas',
    coverageCode: '1380900000',
  },
  {
    id: 'user-cavite-local',
    displayName: 'Cavite User',
    email: 'cavite@example.test',
    licenseTier: 'provincial-partylist',
    homeLocation: 'Cavite',
    coverageScope: 'province',
    coverageValue: 'Cavite',
    coverageCode: '0402100000',
  },
  {
    id: 'user-lucena-local',
    displayName: 'Lucena City User',
    email: 'lucena@example.test',
    licenseTier: 'city-district-municipality',
    homeLocation: 'Lucena City',
    coverageScope: 'locality',
    coverageValue: 'Lucena City',
    coverageCode: '0431200000',
  },
  {
    id: 'user-marilao-local',
    displayName: 'Marilao User',
    email: 'marilao@example.test',
    licenseTier: 'city-district-municipality',
    homeLocation: 'Marilao, Bulacan',
    coverageScope: 'locality',
    coverageValue: 'Marilao, Bulacan',
    coverageCode: '0301411000',
    provinceCode: '0301400000',
  },
  {
    id: 'user-quezon-city-local',
    displayName: 'Quezon City User',
    email: 'quezoncity@example.test',
    licenseTier: 'city-district-municipality',
    homeLocation: 'Quezon City',
    coverageScope: 'locality',
    coverageValue: 'Quezon City',
    coverageCode: '1381300000',
    regionCode: '1300000000',
  },
]

export const inferRegionCode = (code?: string): string | undefined => {
  if (!code || !/^\d{10}$/.test(code)) return undefined
  return `${code.slice(0, 2)}00000000`
}

export const getUserLicenseTier = (user?: Partial<TestUser>): LicenseTier =>
  user?.licenseTier ?? inferLicenseTier(user ?? {})

export const getUserLicenseLabel = (user?: Partial<TestUser>) =>
  getLicenseTierDefinition(getUserLicenseTier(user)).label

export const getCoverageRestriction = (user?: Partial<TestUser>) => {
  if (
    !user?.homeLocation ||
    user.isSuperadmin ||
    getUserLicenseTier(user) === 'national'
  ) return null

  const matched = TEST_USERS.find(candidate => candidate.homeLocation === user.homeLocation)
  const coverageScope = user.coverageScope ?? matched?.coverageScope ?? 'locality'
  const coverageCode = user.coverageCode ?? matched?.coverageCode ?? user.coverageValue ?? ''
  const provinceValue = user.provinceCode ?? matched?.provinceCode ?? undefined
  const regionValue = user.regionCode ?? matched?.regionCode ?? inferRegionCode(coverageCode)

  if (!coverageCode && !regionValue) return null

  return {
    field: coverageScope,
    value: coverageCode || regionValue || '',
    provinceValue: provinceValue || undefined,
    regionValue: regionValue || undefined,
  }
}

export const getCoverageLabel = (user?: Partial<TestUser>) => {
  if (
    !user ||
    user.isSuperadmin ||
    getUserLicenseTier(user) === 'national'
  ) return 'National coverage'

  switch (user.homeLocation) {
    case 'Navotas':
      return 'Coverage: City of Navotas'
    case 'Cavite':
      return 'Coverage: Cavite Province'
    case 'Lucena City':
      return 'Coverage: City of Lucena'
    case 'Marilao, Bulacan':
      return 'Coverage: Municipality of Marilao'
    case 'Quezon City':
      return 'Coverage: Quezon City'
    default:
      return `Coverage: ${user.homeLocation ?? 'Assigned area'}`
  }
}

export const getAssignedGeographySelection = (user?: Partial<TestUser>): GeographySelection => {
  if (
    !user?.homeLocation ||
    user.isSuperadmin ||
    getUserLicenseTier(user) === 'national'
  ) {
    return { region: '', province: '', district: '', locality: '' }
  }

  const regionCode = user.regionCode ?? inferRegionCode(user.coverageCode) ?? inferRegionCode(user.provinceCode) ?? ''

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
        province: '',
        district: '',
        locality: '0431200000',
      }
    case 'Marilao, Bulacan':
      return {
        region: '0300000000',
        province: '0301400000',
        district: '',
        locality: '0301411000',
      }
    case 'Quezon City':
      return {
        region: '1300000000',
        province: '',
        district: '',
        locality: '1381300000',
      }
    default:
      if (!user.coverageScope) {
        return { region: '', province: '', district: '', locality: '' }
      }
      if (user.coverageScope === 'region') {
        return {
          region: user.coverageCode || regionCode,
          province: '',
          district: '',
          locality: '',
        }
      }
      if (user.coverageScope === 'province') {
        return {
          region: user.regionCode || regionCode,
          province: user.coverageCode || '',
          district: '',
          locality: '',
        }
      }
      return {
        region: user.regionCode || regionCode,
        province: user.provinceCode || '',
        district: '',
        locality: user.coverageCode || '',
      }
  }
}

export const hasCoverageLock = (user?: Partial<TestUser>) => Boolean(
  user?.homeLocation &&
  !user?.isSuperadmin &&
  getUserLicenseTier(user) !== 'national',
)

const DEFAULT_TEST_USER_ID = TEST_USERS.find(candidate => candidate.homeLocation === 'Marilao, Bulacan')?.id ?? TEST_USERS[0].id
const LEGACY_DEFAULT_USER_ID = 'user-navotas-local'
const USERS_STORAGE_KEY = 'votes-users'
const SELECTED_USER_STORAGE_KEY = 'votes-user-id'

type PersistedTestUser = Omit<TestUser, 'licenseTier'> & {
  licenseTier?: LicenseTier
}

const normalizePersistedUser = (
  user: PersistedTestUser,
  baseUser?: TestUser,
): TestUser => {
  const combined = { ...baseUser, ...user }
  return {
    ...combined,
    licenseTier:
      user.licenseTier ?? baseUser?.licenseTier ?? inferLicenseTier(combined),
  } as TestUser
}

const mergeUsers = (baseUsers: TestUser[], incomingUsers: PersistedTestUser[]) => {
  const merged = new Map<string, TestUser>()

  baseUsers.forEach(user => merged.set(user.id, user))
  incomingUsers.forEach(user => {
    merged.set(user.id, normalizePersistedUser(user, merged.get(user.id)))
  })

  return Array.from(merged.values())
}

const readPersistedUsers = (): TestUser[] => {
  if (typeof window === 'undefined') return TEST_USERS

  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY)
    if (!raw) return TEST_USERS

    const parsed = JSON.parse(raw) as PersistedTestUser[]
    if (!Array.isArray(parsed) || parsed.length === 0) return TEST_USERS

    return mergeUsers(TEST_USERS, parsed)
  } catch {
    return TEST_USERS
  }
}

const AuthContext = createContext<any>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [testUsers, setTestUsers] = useState<TestUser[]>(() => readPersistedUsers())
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_TEST_USER_ID

    const saved = window.localStorage.getItem(SELECTED_USER_STORAGE_KEY)

    if (saved === LEGACY_DEFAULT_USER_ID) {
      window.localStorage.setItem(SELECTED_USER_STORAGE_KEY, DEFAULT_TEST_USER_ID)
      return DEFAULT_TEST_USER_ID
    }

    const availableUsers = readPersistedUsers()
    if (saved && availableUsers.some(user => user.id === saved)) return saved

    window.localStorage.setItem(SELECTED_USER_STORAGE_KEY, DEFAULT_TEST_USER_ID)
    return DEFAULT_TEST_USER_ID
  })

  const user = useMemo(() => {
    return testUsers.find(candidate => candidate.id === selectedUserId) ?? testUsers[0] ?? TEST_USERS[0]
  }, [selectedUserId, testUsers])

  const [fieldReportsSession, setFieldReportsSession] = useState<MobileSession | null>(null)
  const [fieldReportsConnecting, setFieldReportsConnecting] = useState(false)
  const [fieldReportsConnectionError, setFieldReportsConnectionError] = useState<string | null>(null)

  React.useEffect(() => {
    setFieldReportsSession(null)
    setFieldReportsConnectionError(null)
    if (!user?.email) return
    const controller = new AbortController()
    setFieldReportsConnecting(true)
    void createFieldReportsSession(user.email, controller.signal, {
      id: user.id,
      displayName: user.displayName,
    })
      .then(async session => {
        if (controller.signal.aborted) return
        try {
          await synchronizeFieldReportRecipients(
            session.token,
            testUsers.map(candidate => ({
              id: candidate.id,
              displayName: candidate.displayName,
              email: candidate.email,
              isSuperadmin: candidate.isSuperadmin,
            })),
            controller.signal,
          )
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return
          // Account synchronization is a prototype convenience. A valid
          // session must remain usable when that optional endpoint is disabled.
          console.warn('Unable to synchronize Web App accounts:', error)
        }
        if (!controller.signal.aborted) setFieldReportsSession(session)
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        const message = error instanceof Error ? error.message : 'Unable to connect to Field Reports.'
        setFieldReportsConnectionError(message)
        console.warn('Unable to create the Field Reports session:', error)
      })
      .finally(() => {
        if (!controller.signal.aborted) setFieldReportsConnecting(false)
      })
    return () => controller.abort()
  }, [testUsers, user?.email])

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
    if (!testUsers.some(candidate => candidate.id === nextUserId)) return

    setSelectedUserId(nextUserId)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SELECTED_USER_STORAGE_KEY, nextUserId)
    }
  }

  const createTestUser = (input: Partial<TestUser> & {
    displayName: string
    email: string
    licenseTier: LicenseTier
    homeLocation?: string
  }) => {
    const sanitizedDisplayName = input.displayName.trim()
    const sanitizedEmail = input.email.trim()
    const isNational = input.licenseTier === 'national'
    const sanitizedHomeLocation = isNational
      ? 'National'
      : input.homeLocation?.trim() ?? ''
    const coverageScope = isNational
      ? 'national'
      : input.coverageScope ?? (
          input.licenseTier === 'provincial-partylist' ? 'province' : 'locality'
        )
    const coverageCode = isNational ? '' : input.coverageCode?.trim() ?? ''
    const provinceCode = isNational ? '' : input.provinceCode?.trim() ?? ''
    const regionCode = isNational
      ? ''
      : input.regionCode?.trim() ??
        inferRegionCode(coverageCode) ??
        inferRegionCode(provinceCode) ??
        ''

    const nextUser: TestUser = {
      id: `user-custom-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      displayName: sanitizedDisplayName,
      email: sanitizedEmail,
      licenseTier: input.licenseTier,
      homeLocation: sanitizedHomeLocation,
      coverageScope,
      coverageValue: sanitizedHomeLocation,
      coverageCode: coverageCode || '',
      provinceCode: provinceCode || '',
      regionCode: regionCode || '',
    }

    setTestUsers(current => {
      const nextUsers = [...current, nextUser]

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(nextUsers))
      }

      return nextUsers
    })
    setSelectedUserId(nextUser.id)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SELECTED_USER_STORAGE_KEY, nextUser.id)
    }

    return nextUser
  }

  const value = {
    user,
    testUsers,
    accessibleWorkspaces,
    membershipForTenant,
    signOut,
    switchUser,
    createTestUser,
    fieldReportsSession,
    fieldReportsConnecting,
    fieldReportsConnectionError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext
