import {
    useMemo,
    useState,
} from 'react'

import type {
    TopicSentiment,
} from '../../types/sentiment'

interface IssueTermExplorerProps {
    topics: TopicSentiment[]
}

const TERMS_BY_TOPIC: Record<string, string[]> = {
    infrastructure: [
        'road', 'bridge', 'pothole', 'transportation', 'traffic',
        'highway', 'construction', 'drainage',
    ],
    agriculture: [
        'rice', 'harvest', 'farming', 'crop', 'farmer',
        'livelihood', 'fertilizer', 'irrigation',
    ],
    health: [
        'hospital', 'doctor', 'medicine', 'health center', 'barangay health',
        'dengue', 'PhilHealth', 'nurse', 'ambulance',
    ],
    education: [
        'school', 'teachers', 'DepEd', 'scholarship', 'classroom',
        'students', 'tuition', 'state university',
    ],
    flooding: [
        'flood', 'typhoon', 'landslide', 'evacuation', 'relief',
        'storm surge', 'disaster response', 'NDRRMC',
    ],
    'public-safety': [
        'police', 'crime', 'emergency', 'fire safety', 'rescue',
        'peace and order', 'security',
    ],
    tourism: [
        'tourism', 'beach', 'resort', 'travel', 'tourists',
        'accommodation', 'eco-tourism', 'heritage',
    ],
    environment: [
        'deforestation', 'illegal logging', 'coral reef', 'mangrove',
        'pollution', 'mining', 'watershed', 'protected area',
    ],
    'local-governance': [
        'mayor', 'governor', 'councilor', 'LGU', 'budget',
        'accountability', 'public service', 'transparency',
    ],
    'ip-rights': [
        'indigenous peoples', 'ancestral domain', 'NCIP', 'IPRA',
        'tribal community', 'cultural rights',
    ],
    power: [
        'electricity', 'power interruption', 'electric cooperative',
        'utility', 'internet', 'signal',
    ],
    fishing: [
        'fishing', 'fisherfolk', 'coastal access', 'marine protection',
        'fish catch', 'aquaculture',
    ],
}

const THEME_COLORS = [
    {
        dot: 'bg-red-500',
        chip: 'border-red-200 bg-red-50 text-red-700',
    },
    {
        dot: 'bg-orange-500',
        chip: 'border-orange-200 bg-orange-50 text-orange-700',
    },
    {
        dot: 'bg-amber-500',
        chip: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    {
        dot: 'bg-green-500',
        chip: 'border-green-200 bg-green-50 text-green-700',
    },
    {
        dot: 'bg-cyan-500',
        chip: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    },
    {
        dot: 'bg-violet-500',
        chip: 'border-violet-200 bg-violet-50 text-violet-700',
    },
    {
        dot: 'bg-blue-500',
        chip: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    {
        dot: 'bg-pink-500',
        chip: 'border-pink-200 bg-pink-50 text-pink-700',
    },
    {
        dot: 'bg-lime-500',
        chip: 'border-lime-200 bg-lime-50 text-lime-700',
    },
]

export default function IssueTermExplorer({
    topics,
}: IssueTermExplorerProps) {
    const [selectedTopic, setSelectedTopic] = useState('all')

    const rankedTopics = useMemo(
        () => [...topics].sort((a, b) => b.mentions - a.mentions),
        [topics],
    )
    const visibleTopics = selectedTopic === 'all'
        ? rankedTopics
        : rankedTopics.filter(topic => topic.id === selectedTopic)
    const topicVolumes = rankedTopics.map(topic => topic.mentions)
    const minimumVolume = topicVolumes.length > 0
        ? Math.min(...topicVolumes)
        : 0
    const maximumVolume = topicVolumes.length > 0
        ? Math.max(...topicVolumes)
        : 0
    const volumeRange = Math.max(maximumVolume - minimumVolume, 1)
    const visibleTerms = visibleTopics.flatMap((topic, topicIndex) =>
        (TERMS_BY_TOPIC[topic.id] ?? []).map(term => {
            const volumeWeight =
                (topic.mentions - minimumVolume) / volumeRange

            return {
                id: `${topic.id}-${term}`,
                term,
                topic: topic.name,
                mentions: topic.mentions,
                sizeClass: volumeWeight >= 0.66
                    ? 'px-4 py-2 text-base font-semibold'
                    : volumeWeight >= 0.33
                        ? 'px-3.5 py-1.5 text-sm font-medium'
                        : 'px-3 py-1 text-xs font-medium',
                color: THEME_COLORS[
                    (rankedTopics.findIndex(item => item.id === topic.id) >= 0
                        ? rankedTopics.findIndex(item => item.id === topic.id)
                        : topicIndex) % THEME_COLORS.length
                ],
            }
        }),
    )

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">
                            Top Keywords &amp; Terms
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Size and quantity reflect each term&apos;s parent topic volume for the current coverage.
                        </p>
                    </div>

                    <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        Topic-weighted terms
                    </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter terms by issue theme">
                    <button
                        type="button"
                        onClick={() => setSelectedTopic('all')}
                        aria-pressed={selectedTopic === 'all'}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                            selectedTopic === 'all'
                                ? 'border-slate-800 bg-slate-800 text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                        }`}
                    >
                        All
                    </button>

                    {rankedTopics.map(topic => {
                        const TopicIcon = topic.icon

                        return (
                            <button
                                key={topic.id}
                                type="button"
                                onClick={() => setSelectedTopic(topic.id)}
                                aria-pressed={selectedTopic === topic.id}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                                    selectedTopic === topic.id
                                        ? 'border-blue-300 bg-blue-100 text-slate-900'
                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300'
                                }`}
                            >
                                <TopicIcon
                                    size={13}
                                    className="shrink-0 text-slate-800"
                                    aria-hidden="true"
                                />
                                {topic.shortName}
                            </button>
                        )
                    })}
                </div>

                <div className="mt-4 flex flex-wrap gap-2" aria-live="polite">
                    {visibleTerms.map(item => (
                        <span
                            key={item.id}
                            title={`${item.topic}: ${item.mentions.toLocaleString()} topic mentions`}
                            className={`rounded-full border ${item.sizeClass} ${item.color.chip}`}
                        >
                            {item.term}
                            <span className="ml-1.5 font-normal opacity-65">
                                {item.mentions.toLocaleString()}
                            </span>
                        </span>
                    ))}
                </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                    <h2 className="text-sm font-bold text-slate-800">
                        Theme Clusters
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Configured monitoring terms grouped by discussion theme.
                    </p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {rankedTopics.map((topic, index) => {
                        const color = THEME_COLORS[index % THEME_COLORS.length]
                        const isSelected = selectedTopic === topic.id
                        const TopicIcon = topic.icon

                        return (
                            <button
                                key={topic.id}
                                type="button"
                                onClick={() => setSelectedTopic(
                                    isSelected ? 'all' : topic.id,
                                )}
                                aria-pressed={isSelected}
                                className={`rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                                    isSelected
                                        ? 'border-blue-400 bg-blue-50/40 shadow-sm'
                                        : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${color.chip}`}>
                                        <TopicIcon
                                            size={16}
                                            className="text-slate-800"
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <h3 className="text-sm font-bold text-slate-800">
                                        {topic.name}
                                    </h3>
                                    <span className="ml-auto text-xs font-semibold tabular-nums text-slate-400">
                                        {topic.mentions.toLocaleString()} mentions
                                    </span>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {(TERMS_BY_TOPIC[topic.id] ?? []).map(term => (
                                        <span
                                            key={term}
                                            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
                                        >
                                            {term}
                                        </span>
                                    ))}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}
