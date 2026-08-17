import {
    CalendarDays,
} from 'lucide-react'

import {
    GeographyControls,
} from './GeographyControls'

import type {
    GeographySelection,
} from '../../types/geography'
import {
    ALL_CITIES_FILTER,
    ALL_MUNICIPALITIES_FILTER,
    INDEPENDENT_CITIES_FILTER,
} from '../../types/geography'

type CoverageFilterProps = {
    period?: string

    onPeriodChange?: (
        value: string,
    ) => void

    geography: GeographySelection

    onGeographyChange: (
        value: GeographySelection,
    ) => void
}

export default function CoverageFilter({
    period = '30d',
    onPeriodChange,
    geography,
    onGeographyChange,
}: CoverageFilterProps) {
    const getDescription = () => {
        if (geography.locality) {
            if (geography.locality === ALL_CITIES_FILTER) {
                return 'Showing all cities within the selected administrative coverage.'
            }

            if (geography.locality === ALL_MUNICIPALITIES_FILTER) {
                return 'Showing all municipalities within the selected administrative coverage.'
            }

            return 'Showing data for the selected city or municipality.'
        }

        if (geography.province) {
            if (geography.province === INDEPENDENT_CITIES_FILTER) {
                return 'Showing independently administered cities in the selected region.'
            }

            return 'Showing data for the selected province.'
        }

        if (geography.district) {
            return 'Showing data for the selected NCR statistical district.'
        }

        if (geography.region) {
            return 'Showing data for the selected region.'
        }

        return 'Showing national aggregate data.'
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-5 p-4 sm:p-5">
                <div className="
                    flex
                    flex-col
                    gap-4
                    xl:flex-row
                    xl:items-end
                    xl:justify-between
                ">
                    {/* Geography */}

                    <div className="min-w-0 flex-1">
                        <div className="mb-2">
                            <span className="
                                text-xs
                                font-semibold
                                uppercase
                                tracking-wide
                                text-slate-400
                            ">
                                Coverage
                            </span>
                        </div>

                        <GeographyControls
                            value={geography}
                            onChange={
                                onGeographyChange
                            }
                        />
                    </div>

                    {/* Date Range */}

                    <div className="shrink-0">
                        <label
                            htmlFor="dashboard-period"
                            className="
                                mb-2
                                block
                                text-xs
                                font-semibold
                                uppercase
                                tracking-wide
                                text-slate-400
                            "
                        >
                            Date Range
                        </label>

                        <div className="relative">
                            <CalendarDays
                                size={16}
                                className="
                                    pointer-events-none
                                    absolute
                                    left-3
                                    top-1/2
                                    -translate-y-1/2
                                    text-slate-700
                                "
                            />

                            <select
                                id="dashboard-period"
                                value={period}
                                onChange={event =>
                                    onPeriodChange?.(
                                        event.target
                                            .value,
                                    )
                                }
                                className="
                                    h-10
                                    min-w-[170px]
                                    appearance-none
                                    rounded-lg
                                    border
                                    border-slate-200
                                    bg-white
                                    pl-9
                                    pr-9
                                    text-sm
                                    font-medium
                                    text-slate-700
                                    outline-none
                                    transition
                                    hover:border-slate-300
                                    focus:border-emerald-500
                                    focus:ring-2
                                    focus:ring-emerald-100
                                "
                            >
                                <option value="7d">
                                    Last 7 days
                                </option>

                                <option value="30d">
                                    Last 30 days
                                </option>

                                <option value="90d">
                                    Last 90 days
                                </option>

                                <option value="1y">
                                    Last 12 months
                                </option>
                            </select>

                            <svg
                                className="
                                    pointer-events-none
                                    absolute
                                    right-3
                                    top-1/2
                                    h-4
                                    w-4
                                    -translate-y-1/2
                                    text-slate-400
                                "
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="
                                        M5.23 7.21
                                        a.75.75 0 011.06.02
                                        L10 11.168
                                        l3.71-3.938
                                        a.75.75 0 111.08 1.04
                                        l-4.25 4.51
                                        a.75.75 0 01-1.08 0
                                        l-4.25-4.51
                                        a.75.75 0 01.02-1.06z
                                    "
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Description */}

            <div className="
                border-t
                border-slate-100
                bg-slate-50/70
                px-4
                py-3
                sm:px-5
            ">
                <p className="text-xs text-slate-500 sm:text-sm">
                    {getDescription()}

                    {!geography.region && (
                        <span className="ml-1 text-slate-400">
                            Select a region to narrow
                            the coverage.
                        </span>
                    )}
                </p>
            </div>
        </div>
    )
}
