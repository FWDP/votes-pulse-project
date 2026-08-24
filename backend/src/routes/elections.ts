import { Router, type Request, type Response } from 'express'

import {
    ElectionQueryError,
    getElectionDataStatus,
    getLegislativeDatasetMetadata,
    getLegislativeDistrict,
    getLegislativeDistrictBoundary,
    getLegislativeDistrictLocalities,
    getLegislativeDistrictSubdivisions,
    getLegislativeSubdivisionDatasetMetadata,
    getPartyList,
    getPartyListDatasetMetadata,
    listLegislativeDistricts,
    listPartyLists,
} from '../services/elections.service'

const router = Router()
const CLIENT_CACHE_SECONDS = 60 * 60

const queryString = (request: Request, name: string): string | undefined => {
    const value = request.query[name]
    if (value === undefined) return undefined
    if (typeof value !== 'string') {
        throw new ElectionQueryError(`${name} must be provided once as text`)
    }
    return value
}

const sendError = (error: unknown, response: Response) => {
    if (error instanceof ElectionQueryError) {
        response.status(400).json({ message: error.message })
        return
    }

    console.error('Election data request failed:', error)
    response.status(500).json({ message: 'Unable to read election data' })
}

const sendList = <T>(response: Response, metadata: unknown, data: T[]) => {
    response.set('Cache-Control', `public, max-age=${CLIENT_CACHE_SECONDS}`)
    response.json({ count: data.length, next: null, previous: null, metadata, data })
}

router.get('/status', (request, response) => {
    try {
        response.set('Cache-Control', `public, max-age=${CLIENT_CACHE_SECONDS}`)
        response.json({ data: getElectionDataStatus(queryString(request, 'year')) })
    } catch (error) {
        sendError(error, response)
    }
})

router.get('/legislative-districts', (request, response) => {
    try {
        const data = listLegislativeDistricts({
            year: queryString(request, 'year'),
            region: queryString(request, 'region'),
            province: queryString(request, 'province'),
            locality: queryString(request, 'locality'),
            jurisdiction: queryString(request, 'jurisdiction'),
            barangay: queryString(request, 'barangay'),
            submunicipality: queryString(request, 'submunicipality'),
            q: queryString(request, 'q'),
        })
        sendList(response, getLegislativeDatasetMetadata(), data)
    } catch (error) {
        sendError(error, response)
    }
})

router.get('/legislative-districts/:id/localities', (request, response) => {
    try {
        const data = getLegislativeDistrictLocalities(
            request.params.id,
            queryString(request, 'year'),
        )
        if (!data) {
            response.status(404).json({ message: 'Legislative district not found' })
            return
        }
        sendList(response, getLegislativeDatasetMetadata(), data)
    } catch (error) {
        sendError(error, response)
    }
})

router.get('/legislative-districts/:id/boundary', (request, response) => {
    try {
        const feature = getLegislativeDistrictBoundary(
            request.params.id,
            queryString(request, 'year'),
        )
        if (!feature) {
            response.status(404).json({ message: 'Legislative district boundary not found' })
            return
        }
        response.set('Cache-Control', `public, max-age=${CLIENT_CACHE_SECONDS}`)
        response.json({
            type: 'FeatureCollection',
            features: [feature],
        })
    } catch (error) {
        sendError(error, response)
    }
})

router.get('/legislative-districts/:id/subdivisions', (request, response) => {
    try {
        const membership = getLegislativeDistrictSubdivisions(
            request.params.id,
            queryString(request, 'year'),
        )
        if (!membership) {
            response.status(404).json({ message: 'Legislative district not found' })
            return
        }
        sendList(response, {
            ...getLegislativeSubdivisionDatasetMetadata(),
            membershipStatus: membership.membershipStatus,
            sources: membership.sources,
        }, membership.units)
    } catch (error) {
        sendError(error, response)
    }
})

router.get('/legislative-districts/:id', (request, response) => {
    try {
        const data = getLegislativeDistrict(
            request.params.id,
            queryString(request, 'year'),
        )
        if (!data) {
            response.status(404).json({ message: 'Legislative district not found' })
            return
        }
        response.set('Cache-Control', `public, max-age=${CLIENT_CACHE_SECONDS}`)
        response.json({ metadata: getLegislativeDatasetMetadata(), data })
    } catch (error) {
        sendError(error, response)
    }
})

router.get('/party-lists', (request, response) => {
    try {
        const data = listPartyLists({
            year: queryString(request, 'year'),
            q: queryString(request, 'q'),
        })
        sendList(response, getPartyListDatasetMetadata(), data)
    } catch (error) {
        sendError(error, response)
    }
})

router.get('/party-lists/:id', (request, response) => {
    try {
        const data = getPartyList(request.params.id, queryString(request, 'year'))
        if (!data) {
            response.status(404).json({ message: 'Party-list organization not found' })
            return
        }
        response.set('Cache-Control', `public, max-age=${CLIENT_CACHE_SECONDS}`)
        response.json({ metadata: getPartyListDatasetMetadata(), data })
    } catch (error) {
        sendError(error, response)
    }
})

export default router
