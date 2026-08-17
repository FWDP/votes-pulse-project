export interface PSGCPopulationData {
    code: string
    population: string
    year: number
}

export const INDEPENDENT_CITIES_FILTER = 'independent-cities'
export const ALL_CITIES_FILTER = 'all-cities'
export const ALL_MUNICIPALITIES_FILTER = 'all-municipalities'

export interface GeographyUnit {
    code: string
    area_name: string
    geographic_level: string
    reg: number
    prv?: number
    mun?: number
    correspondence_code?: string
    island_region?: string
}

export interface GeographySelection {
    region: string
    province: string
    district: string
    locality: string
}

export interface ResolvedGeographySelection {
    region?: GeographyUnit
    province?: GeographyUnit
    district?: GeographyUnit
    locality?: GeographyUnit
}

export interface GeographyApiResponse {
    data: GeographyUnit[]
}

export type GeoJsonPosition = [number, number]

export interface GeoJsonPolygon {
    type: 'Polygon'
    coordinates: GeoJsonPosition[][]
}

export interface GeoJsonMultiPolygon {
    type: 'MultiPolygon'
    coordinates: GeoJsonPosition[][][]
}

export interface BoundaryProperties {
    reg_name?: string
    prov_name?: string
    city_name?: string
    reg_code?: string
    prov_code?: string
    city_code?: string
    psgc_10d?: string
    psgc_code?: string
    psgc_name?: string
    geographic_level?: string
}

export interface BoundaryFeature {
    type: 'Feature'
    geometry: GeoJsonPolygon | GeoJsonMultiPolygon | null
    properties: BoundaryProperties
}

export interface BoundaryFeatureCollection {
    type: 'FeatureCollection'
    features: BoundaryFeature[]
}
