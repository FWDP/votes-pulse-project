import type {
    SentimentData,
} from '../../types/sentiment'

interface SentimentSummaryProps {
    sentiment: SentimentData
    loading?: boolean
}

export function SentimentSummary({
    sentiment,
    loading = false,
}: SentimentSummaryProps) {
    const sentimentCards = [
        {
            key: 'positive',
            value: sentiment.positive,
            label: 'Positive Sentiment',
            description:
                'Content with favorable or appreciative framing',
            containerClass:
                'border-green-200 bg-green-50',
            valueClass:
                'text-green-600',
        },
        {
            key: 'neutral',
            value: sentiment.neutral,
            label: 'Neutral Sentiment',
            description:
                'Informational, balanced, or ambiguous posts',
            containerClass:
                'border-slate-200 bg-slate-50',
            valueClass:
                'text-slate-600',
        },
        {
            key: 'negative',
            value: sentiment.negative,
            label: 'Negative Sentiment',
            description:
                'Content expressing concern, criticism, or frustration',
            containerClass:
                'border-red-200 bg-red-50',
            valueClass:
                'text-red-600',
        },
    ]

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {sentimentCards.map(item => (
                <div
                    key={item.key}
                    className={`
                        rounded-xl
                        border
                        p-5
                        transition
                        ${item.containerClass}
                    `}
                >
                    <div
                        className={`
                            text-4xl
                            font-black
                            ${item.valueClass}
                        `}
                    >
                        {loading
                            ? '—'
                            : `${item.value}%`
                        }
                    </div>

                    <div className="mt-2 text-sm font-bold text-slate-800">
                        {item.label}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                        {item.description}
                    </div>
                </div>
            ))}
        </div>
    )
}