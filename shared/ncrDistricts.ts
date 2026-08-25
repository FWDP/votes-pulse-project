export const NCR_STATISTICAL_DISTRICT_LOCALITY_CODES = {
    '133900000': [
        '1380600000', // City of Manila
    ],
    '137400000': [
        '1380500000', // Mandaluyong
        '1380700000', // Marikina
        '1381200000', // Pasig
        '1381300000', // Quezon City
        '1381400000', // San Juan
    ],
    '137500000': [
        '1380100000', // Caloocan
        '1380400000', // Malabon
        '1380900000', // Navotas
        '1381600000', // Valenzuela
    ],
    '137600000': [
        '1380200000', // Las Piñas
        '1380300000', // Makati
        '1380800000', // Muntinlupa
        '1381000000', // Parañaque
        '1381100000', // Pasay
        '1381500000', // Taguig
        '1381701000', // Pateros
    ],
} as const

export type NCRStatisticalDistrictCode =
    keyof typeof NCR_STATISTICAL_DISTRICT_LOCALITY_CODES

export const getNCRDistrictLocalityCodes = (
    districtCode?: string,
): readonly string[] | undefined => {
    if (!districtCode) return undefined

    return NCR_STATISTICAL_DISTRICT_LOCALITY_CODES[
        districtCode as NCRStatisticalDistrictCode
    ]
}
