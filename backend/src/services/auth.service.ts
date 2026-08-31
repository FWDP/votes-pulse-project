export interface MembershipRole {
  id?: string
  userId?: string
  tenantId?: string
  role?: string
  [key: string]: any
}

export const getMemberships = (userId?: string | number): MembershipRole[] => {
  if (!userId) return []

  const dict = (globalThis as any).__votesMemberships
  if (Array.isArray(dict)) {
    return dict.filter((membership: any) => String(membership?.userId ?? membership?.user_id) === String(userId))
  }

  const fallbackMembership = {
    id: 'membership-local-owner',
    userId: String(userId),
    tenantId: 'tenant-local',
    role: 'owner',
  }

  return [fallbackMembership]
}
