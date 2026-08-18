import express from 'express'
import cors from 'cors'

import geographyRouter from './routes/geography'

const app = express()

app.use(express.json())

const defaultDevOrigins = 'http://votes-pulse.local,http://localhost:5173,http://127.0.0.1:5173'
const corsOrigins = (process.env.CORS_ORIGIN || defaultDevOrigins)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // allow non-browser requests like curl (no origin)
        if (!origin) return callback(null, true)
        if (corsOrigins.indexOf(origin) !== -1) return callback(null, true)
        return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
}

app.use(cors(corsOptions))

app.get('/api/health', (_request, response) => {
    response.json({
        ok: true,
        service: 'votes-pulse-backend',
        now: new Date().toISOString(),
    })
})

app.use(
    '/api/geography',
    geographyRouter,
)

export default app
