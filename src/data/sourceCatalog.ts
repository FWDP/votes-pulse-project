export type SourceMethod = 'api' | 'download' | 'authorized-crawl' | 'manual'

export type DataSource = {
  id: string
  name: string
  authority: 'official' | 'licensed' | 'public-discourse'
  category: 'geography' | 'statistics' | 'elections' | 'government' | 'events' | 'media'
  url: string
  method: SourceMethod
  priority: 1 | 2 | 3
  status: 'ready-to-integrate' | 'review-required' | 'approval-required'
  geographicLevel: string
  caution?: string
}

export const sourceCatalog: DataSource[] = [
  { id: 'psa-psgc', name: 'PSA Philippine Standard Geographic Code', authority: 'official', category: 'geography', url: 'https://psa.gov.ph/classifications-api/psgc', method: 'api', priority: 1, status: 'ready-to-integrate', geographicLevel: 'Barangay to national' },
  { id: 'psa-openstat', name: 'PSA OpenSTAT', authority: 'official', category: 'statistics', url: 'https://openstat.psa.gov.ph/API-Documentation', method: 'api', priority: 1, status: 'ready-to-integrate', geographicLevel: 'Dataset-dependent' },
  { id: 'open-data-ph', name: 'Open Data Philippines', authority: 'official', category: 'government', url: 'https://data.gov.ph/', method: 'download', priority: 1, status: 'review-required', geographicLevel: 'Dataset-dependent', caution: 'Review the license of each publishing agency.' },
  { id: 'comelec-stats', name: 'COMELEC Election Statistics', authority: 'official', category: 'elections', url: 'https://www.comelec.gov.ph/?r=2025NLE/Statistics', method: 'download', priority: 1, status: 'review-required', geographicLevel: 'Precinct/LGU/district where published', caution: 'Preserve election cycle and official-result status.' },
  { id: 'house-members', name: 'House Members and Districts', authority: 'official', category: 'elections', url: 'https://congress.gov.ph/house-members', method: 'authorized-crawl', priority: 2, status: 'review-required', geographicLevel: 'Congressional district' },
  { id: 'dswd-dromic', name: 'DSWD DROMIC Situation Reports', authority: 'official', category: 'events', url: 'https://dromic.dswd.gov.ph/category/situation-reports/', method: 'authorized-crawl', priority: 2, status: 'review-required', geographicLevel: 'Barangay/LGU/region', caution: 'Later situation reports may supersede earlier totals.' },
  { id: 'pagasa', name: 'PAGASA Bulletins', authority: 'official', category: 'events', url: 'https://www.pagasa.dost.gov.ph/', method: 'download', priority: 2, status: 'review-required', geographicLevel: 'Forecast area/station', caution: 'Some raw climate data requires a formal request and terms of use.' },
  { id: 'gdelt', name: 'GDELT', authority: 'public-discourse', category: 'media', url: 'https://www.gdeltproject.org/', method: 'api', priority: 3, status: 'ready-to-integrate', geographicLevel: 'Detected location', caution: 'Automated tone is a signal, not ground truth.' },
  { id: 'youtube', name: 'YouTube Data API', authority: 'licensed', category: 'media', url: 'https://developers.google.com/youtube/v3', method: 'api', priority: 3, status: 'approval-required', geographicLevel: 'Channel/video metadata', caution: 'Requires API credentials, quota controls and deletion handling.' },
  { id: 'reddit', name: 'Reddit API', authority: 'licensed', category: 'media', url: 'https://www.reddit.com/dev/api/', method: 'api', priority: 3, status: 'approval-required', geographicLevel: 'Community/inferred place', caution: 'Not representative of the electorate.' },
]
