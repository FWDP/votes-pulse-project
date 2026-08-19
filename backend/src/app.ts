import express from 'express'
import cors from 'cors'
import path from 'path'

import geographyRouter from './routes/geography'
import adminRouter from './routes/admin'
import dashboardRouter from './routes/dashboard'
import reportsRouter from './routes/reports'

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

app.use(
    '/api/geography',
    geographyRouter,
)

app.use('/api/admin', adminRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/reports', reportsRouter)

app.use(express.static(distPath))

app.get(/^(?!\/api\/).*$/, (_request, response) => {
    response.sendFile(path.join(distPath, 'index.html'))
})

export default app
