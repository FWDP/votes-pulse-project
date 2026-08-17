import type {
    GeographySelection,
} from '../types/geography'

import type {
    SentimentData,
} from '../types/sentiment'

import {
    getPlaceholderSentiment,
} from '../data/placeholderSentiment'

export interface UserSentimentData {
    sentiment: SentimentData
    isPlaceholder: boolean
}

/**
 * Returns sentiment data for the currently selected
 * geography and date range.
 *
 * For now, all values come from placeholder data.
 *
 * Later:
 *
 * Geography + Period
 *        ↓
 * Backend
 *        ↓
 * Meltwater
 *        ↓
 * Real sentiment
 */
export function getUserSentimentData(
    geography: GeographySelection,
    period: string,
): UserSentimentData {
    /**
     * `period` isn't used by the placeholder generator yet,
     * but we deliberately accept it now because it will
     * eventually be sent to Meltwater.
     */
    void period

    const placeholderSentiment =
        getPlaceholderSentiment(
            geography,
        )

    return {
        sentiment:
            placeholderSentiment,

        isPlaceholder: true,
    }
}