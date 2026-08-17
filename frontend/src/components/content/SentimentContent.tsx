import {
    useMemo,
    useState,
} from 'react'

import SentimentFilter from '../sentiment/SentimentFilter'
import {
    SentimentSummary,
} from '../dashboard/SentimentSummary'
import SentimentByTopic from '../sentiment/SentimentByTopic'
import SentimentMeters from '../sentiment/SentimentMeters'
import SentimentRadar from '../sentiment/SentimentRadar'
import SentimentExtremes from '../sentiment/SentimentExtremes'

import {
    getUserSentimentData,
} from '../../hooks/userSentimentData'

import type {
    GeographySelection,
} from '../../types/geography'

export default function SentimentContent() {
    const [
        geography,
        setGeography,
    ] =
        useState<GeographySelection>({
            region: '',
            province: '',
            locality: '',
        })

    const [
        period,
        setPeriod,
    ] = useState('30d')

    const {
        sentiment,
        topics,
        isPlaceholder,
    } =
        useMemo(
            () =>
                getUserSentimentData(
                    geography,
                    period,
                ),
            [
                geography,
                period,
            ],
        )

    return (
        <div className="space-y-6">
            {/* Filters */}

            <SentimentFilter
                geography={
                    geography
                }
                onGeographyChange={
                    setGeography
                }
                period={
                    period
                }
                onPeriodChange={
                    setPeriod
                }
            />

            {/* Overall Sentiment */}

            <section>
                <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">
                            Overall
                            Sentiment
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Overall sentiment
                            across all topics
                            within the selected
                            geographic
                            coverage.
                        </p>
                    </div>

                    {isPlaceholder && (
                        <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Placeholder
                            data
                        </span>
                    )}
                </div>

                <SentimentSummary
                    sentiment={
                        sentiment
                    }
                />
            </section>

            {/* Sentiment by Topic */}

            <SentimentByTopic
                topics={topics}
            />

            {/* Sentiment Meters */}

            <SentimentMeters
                topics={topics}
            />

            {/* Radar + Extremes */}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <SentimentRadar
                    topics={topics}
                />

                <SentimentExtremes
                    topics={topics}
                />
            </div>
        </div>
    )
}