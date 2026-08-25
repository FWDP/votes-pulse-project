import {
    useMemo,
    useState,
} from 'react'

import type {
    BoundaryFeature,
    BoundaryFeatureCollection,
    GeoJsonPosition,
} from '../../types/geography'
import type { LocationSentimentMetric } from '../../types/sentiment'
import { getGeoJsonBounds } from '../../utils/geojson'

interface GeoJsonMapProps {
    data: BoundaryFeatureCollection
    metrics?: LocationSentimentMetric[]
    onAreaClick?: (key: string, feature: BoundaryFeature) => void
    selectedKey?: string | null
    height?: number
    ariaLabel?: string
}

const WIDTH = 480
const DEFAULT_HEIGHT = 390
const PADDING = 18

const getPolygons = (
    feature: BoundaryFeature,
): GeoJsonPosition[][][] => {
    if (!feature.geometry) return []

    return feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates
}

const getFeatureName = (
    feature: BoundaryFeature,
) => feature.properties.label ??
    feature.properties.city_name ??
    feature.properties.prov_name ??
    feature.properties.reg_name ??
    feature.properties.psgc_name ??
    'Administrative area'

const getFeatureCode = (
    feature: BoundaryFeature,
) => feature.properties.legislativeDistrictId ??
    feature.properties.psgc_10d ??
    feature.properties.psgc_code

const getShortLabel = (value: string) =>
    value
        .replace(/^City of /i, '')
        .replace(/^Municipality of /i, '')
        .replace(/ \(.+\)$/, '')

export default function GeoJsonMap({
    data,
    metrics = [],
    onAreaClick,
    selectedKey = null,
    height = DEFAULT_HEIGHT,
    ariaLabel = 'Geographic boundary map',
}: GeoJsonMapProps) {
    const [hoveredCode, setHoveredCode] = useState<string | null>(null)

    const projected = useMemo(() => {
        const points = data.features.flatMap(feature =>
            getPolygons(feature).flatMap(polygon =>
                polygon.flatMap(ring => ring),
            ),
        )

        if (points.length === 0) return []

        const bounds = getGeoJsonBounds(points)
        if (!bounds) return []
        const {
            minLongitude,
            maxLongitude,
            minLatitude,
            maxLatitude,
        } = bounds
        const longitudeRange = Math.max(maxLongitude - minLongitude, 0.001)
        const latitudeRange = Math.max(maxLatitude - minLatitude, 0.001)
        const scale = Math.min(
            (WIDTH - PADDING * 2) / longitudeRange,
            (height - PADDING * 2) / latitudeRange,
        )
        const drawingWidth = longitudeRange * scale
        const drawingHeight = latitudeRange * scale
        const offsetX = (WIDTH - drawingWidth) / 2
        const offsetY = (height - drawingHeight) / 2
        const project = ([longitude, latitude]: GeoJsonPosition) => [
            offsetX + (longitude - minLongitude) * scale,
            offsetY + (maxLatitude - latitude) * scale,
        ]

        const metricByCode = new Map<string, LocationSentimentMetric>()
        metrics.forEach(metric => {
            metricByCode.set(metric.code, metric)
            metric.aliases?.forEach(alias => metricByCode.set(alias, metric))
        })
        const aggregateMetric = metrics.length > 0
            ? {
                positive: Math.round(metrics.reduce((sum, metric) => sum + metric.positive, 0) / metrics.length),
                neutral: Math.round(metrics.reduce((sum, metric) => sum + metric.neutral, 0) / metrics.length),
                negative: Math.round(metrics.reduce((sum, metric) => sum + metric.negative, 0) / metrics.length),
            }
            : undefined

        return data.features.map((feature, index) => {
            const polygons = getPolygons(feature)
            const path = polygons.map(polygon =>
                polygon.map(ring =>
                    ring.map((point, pointIndex) => {
                        const [x, y] = project(point)

                        return `${pointIndex === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
                    }).join(' ') + ' Z',
                ).join(' '),
            ).join(' ')
            const outerPoints = polygons.flatMap(polygon => polygon[0] ?? [])
            const projectedOuterPoints = outerPoints.map(project)
            const center = projectedOuterPoints.length > 0
                ? projectedOuterPoints.reduce(
                    ([sumX, sumY], [x, y]) => [sumX + x, sumY + y],
                    [0, 0],
                ).map(value => value / projectedOuterPoints.length)
                : null

            return {
                feature,
                path,
                center,
                key: getFeatureCode(feature) ?? String(index),
                metric: [
                    feature.properties.psgc_10d,
                    feature.properties.psgc_code,
                    feature.properties.city_code,
                    feature.properties.prov_code,
                ].map(code => code ? metricByCode.get(code) : undefined)
                    .find(metric => metric !== undefined) ?? aggregateMetric,
            }
        })
    }, [data, height, metrics])

    const hoveredFeature = projected.find(
        item => item.key === hoveredCode,
    )?.feature
    const showLabels = projected.length <= 16

    return (
        <div className="relative h-full w-full" style={{ minHeight: height }}>
            <svg
                viewBox={`0 0 ${WIDTH} ${height}`}
                className="h-full w-full"
                style={{ minHeight: height }}
                role="img"
                aria-label={ariaLabel}
            >
                <rect width={WIDTH} height={height} rx="14" fill="#f8fafc" />

                <g>
                    {projected.map(item => (
                        <path
                            key={item.key}
                            d={item.path}
                            fill={
                                item.key === selectedKey
                                    ? '#1e293b'
                                    : hoveredCode === item.key
                                        ? '#475569'
                                        : item.metric
                                            ? item.metric.positive >= item.metric.neutral && item.metric.positive >= item.metric.negative
                                                ? '#22c55e'
                                                : item.metric.negative >= item.metric.positive && item.metric.negative >= item.metric.neutral
                                                    ? '#ef4444'
                                                    : '#f59e0b'
                                            : '#dbe4ee'
                            }
                            fillRule="evenodd"
                            stroke={item.key === selectedKey ? '#000000' : '#ffffff'}
                            strokeWidth={projected.length > 100 ? 0.35 : 0.9}
                            className="cursor-pointer transition-colors duration-150"
                            onMouseEnter={() => setHoveredCode(item.key)}
                            onMouseLeave={() => setHoveredCode(null)}
                            onFocus={() => setHoveredCode(item.key)}
                            onBlur={() => setHoveredCode(null)}
                            onClick={() => onAreaClick?.(item.key, item.feature)}
                            tabIndex={0}
                        >
                            <title>{getFeatureName(item.feature)}</title>
                        </path>
                    ))}
                </g>

                {showLabels && (
                    <g className="pointer-events-none">
                        {projected.map(item => item.center && (
                            <text
                                key={`${item.key}-label`}
                                x={item.center[0]}
                                y={item.center[1]}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#475569"
                                fontSize={projected.length <= 18 ? 6.5 : 5.5}
                                fontWeight="600"
                            >
                                {getShortLabel(getFeatureName(item.feature))}
                            </text>
                        ))}
                    </g>
                )}
            </svg>

            <div className="pointer-events-none absolute left-3 top-3 max-w-[75%] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {hoveredFeature ? 'Area details' : 'Boundary layer'}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-700">
                    {hoveredFeature
                        ? getFeatureName(hoveredFeature)
                        : 'Hover over an area for details'}
                </p>
                {hoveredFeature && getFeatureCode(hoveredFeature) && (
                    <p className="mt-0.5 text-[10px] text-slate-500">
                        {hoveredFeature.properties.legislativeDistrictId ? 'District' : 'PSGC'}{' '}
                        {getFeatureCode(hoveredFeature)}
                    </p>
                )}
            </div>
        </div>
    )
}
