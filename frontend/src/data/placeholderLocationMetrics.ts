import type { GeographyUnit } from '../types/geography'
import type { LocationSentimentMetric } from '../types/sentiment'

const CONCERNS = [
    'Infrastructure & Roads',
    'Agriculture & Livelihood',
    'Health Services',
    'Education',
    'Flooding & Disaster Risk',
    'Public Safety',
    'Tourism Development',
    'Environmental Issues',
]

const PERIOD_MULTIPLIER: Record<string, number> = {
    '7d': 0.3,
    '30d': 1,
    '90d': 2.7,
    '1y': 8.8,
}

const hashString = (value: string) => {
    let hash = 0

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(index)
        hash |= 0
    }

    return Math.abs(hash)
}

export const getPlaceholderLocationMetrics = (
    units: GeographyUnit[],
    period: string,
): LocationSentimentMetric[] => units.map(unit => {
    const unitSeed = hashString(unit.code)
    const periodSeed = hashString(`${unit.code}|${period}`)
    const positive = 16 + (periodSeed % 24)
    const negative = 20 + (Math.floor(periodSeed / 17) % 29)
    const neutral = 100 - positive - negative
    const baseMentions = 180 + (unitSeed % 2_850)

    return {
        code: unit.code,
        aliases: unit.correspondence_code
            ? [unit.correspondence_code]
            : undefined,
        mentions: Math.max(
            1,
            Math.round(baseMentions * (PERIOD_MULTIPLIER[period] ?? 1)),
        ),
        positive,
        neutral,
        negative,
        topConcern: CONCERNS[Math.floor(periodSeed / 29) % CONCERNS.length],
    }
})
