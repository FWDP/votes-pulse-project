export interface PSGCPopulationData {
    code: string
    population: string
    year: number
}

export interface GeographyUnit {
    code: string
    area_name: string
    geographic_level: string
    reg: number
    prv?: number
    mun?: number
    island_region?: string
}

export interface GeographySelection {
    region: string
    province: string
    locality: string
}

export interface GeographyApiResponse {
    data: GeographyUnit[]
}
