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

    positive: number
    neutral: number
    negative: number
}

export interface UserSentimentData {
    sentiment: SentimentData

    topics: TopicSentiment[]

    isPlaceholder: boolean
}