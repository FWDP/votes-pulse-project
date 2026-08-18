import type { GeographySelection,} from '../types/geography'

import type { SentimentData, TopicSentiment, UserSentimentData } from '../types/sentiment'

import { Building2, GraduationCap, Hospital, Pyramid, Siren, Sprout, Waves, Trees, Landmark, Users, UtilityPole, Fish } from 'lucide-react'

import { getPlaceholderSentiment, } from '../data/placeholderSentiment'

/**
 * Overall placeholder sentiment.
 *
 * Matches the cards we already designed:
 *
 * Positive: 26%
 * Neutral: 46%
 * Negative: 28%
 */
const BASE_OVERALL_SENTIMENT: SentimentData = {
    positive: 26,
    neutral: 46,
    negative: 28,
}

const BASE_TOPIC_SENTIMENT = [
    {
        id: 'infrastructure',
        name: 'Infrastructure & Roads',
        shortName: 'Infrastructure',
        icon: Building2,
        mentions: 3241,
        positive: 14,
        neutral: 26,
        negative: 60,
    },
    {
        id: 'agriculture',
        name: 'Agriculture & Livelihood',
        shortName: 'Agriculture',
        icon: Sprout,
        mentions: 2876,
        positive: 22,
        neutral: 38,
        negative: 40,
    },
    {
        id: 'health',
        name: 'Health Services',
        shortName: 'Health',
        icon: Hospital,
        mentions: 2500,
        positive: 18,
        neutral: 32,
        negative: 50,
    },
    {
        id: 'education',
        name: 'Education',
        shortName: 'Education',
        icon: GraduationCap,
        mentions: 2100,
        positive: 20,
        neutral: 30,
        negative: 50,
    },
    {
        id: 'flooding',
        name: 'Flooding & Disaster Risk',
        shortName: 'Flooding',
        icon: Waves,
        mentions: 1800,
        positive: 15,
        neutral: 25,
        negative: 60,
    },
    {
        id: 'public-safety',
        name: 'Public Safety',
        shortName: 'Public',
        icon: Siren,
        mentions: 1500,
        positive: 12,
        neutral: 28,
        negative: 60,
    },
    {
        id: 'tourism',
        name: 'Tourism Development',
        shortName: 'Tourism',
        icon: Pyramid,
        mentions: 1200,
        positive: 25,
        neutral: 35,
        negative: 40,
    },
    {
        id: 'environment',
        name: 'Environmental Issues',
        shortName: 'Environmental',
        icon: Trees,
        mentions: 1000,
        positive: 20,
        neutral: 30,
        negative: 50,
    },
    {
        id: 'local-governance',
        name: 'Local Governance',
        shortName: 'Governance',
        icon: Landmark,
        mentions: 800,
        positive: 15,
        neutral: 25,
        negative: 60,
    },
    {
        id: 'ip-rights',
        name: 'Mangyan / IP Rights',
        shortName: 'IP Rights',
        icon: Users,
        mentions: 600,
        positive: 25,
        neutral: 35,
        negative: 40,
    },
    {
        id: 'power',
        name: 'Power & Utilities',
        shortName: 'Power',
        icon: UtilityPole,
        mentions: 500,
        positive: 20,
        neutral: 30,
        negative: 50,
    },
    {
        id: 'fishing',
        name: 'Fishing & Coastal Access',
        shortName: 'Fishing',
        icon: Fish,
        mentions: 400,
        positive: 25,
        neutral: 35,
        negative: 40,
    },
]

const hashString = (
    value: string,
): number => {
    let hash = 0

    for (
        let index = 0;
        index < value.length;
        index++
    ) {
        hash =
            (hash << 5) -
            hash +
            value.charCodeAt(index)

        hash |= 0
    }

    return Math.abs(hash)
}

/**
 * Keeps a percentage inside a safe range.
 */
const clamp = (
    value: number,
    min: number,
    max: number,
) => {
    return Math.min(
        Math.max(value, min),
        max,
    )
}

/**
 * Period changes the placeholder mention count.
 *
 * Sentiment percentages remain reasonably stable,
 * while mentions change more noticeably.
 */
const getPeriodMultiplier = (
    period: string,
) => {
    switch (period) {
        case '7d':
            return 0.32

        case '90d':
            return 2.65

        case '1y':
            return 8.5

        case '30d':
        default:
            return 1
    }
}

const createPlaceholderMomentum = (
    seed: number,
    mentions: number,
) => {
    const direction =
        (Math.floor(seed / 31) % 15) - 7
    const baseline = Math.max(mentions / 8, 1)

    return Array.from(
        { length: 8 },
        (_, index) => {
            const movement =
                (direction / 100) * baseline * index
            const variation =
                (((seed >> (index % 8)) % 9) - 4) *
                baseline * 0.025

            return Math.max(
                0,
                Math.round(baseline + movement + variation),
            )
        },
    )
}

/**
 * National + 30d uses the exact mockup values.
 *
 * For other coverage selections, we make small,
 * deterministic placeholder adjustments.
 */
const createPlaceholderTopics = (
    geography: GeographySelection,
    period: string,
): TopicSentiment[] => {
    const isNational =
        !geography.region &&
        !geography.province &&
        !geography.district &&
        !geography.locality

    const periodMultiplier =
        getPeriodMultiplier(period)

    return BASE_TOPIC_SENTIMENT.map(
        topic => {
            const seed = hashString(
                [
                    geography.region ||
                        'national',

                    geography.province ||
                        'all-provinces',

                    geography.district ||
                        'all-districts',

                    geography.locality ||
                        'all-localities',

                    period,

                    topic.id,
                ].join('|'),
            )

            /**
             * Keep the exact screenshot values
             * for National + Last 30 days.
             */
            if (
                isNational &&
                period === '30d'
            ) {
                return {
                    ...topic,
                    momentum: createPlaceholderMomentum(
                        seed,
                        topic.mentions,
                    ),
                }
            }

            /**
             * Small percentage adjustments.
             *
             * Range: roughly -6 to +6.
             */
            const positiveAdjustment =
                (seed % 13) - 6

            const neutralAdjustment =
                (Math.floor(
                    seed / 17,
                ) %
                    11) -
                5

            let positive = clamp(
                topic.positive +
                    positiveAdjustment,
                5,
                80,
            )

            let neutral = clamp(
                topic.neutral +
                    neutralAdjustment,
                10,
                70,
            )

            /**
             * Make sure positive + neutral
             * doesn't leave negative below 5%.
             */
            if (
                positive + neutral >
                95
            ) {
                neutral =
                    95 -
                    positive
            }

            let negative =
                100 -
                positive -
                neutral

            /**
             * Additional safety.
             */
            if (negative < 5) {
                negative = 5

                neutral =
                    100 -
                    positive -
                    negative
            }

            /**
             * Geography-specific mention variation.
             */
            const geographyMultiplier =
                isNational
                    ? 1
                    : 0.45 +
                      ((seed % 50) /
                          100)

            const mentions =
                Math.max(
                    25,
                    Math.round(
                        topic.mentions *
                            periodMultiplier *
                            geographyMultiplier,
                    ),
                )

            return {
                ...topic,

                mentions,

                momentum: createPlaceholderMomentum(
                    seed,
                    mentions,
                ),

                positive,

                neutral,

                negative,
            }
        },
    )
}

/**
 * Creates placeholder overall sentiment.
 *
 * National + 30d remains exactly:
 *
 * 26 / 46 / 28
 *
 * Other locations get deterministic variation.
 */
const createOverallSentiment = (
    geography: GeographySelection,
    period: string,
): SentimentData => {
    const isNational =
        !geography.region &&
        !geography.province &&
        !geography.district &&
        !geography.locality

    if (
        isNational &&
        period === '30d'
    ) {
        return BASE_OVERALL_SENTIMENT
    }

    const seed = hashString(
        [
            geography.region ||
                'national',

            geography.province ||
                'all-provinces',

            geography.district ||
                'all-districts',

            geography.locality ||
                'all-localities',

            period,

            'overall',
        ].join('|'),
    )

    const positiveAdjustment =
        (seed % 11) - 5

    const negativeAdjustment =
        (Math.floor(
            seed / 13,
        ) %
            11) -
        5

    const positive = clamp(
        BASE_OVERALL_SENTIMENT.positive +
            positiveAdjustment,
        15,
        45,
    )

    const negative = clamp(
        BASE_OVERALL_SENTIMENT.negative +
            negativeAdjustment,
        15,
        45,
    )

    const neutral =
        100 -
        positive -
        negative

    return {
        positive,
        neutral,
        negative,
    }
}

/**
 * Main sentiment data provider.
 *
 * Currently:
 *
 * Geography + Date Range
 *          ↓
 * Placeholder Data
 *
 *
 * Later:
 *
 * Geography + Date Range
 *          ↓
 * Backend API
 *          ↓
 * Meltwater
 *          ↓
 * Real Sentiment Data
 */
export function getUserSentimentData(
    geography: GeographySelection,
    period: string,
): UserSentimentData {
    const sentiment =
        createOverallSentiment(
            geography,
            period,
        )

    const topics =
        createPlaceholderTopics(
            geography,
            period,
        )

    return {
        sentiment,
        topics,
        isPlaceholder: true,
    }
}
