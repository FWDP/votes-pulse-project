import {
    useMemo,
} from 'react'

import {
    Legend,
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
    Tooltip,
} from 'recharts'

import type {
    TopicSentiment,
} from '../../types/sentiment'

interface SentimentRadarProps {
    topics: TopicSentiment[]
}

export default function SentimentRadar({
    topics,
}: SentimentRadarProps) {
    const radarData =
        useMemo(() => {
            return [...topics]
                .sort(
                    (a, b) =>
                        b.mentions -
                        a.mentions,
                )
                .slice(0, 8)
                .map(topic => ({
                    topic:
                        topic.shortName,

                    positive:
                        topic.positive,

                    negative:
                        topic.negative,
                }))
        }, [topics])

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-2">
                <h2 className="text-sm font-bold text-slate-800">
                    Positive vs
                    Negative Radar
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                    Top 8 topics —
                    positive vs
                    negative percentage
                    comparison
                </p>
            </div>

            <div className="h-[340px]">
                <ResponsiveContainer
                    width="100%"
                    height="100%"
                >
                    <RadarChart
                        data={
                            radarData
                        }
                        outerRadius="72%"
                    >
                        <PolarGrid />

                        <PolarAngleAxis
                            dataKey="topic"
                            tick={{
                                fontSize: 11,
                            }}
                        />

                        <PolarRadiusAxis
                            domain={[
                                0,
                                100,
                            ]}
                            tick={{
                                fontSize: 10,
                            }}
                        />

                        <Tooltip />

                        <Legend />

                        <Radar
                            name="Positive"
                            dataKey="positive"
                            stroke="#22c55e"
                            fill="#22c55e"
                            fillOpacity={
                                0.15
                            }
                        />

                        <Radar
                            name="Negative"
                            dataKey="negative"
                            stroke="#ef4444"
                            fill="#ef4444"
                            fillOpacity={
                                0.15
                            }
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </section>
    )
}