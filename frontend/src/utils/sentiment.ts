export type DominantSentimentKey = 'positive' | 'neutral' | 'negative'

export const getDominantSentiment = (sentiment: {
    positive: number
    neutral: number
    negative: number
}) => ([
    { key: 'positive' as const, label: 'Positive', value: sentiment.positive },
    { key: 'neutral' as const, label: 'Neutral', value: sentiment.neutral },
    { key: 'negative' as const, label: 'Negative', value: sentiment.negative },
].sort((a, b) => b.value - a.value)[0])
