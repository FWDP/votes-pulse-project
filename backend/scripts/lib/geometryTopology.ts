export type Position = [number, number]

export interface RingIntersection {
  firstSegment: number
  secondSegment: number
  position: Position
}

const PARAMETER_EPSILON = 1e-10
const COORDINATE_EPSILON = 1e-12

const cross = (first: Position, second: Position) =>
  first[0] * second[1] - first[1] * second[0]

const subtract = (first: Position, second: Position): Position => [
  first[0] - second[0],
  first[1] - second[1],
]

const samePosition = (first: Position, second: Position) =>
  Math.abs(first[0] - second[0]) <= COORDINATE_EPSILON &&
  Math.abs(first[1] - second[1]) <= COORDINATE_EPSILON

export const signedRingArea = (ring: Position[]): number => {
  let twiceArea = 0

  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index]
    const next = ring[index + 1]
    twiceArea += current[0] * next[1] - next[0] * current[1]
  }

  return twiceArea / 2
}

export const closeAndDedupeRing = (positions: Position[]): Position[] => {
  const ring: Position[] = []

  for (const position of positions) {
    const normalized: Position = [position[0], position[1]]
    if (!ring.length || !samePosition(ring[ring.length - 1], normalized)) {
      ring.push(normalized)
    }
  }

  if (ring.length && !samePosition(ring[0], ring[ring.length - 1])) {
    ring.push([...ring[0]])
  }

  return ring
}

const properIntersection = (
  firstStart: Position,
  firstEnd: Position,
  secondStart: Position,
  secondEnd: Position,
): Position | null => {
  const firstVector = subtract(firstEnd, firstStart)
  const secondVector = subtract(secondEnd, secondStart)
  const denominator = cross(firstVector, secondVector)
  if (Math.abs(denominator) <= COORDINATE_EPSILON) return null

  const betweenStarts = subtract(secondStart, firstStart)
  const firstParameter = cross(betweenStarts, secondVector) / denominator
  const secondParameter = cross(betweenStarts, firstVector) / denominator

  if (
    firstParameter <= PARAMETER_EPSILON ||
    firstParameter >= 1 - PARAMETER_EPSILON ||
    secondParameter <= PARAMETER_EPSILON ||
    secondParameter >= 1 - PARAMETER_EPSILON
  ) return null

  return [
    firstStart[0] + firstParameter * firstVector[0],
    firstStart[1] + firstParameter * firstVector[1],
  ]
}

export const findFirstProperIntersection = (
  ring: Position[],
): RingIntersection | null => {
  const segmentCount = ring.length - 1

  for (let first = 0; first < segmentCount; first += 1) {
    for (let second = first + 2; second < segmentCount; second += 1) {
      if (first === 0 && second === segmentCount - 1) continue

      const position = properIntersection(
        ring[first],
        ring[first + 1],
        ring[second],
        ring[second + 1],
      )
      if (position) {
        return {
          firstSegment: first,
          secondSegment: second,
          position,
        }
      }
    }
  }

  return null
}

const orientation = (first: Position, second: Position, third: Position) =>
  cross(subtract(second, first), subtract(third, first))

const pointOnSegment = (point: Position, start: Position, end: Position) =>
  Math.abs(orientation(start, end, point)) <= COORDINATE_EPSILON &&
  point[0] >= Math.min(start[0], end[0]) - COORDINATE_EPSILON &&
  point[0] <= Math.max(start[0], end[0]) + COORDINATE_EPSILON &&
  point[1] >= Math.min(start[1], end[1]) - COORDINATE_EPSILON &&
  point[1] <= Math.max(start[1], end[1]) + COORDINATE_EPSILON

const segmentsTouchOrCross = (
  firstStart: Position,
  firstEnd: Position,
  secondStart: Position,
  secondEnd: Position,
) => {
  const firstOrientation = orientation(firstStart, firstEnd, secondStart)
  const secondOrientation = orientation(firstStart, firstEnd, secondEnd)
  const thirdOrientation = orientation(secondStart, secondEnd, firstStart)
  const fourthOrientation = orientation(secondStart, secondEnd, firstEnd)

  if (
    ((firstOrientation > COORDINATE_EPSILON && secondOrientation < -COORDINATE_EPSILON) ||
      (firstOrientation < -COORDINATE_EPSILON && secondOrientation > COORDINATE_EPSILON)) &&
    ((thirdOrientation > COORDINATE_EPSILON && fourthOrientation < -COORDINATE_EPSILON) ||
      (thirdOrientation < -COORDINATE_EPSILON && fourthOrientation > COORDINATE_EPSILON))
  ) return true

  return (
    pointOnSegment(secondStart, firstStart, firstEnd) ||
    pointOnSegment(secondEnd, firstStart, firstEnd) ||
    pointOnSegment(firstStart, secondStart, secondEnd) ||
    pointOnSegment(firstEnd, secondStart, secondEnd)
  )
}

export const findRingTopologyIssues = (ring: Position[]): string[] => {
  const issues: string[] = []
  const segmentCount = ring.length - 1

  const inspectPair = (first: number, second: number) => {
    if (second < first) [first, second] = [second, first]
    if (second <= first + 1) return
    if (first === 0 && second === segmentCount - 1) return
    if (segmentsTouchOrCross(
      ring[first],
      ring[first + 1],
      ring[second],
      ring[second + 1],
    )) {
      issues.push(`segments ${first} and ${second} intersect`)
    }
  }

  if (segmentCount <= 500) {
    for (let first = 0; first < segmentCount; first += 1) {
      for (let second = first + 2; second < segmentCount; second += 1) {
        inspectPair(first, second)
      }
    }
    return issues
  }

  // Large generated administrative rings can contain tens of thousands of
  // segments. A uniform spatial index keeps intersection validation practical
  // while preserving the exact segment test used for smaller manual rings.
  const xs = ring.map(position => position[0])
  const ys = ring.map(position => position[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const gridSize = Math.max(1, Math.ceil(Math.sqrt(segmentCount)))
  const cellWidth = (maxX - minX) / gridSize || 1
  const cellHeight = (maxY - minY) / gridSize || 1
  const cells = new Map<string, number[]>()
  const cellIndex = (value: number, minimum: number, size: number) =>
    Math.max(0, Math.min(gridSize - 1, Math.floor((value - minimum) / size)))

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const start = ring[segment]
    const end = ring[segment + 1]
    const firstX = cellIndex(Math.min(start[0], end[0]), minX, cellWidth)
    const lastX = cellIndex(Math.max(start[0], end[0]), minX, cellWidth)
    const firstY = cellIndex(Math.min(start[1], end[1]), minY, cellHeight)
    const lastY = cellIndex(Math.max(start[1], end[1]), minY, cellHeight)

    for (let x = firstX; x <= lastX; x += 1) {
      for (let y = firstY; y <= lastY; y += 1) {
        const key = `${x}:${y}`
        const members = cells.get(key) ?? []
        members.push(segment)
        cells.set(key, members)
      }
    }
  }

  const inspectedPairs = new Set<string>()
  for (const members of cells.values()) {
    for (let firstIndex = 0; firstIndex < members.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < members.length; secondIndex += 1) {
        const first = Math.min(members[firstIndex], members[secondIndex])
        const second = Math.max(members[firstIndex], members[secondIndex])
        const key = `${first}:${second}`
        if (inspectedPairs.has(key)) continue
        inspectedPairs.add(key)
        inspectPair(first, second)
      }
    }
  }

  return issues
}

const splitRingAtIntersection = (
  ring: Position[],
  intersection: RingIntersection,
): [Position[], Position[]] => {
  const { firstSegment, secondSegment, position } = intersection
  const firstRing = closeAndDedupeRing([
    position,
    ...ring.slice(firstSegment + 1, secondSegment + 1),
    position,
  ])
  const secondRing = closeAndDedupeRing([
    position,
    ...ring.slice(secondSegment + 1, -1),
    ...ring.slice(0, firstSegment + 1),
    position,
  ])

  return [firstRing, secondRing]
}

const orientCounterClockwise = (ring: Position[]) =>
  signedRingArea(ring) < 0 ? [...ring].reverse() : ring

export interface RingRepairResult {
  rings: Position[][]
  discardedArea: number
  intersectionsResolved: number
}

/**
 * Polygonize a self-crossing ring. Faces smaller than the configured ratio are
 * treated as tracing artifacts; material faces are retained as separate outer
 * rings so callers can emit a MultiPolygon without losing meaningful area.
 */
export const repairRingTopology = (
  input: Position[],
  smallFaceRatio = 1e-4,
  depth = 0,
): RingRepairResult => {
  if (depth > 100) throw new Error('Topology repair exceeded 100 intersections')

  const ring = closeAndDedupeRing(input)
  const intersection = findFirstProperIntersection(ring)
  if (!intersection) {
    return {
      rings: [orientCounterClockwise(ring)],
      discardedArea: 0,
      intersectionsResolved: 0,
    }
  }

  const split = splitRingAtIntersection(ring, intersection)
  const areas = split.map(candidate => Math.abs(signedRingArea(candidate)))
  const largerIndex = areas[0] >= areas[1] ? 0 : 1
  const smallerIndex = largerIndex === 0 ? 1 : 0
  const ratio = areas[largerIndex] > 0
    ? areas[smallerIndex] / areas[largerIndex]
    : 0

  if (ratio <= smallFaceRatio) {
    const repaired = repairRingTopology(split[largerIndex], smallFaceRatio, depth + 1)
    return {
      rings: repaired.rings,
      discardedArea: repaired.discardedArea + areas[smallerIndex],
      intersectionsResolved: repaired.intersectionsResolved + 1,
    }
  }

  const firstRepair = repairRingTopology(split[0], smallFaceRatio, depth + 1)
  const secondRepair = repairRingTopology(split[1], smallFaceRatio, depth + 1)
  return {
    rings: [...firstRepair.rings, ...secondRepair.rings],
    discardedArea: firstRepair.discardedArea + secondRepair.discardedArea,
    intersectionsResolved:
      firstRepair.intersectionsResolved + secondRepair.intersectionsResolved + 1,
  }
}
