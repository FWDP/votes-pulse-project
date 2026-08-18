import {
  meltwaterRequest,
} from "./meltwater.client";

import type {
  MeltwaterCountUniqueResponse,
  MeltwaterDocumentCountResponse,
  MeltwaterSummary,
  MeltwaterTopTermsResponse,
} from "../types/meltwater";

import {
  dashboardConfig,
} from "../config/dashboard.config";

interface AnalyticsFilters {
  keywords?: string[];
}

function getTimezone() {
  return dashboardConfig.timezone;
}

export async function getSummary(
  searchId: string,

  start: string,

  end: string,
): Promise<MeltwaterSummary> {
  const params =
    new URLSearchParams({
      start,

      end,

      tz: getTimezone(),
    });

  return meltwaterRequest<MeltwaterSummary>(
    `/analytics/${encodeURIComponent(
      searchId,
    )}?${params.toString()}`,
  );
}

export async function getTopTerms(
  searchId: string,

  dimension: string,

  start: string,

  end: string,

  limit = 10,
): Promise<MeltwaterTopTermsResponse> {
  return meltwaterRequest<MeltwaterTopTermsResponse>(
    `/analytics/${encodeURIComponent(
      searchId,
    )}/custom`,

    {
      method: "POST",

      body: JSON.stringify({
        start,

        end,

        tz: getTimezone(),

        analysis: {
          type: "top_terms",

          dimension,

          limit,
        },
      }),
    },
  );
}

export async function getCountUnique(
  searchId: string,

  dimension: string,

  start: string,

  end: string,
): Promise<number> {
  const response =
    await meltwaterRequest<MeltwaterCountUniqueResponse>(
      `/analytics/${encodeURIComponent(
        searchId,
      )}/custom`,

      {
        method: "POST",

        body: JSON.stringify({
          start,

          end,

          tz: getTimezone(),

          analysis: {
            type:
              "count_unique",

            dimension,
          },
        }),
      },
    );

  return response.result.analysis;
}

export async function getDocumentCount(
  searchId: string,

  start: string,

  end: string,

  filters: AnalyticsFilters = {},
): Promise<number> {
  const response =
    await meltwaterRequest<MeltwaterDocumentCountResponse>(
      `/analytics/${encodeURIComponent(
        searchId,
      )}/custom`,

      {
        method: "POST",

        body: JSON.stringify({
          start,

          end,

          tz: getTimezone(),

          ...(filters.keywords
            ? {
                keywords:
                  filters.keywords,
              }
            : {}),

          analysis: {
            type:
              "document_count",
          },
        }),
      },
    );

  return response.result
    .document_count;
}