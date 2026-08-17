import {
    useMemo,
} from 'react'

import type {
    TopicSentiment,
} from '../../types/sentiment'

interface SentimentExtremesProps {
    topics: TopicSentiment[]
}

export default function SentimentExtremes({
    topics,
}: SentimentExtremesProps) {
    const mostPositive =
        useMemo(
            () =>
                [...topics]
                    .sort(
                        (a, b) =>
                            b.positive -
                            a.positive,
                    )
                    .slice(0, 4),
            [topics],
        )

    const mostNegative =
        useMemo(
            () =>
                [...topics]
                    .sort(
                        (a, b) =>
                            b.negative -
                            a.negative,
                    )
                    .slice(0, 4),
            [topics],
        )

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-bold text-slate-800">
                Sentiment Extremes
            </h2>

            {/* Positive */}

            <div className="mt-5">
                <h3 className="text-xs font-bold text-green-700">
                    Most Positive
                    Topics
                </h3>

                <div className="mt-2 divide-y divide-slate-100">
                    {mostPositive.map(
                        (
                            topic,
                            index,
                        ) => (
                            <div
                                key={
                                    topic.id
                                }
                                className="flex items-center gap-3 py-2"
                            >
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                                    {index +
                                        1}
                                </span>

                                <span>
                                    {
                                        <topic.icon className="h-5 w-5 text-slate-400" />
                                    }
                                </span>

                                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                                    {
                                        topic.name
                                    }
                                </span>

                                <span className="text-sm font-bold text-green-600">
                                    {
                                        topic.positive
                                    }
                                    %
                                </span>
                            </div>
                        ),
                    )}
                </div>
            </div>

            {/* Negative */}

            <div className="mt-5">
                <h3 className="text-xs font-bold text-red-700">
                    Most Negative
                    Topics
                </h3>

                <div className="mt-2 divide-y divide-slate-100">
                    {mostNegative.map(
                        (
                            topic,
                            index,
                        ) => (
                            <div
                                key={
                                    topic.id
                                }
                                className="flex items-center gap-3 py-2"
                            >
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                                    {index +
                                        1}
                                </span>

                                <span>
                                    {
                                        <topic.icon className="h-5 w-5 text-slate-400" />
                                    }
                                </span>

                                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                                    {
                                        topic.name
                                    }
                                </span>

                                <span className="text-sm font-bold text-red-500">
                                    {
                                        topic.negative
                                    }
                                    %
                                </span>
                            </div>
                        ),
                    )}
                </div>
            </div>
        </section>
    )
}