import {
    useMemo,
    useState,
} from 'react'

import type {
    TopicSentiment,
} from '../../types/sentiment'

type SortType =
    | 'mentions'
    | 'positive'
    | 'negative'

interface SentimentByTopicProps {
    topics: TopicSentiment[]
}

export default function SentimentByTopic({
    topics,
}: SentimentByTopicProps) {
    const [
        sortBy,
        setSortBy,
    ] =
        useState<SortType>(
            'negative',
        )

    const sortedTopics =
        useMemo(() => {
            return [...topics].sort(
                (a, b) =>
                    b[sortBy] -
                    a[sortBy],
            )
        }, [
            topics,
            sortBy,
        ])

    const sortOptions: {
        value: SortType
        label: string
    }[] = [
        {
            value: 'mentions',
            label: 'Mentions',
        },
        {
            value: 'positive',
            label: 'Positive',
        },
        {
            value: 'negative',
            label: 'Negative',
        },
    ]

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            {/* Header */}

            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-sm font-bold text-slate-800">
                        Sentiment by Topic
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-500">
                        Breakdown of
                        positive / neutral /
                        negative per issue
                        area
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                        Sort by:
                    </span>

                    {sortOptions.map(
                        option => (
                            <button
                                key={
                                    option.value
                                }
                                type="button"
                                onClick={() =>
                                    setSortBy(
                                        option.value,
                                    )
                                }
                                className={`
                                    rounded-md
                                    px-2.5
                                    py-1.5
                                    text-xs
                                    font-medium
                                    transition
                                    ${
                                        sortBy ===
                                        option.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }
                                `}
                            >
                                {
                                    option.label
                                }
                            </button>
                        ),
                    )}
                </div>
            </div>

            {/* Chart */}

            <div className="space-y-2">
                {sortedTopics.map(
                    topic => (
                        <div
                            key={
                                topic.id
                            }
                            className="grid grid-cols-[145px_1fr] items-center gap-2"
                        >
                            <div className="truncate text-right text-[11px] text-slate-500">
                                {
                                    topic.name
                                }
                            </div>

                            <div className="flex h-5 overflow-hidden rounded">
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
                        </div>
                    ),
                )}
            </div>

            {/* Axis */}

            <div className="ml-[153px] mt-2 flex justify-between text-[10px] text-slate-400">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
            </div>

            {/* Legend */}

            <div className="mt-4 flex justify-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Positive
                </span>

                <span className="flex items-center gap-1 text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    Neutral
                </span>

                <span className="flex items-center gap-1 text-red-500">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Negative
                </span>
            </div>
        </section>
    )
}