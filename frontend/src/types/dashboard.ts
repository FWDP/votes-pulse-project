import { LucideIcon } from "lucide-react";
import { KPIVariant } from "../components/dashboard/KPICard";

export interface SentimentItem {
    name: "Positive" | "Neutral" | "Negative";
    value: number;
}

export interface IssueItem {
    name: string;
    mentions: number;
}

export interface AreaItem {
    id: string;
    name: string;
    type: string;
    count: number;
    mentions: number;
    topTopics: string[];
    sentiment: {
        positive: number;
        neutral: number;
        negative: number;
    };
}

export interface SourceItem {
    id: string;
    name: string;
    type: string;
    mentions: number;
}

export type IssueTrend = string;

export interface QuickIssue {
    id: string;
    name: string;
    icon: LucideIcon;
    mentions: number;
    trend: IssueTrend;
}

export interface DashboardData {

    totalMentions: number;

    positiveSentiment: number;

    /**
     * Can be null if the Meltwater source mix/package
     * cannot provide a reliable unique-author count.
     */
    uniqueContributors: number | null;

    /**
   * Can be null if city-level location information
   * is unavailable for the analyzed sources.
   */
    activeLocations: number | null;

    sentiment: SentimentItem[];

    issues: IssueItem[];

    areas: AreaItem[];

    sources: SourceItem[];

    quickIssues: QuickIssue[];
}