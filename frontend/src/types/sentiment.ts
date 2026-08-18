import { LucideIcon } from "lucide-react";

export interface SentimentData {
    positive: number;
    neutral: number;
    negative: number;
}

export interface TopicSentiment {
    id: string
    name: string
    shortName: string
    icon: LucideIcon

    mentions: number
    momentum: number[]

    positive: number
    neutral: number
    negative: number
}

export interface UserSentimentData {
    sentiment: SentimentData

    topics: TopicSentiment[]

    isPlaceholder: boolean
}

export interface LocationSentimentMetric {
    code: string
    aliases?: string[]
    mentions: number
    positive: number
    neutral: number
    negative: number
    topConcern?: string
}
