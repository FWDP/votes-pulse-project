import type { GeoJsonPosition } from '../types/geography'

export interface GeoJsonBounds {
  minLongitude: number
  maxLongitude: number
  minLatitude: number
  maxLatitude: number
}

export const getGeoJsonBounds = (
  points: GeoJsonPosition[],
): GeoJsonBounds | null => {
  if (points.length === 0) return null

  let minLongitude = Infinity
  let maxLongitude = -Infinity
  let minLatitude = Infinity
  let maxLatitude = -Infinity

  for (const [longitude, latitude] of points) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue
    minLongitude = Math.min(minLongitude, longitude)
    maxLongitude = Math.max(maxLongitude, longitude)
    minLatitude = Math.min(minLatitude, latitude)
    maxLatitude = Math.max(maxLatitude, latitude)
  }

  if (!Number.isFinite(minLongitude) || !Number.isFinite(minLatitude)) {
    return null
  }

  return {
    minLongitude,
    maxLongitude,
    minLatitude,
    maxLatitude,
  }
}
