import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  repairRingTopology,
  signedRingArea,
  type Position,
} from './lib/geometryTopology'

interface BoundaryFeature {
  id: string
  properties: Record<string, unknown>
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: Position[][] | Position[][][]
  } | null
}

interface BoundaryCollection {
  type: 'FeatureCollection'
  metadata?: Record<string, unknown>
  features: BoundaryFeature[]
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const boundaryPath = resolve(
  scriptDirectory,
  '../src/data/normalized/legislative-district-boundaries-2025.geojson',
)
const collection = JSON.parse(
  readFileSync(boundaryPath, 'utf8'),
) as BoundaryCollection

const report: Array<Record<string, unknown>> = []

for (const feature of collection.features) {
  if (!feature.geometry) continue

  const polygons = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as Position[][]]
    : feature.geometry.coordinates as Position[][][]
  const repairedOuterRings: Position[][] = []
  let discardedArea = 0
  let intersectionsResolved = 0
  let originalArea = 0

  for (const polygon of polygons) {
    const outerRing = polygon[0]
    originalArea += Math.abs(signedRingArea(outerRing))
    const repaired = repairRingTopology(outerRing)
    repairedOuterRings.push(...repaired.rings)
    discardedArea += repaired.discardedArea
    intersectionsResolved += repaired.intersectionsResolved
  }

  feature.geometry = repairedOuterRings.length === 1
    ? { type: 'Polygon', coordinates: [repairedOuterRings[0]] }
    : { type: 'MultiPolygon', coordinates: repairedOuterRings.map(ring => [ring]) }

  const repairedArea = repairedOuterRings.reduce(
    (total, ring) => total + Math.abs(signedRingArea(ring)),
    0,
  )
  report.push({
    id: feature.id,
    geometryType: feature.geometry.type,
    intersectionsResolved,
    discardedArea,
    areaChangePercent: originalArea === 0
      ? 0
      : ((repairedArea - originalArea) / originalArea) * 100,
  })
}

writeFileSync(boundaryPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(report, null, 2))
