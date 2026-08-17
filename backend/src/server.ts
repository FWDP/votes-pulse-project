import path from 'path'
import { config } from 'dotenv'

config({
    path: path.resolve(process.cwd(), 'backend', '.env'),
})

// Import the app only after the backend environment has been loaded. Static
// imports are evaluated before the statements above in an ES module.
const { default: app } = await import('./app')

const port = Number(process.env.PORT || process.env.BACKEND_PORT || 8787)
const host = process.env.BACKEND_HOST || '127.0.0.1'

app.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend server listening on http://${host}:${port}`)
})
