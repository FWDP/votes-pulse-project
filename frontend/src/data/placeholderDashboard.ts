import { Building2, Clock4, Code, Cross, Database, MapPin, Sprout } from "lucide-react";
import type { DashboardData, IssueItem, SourceItem, QuickIssue, AreaItem, SentimentItem } from "../types/dashboard";
import type { KPICardProps } from "../components/dashboard/KPICard";

export type PlaceholderScope = {
  region?: string;
  province?: string;
  district?: string;
  locality?: string;
};

const REGION_LABELS: Record<string, string> = {
  "1300000000": "National Capital Region",
  "0400000000": "CALABARZON",
  "0300000000": "Central Luzon",
};

const PROVINCE_LABELS: Record<string, string> = {
  "0402100000": "Cavite Province",
  "0301400000": "Bulacan Province",
};

const LOCALITY_LABELS: Record<string, string> = {
  "1380900000": "Navotas",
  "0431200000": "Lucena City",
  "0301411000": "Marilao",
};

const getPlaceholderScopeLabel = (scope?: PlaceholderScope) => {
  if (scope?.locality && LOCALITY_LABELS[scope.locality]) return LOCALITY_LABELS[scope.locality];
  if (scope?.province && PROVINCE_LABELS[scope.province]) return PROVINCE_LABELS[scope.province];
  if (scope?.region && REGION_LABELS[scope.region]) return REGION_LABELS[scope.region];
  return "National coverage";
};

const getPlaceholderType = (scope?: PlaceholderScope) => {
  if (scope?.locality) return "Municipality / City";
  if (scope?.province) return "Province";
  if (scope?.region) return "Region";
  return "National";
};

export const createPlaceholderDashboard = (scope?: PlaceholderScope): DashboardData => {
  const scopeLabel = getPlaceholderScopeLabel(scope);
  const areaType = getPlaceholderType(scope);

  const totalMentions = scope?.locality ? 12840 : scope?.province ? 38260 : scope?.region ? 94120 : 204300;
  const positiveSentiment = scope?.locality ? 68 : scope?.province ? 64 : scope?.region ? 61 : 58;
  const neutralSentiment = scope?.locality ? 21 : scope?.province ? 23 : scope?.region ? 25 : 26;
  const negativeSentiment = 100 - positiveSentiment - neutralSentiment;

  const sentiment: SentimentItem[] = [
    { name: "Positive", value: positiveSentiment },
    { name: "Neutral", value: neutralSentiment },
    { name: "Negative", value: negativeSentiment },
  ];

  const issues: IssueItem[] = [
    { name: "Traffic management", mentions: Math.round(totalMentions * 0.26) },
    { name: "Flood control", mentions: Math.round(totalMentions * 0.17) },
    { name: "Public safety", mentions: Math.round(totalMentions * 0.14) },
    { name: "Waste management", mentions: Math.round(totalMentions * 0.11) },
    { name: "Local livelihood support", mentions: Math.round(totalMentions * 0.09) },
  ];

  const areaSet: AreaItem[] = [
    {
      id: "assigned-area",
      name: scopeLabel,
      type: areaType,
      count: 1,
      mentions: totalMentions,
      topTopics: ["Traffic management", "Flood control", "Public safety"],
      sentiment: {
        positive: positiveSentiment,
        neutral: neutralSentiment,
        negative: negativeSentiment,
      },
    },
    {
      id: "peer-area-1",
      name: scope?.locality ? "Adjacent localities" : scope?.province ? "Comparable provinces" : scope?.region ? "Peer regions" : "Peer national areas",
      type: "Benchmark",
      count: 4,
      mentions: Math.round(totalMentions * 0.82),
      topTopics: ["Public safety", "Service delivery", "Local mobility"],
      sentiment: {
        positive: Math.max(50, positiveSentiment - 4),
        neutral: Math.max(20, neutralSentiment + 1),
        negative: Math.max(10, negativeSentiment + 1),
      },
    },
  ];

  const sources: SourceItem[] = [
    { id: "source-facebook", name: "Facebook", type: "Social", mentions: Math.round(totalMentions * 0.36) },
    { id: "source-x", name: "X / Twitter", type: "Social", mentions: Math.round(totalMentions * 0.22) },
    { id: "source-news", name: "News websites", type: "Media", mentions: Math.round(totalMentions * 0.18) },
    { id: "source-radio", name: "Radio", type: "Broadcast", mentions: Math.round(totalMentions * 0.13) },
    { id: "source-forums", name: "Community forums", type: "Public feedback", mentions: Math.round(totalMentions * 0.11) },
  ];

  const quickIssues: QuickIssue[] = [
    { id: "quick-traffic", name: "Traffic management", icon: MapPin, mentions: Math.round(totalMentions * 0.26), trend: "+8%" },
    { id: "quick-flood", name: "Flood control", icon: Building2, mentions: Math.round(totalMentions * 0.17), trend: "+4%" },
    { id: "quick-safety", name: "Public safety", icon: Cross, mentions: Math.round(totalMentions * 0.14), trend: "+6%" },
    { id: "quick-waste", name: "Waste management", icon: Sprout, mentions: Math.round(totalMentions * 0.11), trend: "+2%" },
  ];

  return {
    totalMentions,
    positiveSentiment,
    uniqueContributors: Math.round(totalMentions * 0.41),
    activeLocations: scope?.locality ? 6 : scope?.province ? 14 : scope?.region ? 28 : 56,
    sentiment,
    issues,
    areas: areaSet,
    sources,
    quickIssues,
  };
};

export const placeholderDashboard: DashboardData = createPlaceholderDashboard();

export const kpiMetrics: KPICardProps[] = [
  {
    slug: "dataPoints",
    icon: Database,
    value: 12000,
    label: "Data Points",
    subtitle: "Total mentions tracked",
    variant: "blue",
  },
  {
    slug: "lguCovered",
    icon: MapPin,
    value: 15,
    label: "LGUs Covered",
    subtitle: "All across municipalities and cities",
    variant: "green",
  },
  {
    slug: "coveragePeriod",
    icon: Clock4,
    value: `47 mos`,
    label: "Coverage Period",
    subtitle: "From 2023 - Present",
    variant: "amber",
  },
  {
    slug: "dataSources",
    icon: Code,
    value: 5,
    label: "Data Sources",
    subtitle: "public media and social channels",
    variant: "purple",
  },
]