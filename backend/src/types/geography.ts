export interface PSGCPopulationData {
    code: string
    population: string
    year: number
}

export interface GeographyUnit {
    code?: string
    psgc_code: string

    area_name: string

    correspondence_code: string

    geographic_level: string

    reg: number

    prv: number

    mun: number

    bgy: number

    old_name?: string

    city_class?: string

    income_classification?: string

    urban_rural?: string

    island_region?: string

    status?: string

    version?: string

    population_data?: PSGCPopulationData[]
}

export interface GeographySelection {
    /**
     * These contain official
     * 10-digit PSGC codes.
     */
    region: string

    province: string

    locality: string
}

export interface GeographyApiResponse {
    data: GeographyUnit[]
}
