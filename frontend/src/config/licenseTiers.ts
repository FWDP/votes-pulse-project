export const LICENSE_TIERS = {
  national: {
    label: 'NATIONAL',
    description:
      'For national campaigns, national political organizations, and multi-region political operations.',
  },
  'provincial-partylist': {
    label: 'PROVINCIAL/PARTYLIST',
    description:
      'For governors, provincial political organizations, province-wide campaigns, and partylists.',
  },
  'city-district-municipality': {
    label: 'CITY/DISTRICT/MUNICIPALITY',
    description:
      'For mayors, congressional districts, municipalities, and city-level political organizations.',
  },
} as const

export type LicenseTier = keyof typeof LICENSE_TIERS

export const getLicenseTierDefinition = (tier: LicenseTier) =>
  LICENSE_TIERS[tier]

export const inferLicenseTier = (user: {
  isSuperadmin?: boolean
  coverageScope?: string
}): LicenseTier => {
  if (
    user.isSuperadmin ||
    user.coverageScope === 'national' ||
    user.coverageScope === 'region'
  ) return 'national'

  if (user.coverageScope === 'province') return 'provincial-partylist'

  return 'city-district-municipality'
}
