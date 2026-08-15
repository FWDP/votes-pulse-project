import { Building2, Clock4, Code, Cross, Database, MapPin, Sprout } from "lucide-react";
import type { DashboardData } from "../types/dashboard";

export const placeholderDashboard: DashboardData = {
  totalMentions: 12116,
  positiveSentiment: 26,
  uniqueContributors: 8231,
  activeLocations: 15,

  sentiment: [
    {
      name: "Positive",
      value: 26,
    },
    {
      name: "Neutral",
      value: 46,
    },
    {
      name: "Negative",
      value: 28,
    },
  ],

  issues: [
    {
      name: "Infrastructure & Roads",
      mentions: 3250,
    },
    {
      name: "Agriculture & Livelihood",
      mentions: 2890,
    },
    {
      name: "Health Services",
      mentions: 2120,
    },
    {
      name: "Education",
      mentions: 2000,
    },
    {
      name: "Flooding & Disaster Risk",
      mentions: 1760,
    },
    {
      name: "Public Safety",
      mentions: 1430,
    },
  ],

  areas: [
    {
      id: "north",
      name: "Northern Area",
      type: "municipality",
      count: 4,
      topTopics: [
        "Tourism & Infrastructure"
      ],
      mentions: 5414,
      sentiment: {
        positive: 32,
        neutral: 43,
        negative: 25,
      },
    },
    {
      id: "central",
      name: "Central Area",
      type: "municipality",
      count: 4,
      topTopics: [
        "Flooding & Health Services"
      ],
      mentions: 1972,
      sentiment: {
        positive: 22,
        neutral: 47,
        negative: 31,
      },
    },
    {
      id: "south",
      name: "Southern Area",
      type: "municipality",
      count: 7,
      topTopics: [
        "Agriculture & Roads"
      ],
      mentions: 4587,
      sentiment: {
        positive: 18,
        neutral: 42,
        negative: 40,
      },
    },
  ],

  sources: [
    {
      id: "facebook",
      name: "Facebook",
      type: "social",
      mentions: 6642,
    },
    {
      id: "news",
      name: "Regional & National News",
      mentions: 2460,
      type: "social"
    },
    {
      id: "twitter",
      name: "X / Twitter",
      mentions: 1575,
      type: "social"
    },
    {
      id: "forums",
      name: "Online Forums & Discussions",
      mentions: 969,
      type: "social"
    },
    {
      id: "public-records",
      name: "COMELEC / Public Records",
      mentions: 470,
      type: "blog"
    },
  ],

  quickIssues: [
    {
      id: "infrastructure",
      name: "Infrastructure & Roads",
      icon: Building2,
      mentions: 3250,
      trend: "up",
    },
    {
      id: "agriculture",
      name: "Agriculture & Livelihood",
      icon: Sprout,
      mentions: 2890,
      trend: "stable",
    },
    {
      id: "health",
      name: "Health Services",
      icon: Cross,
      mentions: 2120,
      trend: "up",
    },
  ],

  kpiMetrics: [
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
};