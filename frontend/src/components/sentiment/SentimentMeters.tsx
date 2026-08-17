import {
    useMemo,
} from 'react'

import type {
    TopicSentiment,
} from '../../types/sentiment'

interface SentimentMetersProps {
    topics: TopicSentiment[]
}

export default function SentimentMeters({
    topics,
}: SentimentMetersProps) {
    const sortedTopics =
        useMemo(() => {
            return [...topics].sort(
                (a, b) =>
                    b.negative -
                    a.negative,
            )
        }, [topics])

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-5">
                <h2 className="text-sm font-bold text-slate-800">
                    Sentiment Meters —
                    All Topics
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                    Sorted by:
                    negative
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {sortedTopics.map(
                    topic => (
                        <article
                            key={
                                topic.id
                            }
                            className="rounded-lg border border-slate-200 p-3"
                        >
                            {/* Topic */}

                            <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <div className="flex items-center">
                                        <topic.icon
                                            className="h-4 w-4 shrink-0 text-slate-400"
                                        />
                                    </div>

                                    <span className="truncate text-sm font-medium text-slate-700">
                                        {
                                            topic.name
                                        }
                                    </span>
                                </div>

                                <span className="shrink-0 text-xs text-slate-400">
                                    {topic.mentions.toLocaleString()}{' '}
                                    mentions
                                </span>
                            </div>

                            {/* Percentages */}

                            <div className="mt-3 flex justify-end gap-3 text-xs">
                                <span className="text-green-600">
                                    {
                                        topic.positive
                                    }
                                    %
                                </span>

                                <span className="text-slate-500">
                                    {
                                        topic.neutral
                                    }
                                    %
                                </span>

                                <span className="text-red-500">
                                    {
                                        topic.negative
                                    }
                                    %
                                </span>
                            </div>

                            {/* Meter */}

                            <div className="mt-1 flex h-3 overflow-hidden rounded-full">
                                <div
                                    className="bg-green-500"
                                    style={{
                                        width: `${topic.positive}%`,
                                    }}
                                />

                                <div
                                    className="bg-slate-400"
                                    style={{
                                        width: `${topic.neutral}%`,
                                    }}
                                />

                                <div
                                    className="bg-red-500"
                                    style={{
                                        width: `${topic.negative}%`,
                                    }}
                                />
                            </div>
                        </article>
                    ),
                )}
            </div>
        </section>
    )
}