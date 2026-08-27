import express from 'express'
import cors from 'cors'
import path from 'path'

import geographyRouter from './routes/geography'
import adminRouter from './routes/admin'
import dashboardRouter from './routes/dashboard'
import reportsRouter from './routes/reports'
import brandsRouter from './routes/brands'
import electionsRouter from './routes/elections'
import mobileRouter from './routes/mobile'
import integrityRouter from './routes/integrity'
import verificationRouter from './routes/verification'
import { dbEnabled } from './db'
import { stellarIntegrityConfig, stellarIntegrityConfigurationErrors } from './integrity/config'
import { integrityWorkerStatus } from './integrity/integrityWorker'

const app = express()
const distPath = path.resolve(process.cwd(), 'dist')

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

app.get('/api/readiness', (_request, response) => {
    const configurationErrors = stellarIntegrityConfig.enabled
        ? stellarIntegrityConfigurationErrors()
        : []
    const ready = dbEnabled && configurationErrors.length === 0 &&
        (!stellarIntegrityConfig.enabled || integrityWorkerStatus.started)
    return response.status(ready ? 200 : 503).json({
        ready,
        database: dbEnabled ? 'configured' : 'unconfigured',
        stellar: {
            enabled: stellarIntegrityConfig.enabled,
            network: stellarIntegrityConfig.network,
            configured: configurationErrors.length === 0,
            workerStarted: integrityWorkerStatus.started,
            validatedAt: integrityWorkerStatus.validatedAt,
            error: integrityWorkerStatus.error,
            configurationErrors,
        },
    })
})

app.use(
    '/api/geography',
    geographyRouter,
)

app.use('/api/admin', adminRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/brands', brandsRouter)
app.use('/api/elections', electionsRouter)
app.use('/api/mobile', mobileRouter)
app.use('/api/integrity', integrityRouter)
app.use('/api/verify', verificationRouter)

// Pulse API namespace (mirror existing endpoints under /api/pulse/*)
app.use(
    '/api/pulse/geography',
    geographyRouter,
)

app.use('/api/pulse/admin', adminRouter)
app.use('/api/pulse/dashboard', dashboardRouter)
app.use('/api/pulse/reports', reportsRouter)
app.use('/api/pulse/brands', brandsRouter)
app.use('/api/pulse/elections', electionsRouter)
app.use('/api/pulse/mobile', mobileRouter)
app.use('/api/pulse/integrity', integrityRouter)

app.use(express.static(distPath))

app.get(/^(?!\/api\/).*$/, (_request, response) => {
    response.sendFile(path.join(distPath, 'index.html'))
})

export default app
