import {
  Building2,
  Cross,
  GraduationCap,
  HardHat,
  LucideIcon,
  Pyramid,
  Sprout,
  Trees,
  Waves,
} from "lucide-react";

export interface AreaConfig {
  id: string;
  name: string;
  type: string;
  count: number;
  searchId?: string;
}

export interface IssueConfig {
  id: string;
  name: string;
  iconKey: LucideIcon;
  searchId?: string;
}

export const dashboardConfig = {
  timezone:
    process.env
      .MELTWATER_TIMEZONE ??
    "Asia/Manila",
  mainSearchId:
    process.env
      .MELTWATER_SEARCH_MAIN,

  areas: [
    {
      id: "north",
      name: "Northern Area",
      type: "municipality",
      count: 4,
      searchId:
        process.env
          .MELTWATER_SEARCH_NORTH,
    },

    {
      id: "central",
      name: "Central Area",
      type: "municipality",
      count: 4,
      searchId:
        process.env
          .MELTWATER_SEARCH_CENTRAL,
    },

    {
      id: "south",
      name: "Southern Area",
      type: "municipality",
      count: 7,
      searchId:
        process.env
          .MELTWATER_SEARCH_SOUTH,
    },
  ] satisfies AreaConfig[],

  issues: [
    {
      id: "infrastructure",
      name:
        "Infrastructure & Roads",
      iconKey: Building2,
      searchId:
        process.env
          .MELTWATER_SEARCH_ISSUE_INFRASTRUCTURE,
    },

    {
      id: "agriculture",
      name:
        "Agriculture & Livelihood",
      iconKey: Sprout,
      searchId:
        process.env
          .MELTWATER_SEARCH_ISSUE_AGRICULTURE,
    },

    {
      id: "health",
      name: "Health Services",
      iconKey: Cross,
      searchId:
        process.env
          .MELTWATER_SEARCH_ISSUE_HEALTH,
    },

    {
      id: "education",
      name: "Education",
      iconKey: GraduationCap,
      searchId:
        process.env
          .MELTWATER_SEARCH_ISSUE_EDUCATION,
    },

    {
      id: "flooding",
      name:
        "Flooding & Disaster Risk",
      iconKey: Waves,
      searchId:
        process.env
          .MELTWATER_SEARCH_ISSUE_FLOODING,
    },

    {
      id: "safety",
      name: "Public Safety",
      iconKey: HardHat,
      searchId:
        process.env
          .MELTWATER_SEARCH_ISSUE_SAFETY,
    },

    {
      id: "tourism",
      name:
        "Tourism Development",
      iconKey: Pyramid,
      searchId:
        process.env
          .MELTWATER_SEARCH_ISSUE_TOURISM,
    },

    {
      id: "environment",
      name:
        "Environmental Issues",
      iconKey: Trees,
      searchId:
        process.env
          .MELTWATER_SEARCH_ISSUE_ENVIRONMENT,
    },
  ] satisfies IssueConfig[],
};