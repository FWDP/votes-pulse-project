import type {
    GeographySelection,
} from '../types/geography'

import type {
    SentimentData,
} from '../types/sentiment'

const NATIONAL_SENTIMENT: SentimentData = {
    positive: 26,
    neutral: 46,
    negative: 28,
}

const hashString = (
    value: string,
): number => {
    let hash = 0

    for (
        let i = 0;
        i < value.length;
        i++
    ) {
        hash =
            (hash << 5) -
            hash +
            value.charCodeAt(i)

        hash |= 0
    }

    return Math.abs(hash)
}

export function getPlaceholderSentiment(
    {
        region,
        province,
        locality,
    }: GeographySelection,
): SentimentData {
    /**
     * National.
     */
    if (
        !region &&
        !province &&
        !locality
    ) {
        return NATIONAL_SENTIMENT
    }

    /**
     * Use official PSGC codes as our seed.
     *
     * This gives every selected geography
     * a consistent placeholder value.
     */
    const geographyKey = [
        region || 'national',
        province || 'all-provinces',
        locality || 'all-localities',
    ].join('|')

    const seed =
        hashString(
            geographyKey,
        )

    const positive =
        20 +
        (seed % 20)

    const negative =
        18 +
        (Math.floor(
            seed / 10,
        ) %
            17)

    const neutral =
        100 -
        positive -
        negative

    return {
        positive,
        neutral,
        negative,
    }
}