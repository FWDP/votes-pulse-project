import { Router } from 'express'

import { requireSession, type AuthRequest } from '../middleware/auth'
import {
    createMobileSession,
    revokeMobileSession,
} from '../services/mobileSessions.service'

const router = Router()

router.post('/session', async (request, response) => {
    const email = typeof request.body?.email === 'string' ? request.body.email : ''
    const password = typeof request.body?.password === 'string' ? request.body.password : ''
    if (!email || !password) return response.status(400).json({ error: 'Email and password are required.' })

    try {
        return response.json(await createMobileSession(email, password))
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to create mobile session.'
        return response.status(401).json({ error: message })
    }
})

router.delete('/session', requireSession, async (request: AuthRequest, response) => {
    const authorization = request.get('authorization') ?? ''
    const token = authorization.replace(/^Bearer\s+/i, '')
    if (token) await revokeMobileSession(token)
    return response.status(204).send()
})

export default router
