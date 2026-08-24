import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type { DashboardData } from "../types/dashboard";
import { getApiUrl } from '../utils/getApiUrl'

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

export interface DashboardFilters {
  severity?: string;
  area?: string;
  electionYear?: number;
  coverageMode?: 'administrative' | 'legislative';
  legislativeDistrictId?: string;
  partyListId?: string;
}

export function useDashboard(
  start: string,
  end: string,
  filters?: DashboardFilters,
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
        if (filters?.electionYear) params.set('electionYear', String(filters.electionYear))
        if (filters?.coverageMode) params.set('coverageMode', filters.coverageMode)
        if (filters?.legislativeDistrictId) params.set('legislativeDistrictId', filters.legislativeDistrictId)
        if (filters?.partyListId) params.set('partyListId', filters.partyListId)

        const response = await fetch(getApiUrl(`/api/dashboard?${params.toString()}`));

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
    }, [start, end, filters?.severity, filters?.area, filters?.electionYear, filters?.coverageMode, filters?.legislativeDistrictId, filters?.partyListId, placeholderScope?.region, placeholderScope?.province, placeholderScope?.district, placeholderScope?.locality]);

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
