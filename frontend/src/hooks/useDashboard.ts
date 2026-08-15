import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type { DashboardData } from "../types/dashboard";

import { placeholderDashboard } from "../data/placeholderDashboard";

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
): UseDashboardResult {
  const [data, setData] =
    useState<DashboardData>(
      placeholderDashboard,
    );

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

      /*
       * Backend isn't configured yet.
       * Keep showing development placeholders.
       */
      if (!apiBaseUrl) {
        setData(placeholderDashboard);

        setUsingPlaceholder(true);

        setError(null);

        setLoading(false);

        return;
      }

      try {
        setLoading(true);

        setError(null);

        const params =
          new URLSearchParams({
            start,
            end,
          });

        const response = await fetch(
          `${apiBaseUrl}/api/dashboard?${params.toString()}`,
        );

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
         * fall back to placeholders.
         */
        setData(placeholderDashboard);

        setUsingPlaceholder(true);

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load dashboard",
        );
      } finally {
        setLoading(false);
      }
    }, [start, end]);

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