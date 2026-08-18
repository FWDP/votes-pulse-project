import type { GeographySelection } from '../types/geography'

export interface TimelinePoint {
    date: string
    label: string
    volume: number
    sentiment: number
    netScore: number
    negative: number
    event?: string
}

const PERIOD_CONFIG = {
    '7d': { count: 7, unit: 'day', label: 'Daily' },
    '30d': { count: 30, unit: 'day', label: 'Daily' },
    '90d': { count: 13, unit: 'week', label: 'Weekly' },
    '1y': { count: 12, unit: 'month', label: 'Monthly' },
} as const

const EVENT_NAMES = [
    'Public policy announcement',
    'Severe weather response',
    'Transport and infrastructure update',
    'Regional consultation period',
    'Public health advisory',
]

const hashString = (value: string) => {
    let hash = 0
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(index)
        hash |= 0
    }
    return Math.abs(hash)
}

const formatLabel = (date: Date, unit: 'day' | 'week' | 'month') =>
    new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        ...(unit !== 'month' ? { day: 'numeric' } : {}),
        ...(unit === 'month' ? { year: '2-digit' } : {}),
    }).format(date)

export const getPlaceholderTimeline = (
    geography: GeographySelection,
    period: string,
) => {
    const config = PERIOD_CONFIG[period as keyof typeof PERIOD_CONFIG] ?? PERIOD_CONFIG['30d']
    const seed = hashString([
        geography.region || 'national',
        geography.province || 'all-provinces',
        geography.district || 'all-districts',
        geography.locality || 'all-localities',
        period,
    ].join('|'))
    const end = new Date('2026-03-31T00:00:00Z')
    const eventIndexes = new Set([
        Math.max(1, Math.floor(config.count * 0.2)),
        Math.max(2, Math.floor(config.count * 0.52)),
        Math.max(3, Math.floor(config.count * 0.82)),
    ])

    const points: TimelinePoint[] = Array.from({ length: config.count }, (_, index) => {
        const stepsBack = config.count - 1 - index
        const date = new Date(end)
        if (config.unit === 'month') {
            date.setUTCMonth(date.getUTCMonth() - stepsBack)
        } else {
            date.setUTCDate(date.getUTCDate() - stepsBack * (config.unit === 'week' ? 7 : 1))
        }

        const wave = Math.sin((index + (seed % 7)) * 0.72)
        const variation = hashString(`${seed}|${index}`) % 540
        const eventBoost = eventIndexes.has(index)
            ? 900 + (hashString(`${seed}|event|${index}`) % 1_300)
            : 0
        const volume = Math.round(720 + variation + wave * 210 + eventBoost)
        const negative = Math.min(72, Math.max(
            14,
            Math.round(25 + (variation % 13) + (eventBoost ? 12 : 0)),
        ))
        const positive = Math.min(64, Math.max(
            12,
            38 + Math.round(wave * 8) - (eventBoost ? 5 : 0),
        ))

        return {
            date: date.toISOString().slice(0, 10),
            label: formatLabel(date, config.unit),
            volume,
            sentiment: positive,
            netScore: positive - negative,
            negative,
            event: eventIndexes.has(index)
                ? EVENT_NAMES[(index + seed) % EVENT_NAMES.length]
                : undefined,
        }
    })

    return {
        points,
        intervalLabel: config.label,
        events: points.filter(point => point.event),
    }
}
