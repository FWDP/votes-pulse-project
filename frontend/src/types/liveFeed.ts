export type FeedSentiment =
    | "positive"
    | "neutral"
    | "negative";

export interface LiveFeedItem {
    id: string;
    location: string;
    category: string;
    text: string;
    sentiment: FeedSentiment;
    source: string;
    publishedAt: string;
    receivedAt?: string;
    url?: string;
    isNew?: boolean;
}