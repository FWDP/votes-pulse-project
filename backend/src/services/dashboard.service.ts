import {
  dashboardConfig,
  type AreaConfig,
  type IssueConfig,
} from "../config/dashboard.config";

import { MessagesSquare } from "lucide-react";

import {
  getCountUnique,
  getDocumentCount,
  getSummary,
  getTopTerms,
} from "./meltwater.analytics";

import type {
  MeltwaterSummary,
} from "../types/meltwater";

import type {
  AreaItem,
  DashboardData,
  IssueItem,
  IssueTrend,
  QuickIssue,
  SentimentItem,
  SourceItem,
} from "../../../frontend/src/types/dashboard";

interface DateRange {
  start: string;
  end: string;
}

function roundPercentage(
  value: number,
) {
  return Math.round(
    value * 10,
  ) / 10;
}

/**
 * Meltwater also has "unknown" sentiment.
 *
 * For this dashboard we intentionally
 * normalize Positive + Neutral + Negative
 * to 100% so the donut only has the
 * three categories visible in the design.
 */
function mapSentiment(
  summary: MeltwaterSummary,
): SentimentItem[] {
  const positive =
    summary.sentiment.positive
      .document_count;

  const neutral =
    summary.sentiment.neutral
      .document_count;

  const negative =
    summary.sentiment.negative
      .document_count;

  const knownTotal =
    positive +
    neutral +
    negative;

  if (knownTotal === 0) {
    return [
      {
        name: "Positive",
        value: 0,
      },
      {
        name: "Neutral",
        value: 0,
      },
      {
        name: "Negative",
        value: 0,
      },
    ];
  }

  return [
    {
      name: "Positive",

      value: roundPercentage(
        (positive /
          knownTotal) *
        100,
      ),
    },

    {
      name: "Neutral",

      value: roundPercentage(
        (neutral /
          knownTotal) *
        100,
      ),
    },

    {
      name: "Negative",

      value: roundPercentage(
        (negative /
          knownTotal) *
        100,
      ),
    },
  ];
}

function sentimentObject(
  summary: MeltwaterSummary,
) {
  const mapped =
    mapSentiment(summary);

  return {
    positive:
      mapped.find(
        (item) =>
          item.name ===
          "Positive",
      )?.value ?? 0,

    neutral:
      mapped.find(
        (item) =>
          item.name ===
          "Neutral",
      )?.value ?? 0,

    negative:
      mapped.find(
        (item) =>
          item.name ===
          "Negative",
      )?.value ?? 0,
  };
}

function slugify(
  value: string,
) {
  return value
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

function calculateChange(
  current: number,

  previous: number,
): number {
  if (previous === 0) {
    return current > 0
      ? 100
      : 0;
  }

  return roundPercentage(
    ((current - previous) /
      previous) *
    100,
  );
}

function calculateTrend(
  change: number,
): IssueTrend {
  /*
   * +/- 5% is considered
   * meaningful movement.
   */
  if (change >= 5) {
    return "up";
  }

  if (change <= -5) {
    return "down";
  }

  return "stable";
}

function previousRange(
  range: DateRange,
): DateRange {
  /*
   * Treat the incoming strings
   * as timestamps without offsets,
   * matching Meltwater's format.
   */
  const startMilliseconds =
    Date.parse(
      `${range.start}Z`,
    );

  const endMilliseconds =
    Date.parse(
      `${range.end}Z`,
    );

  if (
    Number.isNaN(
      startMilliseconds,
    ) ||
    Number.isNaN(
      endMilliseconds,
    )
  ) {
    throw new Error(
      "Invalid date range.",
    );
  }

  const duration =
    endMilliseconds -
    startMilliseconds;

  const previousEnd =
    startMilliseconds;

  const previousStart =
    previousEnd - duration;

  function format(
    value: number,
  ) {
    return new Date(value)
      .toISOString()
      .replace(
        ".000Z",
        "",
      );
  }

  return {
    start:
      format(previousStart),

    end:
      format(previousEnd),
  };
}

async function safeNumber(
  callback: () => Promise<number>,
): Promise<number | null> {
  try {
    return await callback();
  } catch (error) {
    console.warn(
      "Optional Meltwater metric unavailable:",
      error,
    );

    return null;
  }
}

async function loadArea(
  area: AreaConfig,
  range: DateRange,
): Promise<AreaItem | null> {
  if (!area.searchId) {
    return null;
  }

  const [
    summary,
    topTopicsResponse,
  ] = await Promise.all([
    getSummary(
      area.searchId,
      range.start,
      range.end,
    ),

    getTopTerms(
      area.searchId,
      "keyphrase",
      range.start,
      range.end,
      2,
    ),
  ]);

  return {
    id: area.id,
    name: area.name,
    type: area.type,
    count:
      area.count,

    mentions:
      summary.volume
        .document_count,

    topTopics:
      topTopicsResponse
        .result.analysis
        .map(
          (topic) =>
            topic.key,
        )
        .slice(0, 2),

    sentiment:
      sentimentObject(
        summary,
      ),
  };
}

async function loadConfiguredIssue(
  issue: IssueConfig,
  current: DateRange,
  previous: DateRange,
): Promise<QuickIssue | null> {
  if (!issue.searchId) {
    return null;
  }

  const [
    currentSummary,
    previousSummary,
  ] = await Promise.all([
    getSummary(
      issue.searchId,
      current.start,
      current.end,
    ),

    getSummary(
      issue.searchId,
      previous.start,
      previous.end,
    ),
  ]);

  const currentMentions =
    currentSummary.volume
      .document_count;

  const previousMentions =
    previousSummary.volume
      .document_count;

  const change =
    calculateChange(
      currentMentions,
      previousMentions,
    );

  return {
    id: issue.id,
    name: issue.name,
    icon: issue.iconKey,
    mentions:
      currentMentions,
    trend:
      calculateTrend(change),
  };
}

/**
 * If specific Meltwater Saved Searches
 * haven't been configured for issues,
 * fall back to Meltwater keyphrases.
 */
async function loadAutomaticIssues(
  mainSearchId: string,
  current: DateRange,
  previous: DateRange,
): Promise<QuickIssue[]> {
  const topTerms =
    await getTopTerms(
      mainSearchId,
      "keyphrase",
      current.start,
      current.end,
      8,
    );

  const issues =
    topTerms.result.analysis;

  const result =
    await Promise.all(
      issues.map(
        async (
          issue,
          index,
        ): Promise<QuickIssue> => {
          let previousCount = 0;

          try {
            previousCount =
              await getDocumentCount(
                mainSearchId,

                previous.start,

                previous.end,

                {
                  keywords: [
                    issue.key,
                  ],
                },
              );
          } catch (error) {
            console.warn(
              `Unable to calculate trend for ${issue.key}`,
              error,
            );
          }

          const change =
            calculateChange(
              issue.document_count,
              previousCount,
            );

          return {
            id:
              slugify(
                issue.key,
              ) ||
              `issue-${index}`,

            name: issue.key,

            icon:
              MessagesSquare,

            mentions:
              issue.document_count,

            trend:
              calculateTrend(
                change,
              ),
          };
        },
      ),
    );

  return result.sort(
    (a, b) =>
      b.mentions -
      a.mentions,
  );
}

export async function buildDashboard(
  range: DateRange,
): Promise<DashboardData> {
  const mainSearchId =
    dashboardConfig.mainSearchId;

  if (!mainSearchId) {
    throw new Error(
      "MELTWATER_SEARCH_MAIN is not configured.",
    );
  }

  const previous =
    previousRange(range);

  const [
    summary,
    sourceResponse,
    uniqueContributors,
    activeLocations,
    areas,
  ] = await Promise.all([
    getSummary(
      mainSearchId,
      range.start,
      range.end,
    ),

    getTopTerms(
      mainSearchId,
      "source",
      range.start,
      range.end,
      20,
    ),

    /*
     * Coverage varies by source.
     * Return null instead of inventing
     * a value if Meltwater cannot run it.
     */
    safeNumber(() =>
      getCountUnique(
        mainSearchId,
        "author_name",
        range.start,
        range.end,
      ),
    ),

    safeNumber(() =>
      getCountUnique(
        mainSearchId,
        "location_city",
        range.start,
        range.end,
      ),
    ),

    Promise.all(
      dashboardConfig.areas.map(
        (area) =>
          loadArea(
            area,
            range,
          ),
      ),
    ),
  ]);

  const configuredIssues =
    dashboardConfig.issues.filter(
      (issue) =>
        Boolean(
          issue.searchId,
        ),
    );

  let quickIssues: QuickIssue[];

  if (
    configuredIssues.length >
    0
  ) {
    const issueResults =
      await Promise.all(
        configuredIssues.map(
          (issue) =>
            loadConfiguredIssue(
              issue,
              range,
              previous,
            ),
        ),
      );

    quickIssues =
      issueResults
        .filter(
          (
            item,
          ): item is QuickIssue =>
            item !== null,
        )
        .sort(
          (a, b) =>
            b.mentions -
            a.mentions,
        );
  } else {
    quickIssues =
      await loadAutomaticIssues(
        mainSearchId,
        range,
        previous,
      );
  }

  const sentiment =
    mapSentiment(summary);

  const positiveSentiment =
    sentiment.find(
      (item) =>
        item.name ===
        "Positive",
    )?.value ?? 0;

  const sources: SourceItem[] =
    sourceResponse
      .result.analysis
      .map((source) => ({
        id: slugify(
          source.key,
        ),

        name:
          source.key ===
            "Twitter"
            ? "X / Twitter"
            : source.key,

        type: "source",

        mentions:
          source.document_count,
      }))
      .sort(
        (a, b) =>
          b.mentions -
          a.mentions,
      );

  const issues: IssueItem[] =
    quickIssues.map(
      (issue) => ({
        id: issue.id,

        name: issue.name,

        mentions:
          issue.mentions,
      }),
    );

  return {

    totalMentions:
      summary.volume
        .document_count,
    positiveSentiment,
    uniqueContributors,
    activeLocations,
    sentiment,
    issues,
    sources,
    areas:
      areas.filter(
        (
          area,
        ): area is AreaItem =>
          area !== null,
      ),

    quickIssues:
      quickIssues.slice(
        0,
        6,
      ),
  };
}