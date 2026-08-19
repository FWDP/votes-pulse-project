import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type { DashboardData } from "../types/dashboard";

import {
  createPlaceholderDashboard,
  placeholderDashboard,
  type PlaceholderScope,
} from "../data/placeholderDashboard";

interface UseDashboardResult {
  data: DashboardData;
  loading: boolean;
  error: string | null;
  usingPlaceholder: boolean;
  refresh: () => Promise<void>;
}

export function useDashboard(
  start: string,
  end: string,
  filters?: { severity?: string; area?: string },
  placeholderScope?: PlaceholderScope,
): UseDashboardResult {
  const [data, setData] =
    useState<DashboardData>(() => createPlaceholderDashboard(placeholderScope));

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    usingPlaceholder,
    setUsingPlaceholder,
  ] = useState(true);

  const loadDashboard =
    useCallback(async () => {
      const apiBaseUrl = (
        import.meta as ImportMeta & {
          env?: {
            VITE_API_BASE_URL?: string;
          };
        }
      ).env?.VITE_API_BASE_URL;

      try {
        setLoading(true);

        setError(null);

        const params = new URLSearchParams({ start, end });
        if (filters?.severity && filters.severity !== 'all') params.set('severity', filters.severity)
        if (filters?.area) params.set('area', filters.area)

        const dashboardUrl = apiBaseUrl
          ? `${apiBaseUrl}/api/dashboard?${params.toString()}`
          : `/api/dashboard?${params.toString()}`;

        const response = await fetch(dashboardUrl);

        if (!response.ok) {
          throw new Error(
            `Dashboard API returned ${response.status}`,
          );
        }

        const responseData =
          (await response.json()) as DashboardData;

        setData(responseData);

        setUsingPlaceholder(false);
      } catch (error) {
        console.error(
          "Dashboard API error:",
          error,
        );

        /*
         * If backend/Meltwater isn't available,
         * fall back to a geography-scoped placeholder snapshot.
         */
        setData(createPlaceholderDashboard(placeholderScope));

        setUsingPlaceholder(true);

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load dashboard",
        );
      } finally {
        setLoading(false);
      }
    }, [start, end, filters?.severity, filters?.area, placeholderScope?.region, placeholderScope?.province, placeholderScope?.locality]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return {
    data,
    loading,
    error,
    usingPlaceholder,
    refresh: loadDashboard,
  };
}