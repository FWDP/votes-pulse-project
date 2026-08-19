import { getApiUrl } from '../utils/getApiUrl'

export interface Brand {
  id: string
  name: string
  slug: string
  search_id?: string | null
}

export async function getBrands(): Promise<Brand[]> {
  const res = await fetch(getApiUrl('/api/brands'), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Brands API returned ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}
