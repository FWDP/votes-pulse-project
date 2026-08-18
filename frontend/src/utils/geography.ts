import type { GeographySelection } from '../types/geography'

export function isSameGeography(a: GeographySelection, b: GeographySelection) {
  return (
    a.region === b.region &&
    a.province === b.province &&
    a.district === b.district &&
    a.locality === b.locality
  )
}
