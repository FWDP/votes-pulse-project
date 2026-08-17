import express from 'express'

import geographyRouter from './routes/geography'

const app = express()

app.use(express.json())

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
