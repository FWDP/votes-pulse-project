import path from 'node:path'
import { Pool } from 'pg'
import { config as loadEnv } from 'dotenv'

// If DATABASE_URL not set in the environment, try loading backend/.env
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), 'backend', '.env')
  // ignore missing file
  loadEnv({ path: envPath })
}

const connectionString = process.env.DATABASE_URL
export const dbEnabled = Boolean(connectionString)
let pool: Pool | undefined
if (dbEnabled) {
  pool = new Pool({ connectionString })
}

export const query = async (text: string, params?: any[], client?: any) => {
  if (client) return client.query(text, params)
  if (!pool) throw new Error('Database not configured. Set DATABASE_URL to enable DB-backed mode.')
  return pool.query(text, params)
}

export const runTenantOperation = async <T>(tenantId: string, fn: (client: any) => Promise<T>) => {
  if (!pool) throw new Error('Database not configured. Set DATABASE_URL to enable DB-backed mode.')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId])
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const close = async () => {
  if (pool) await pool.end()
}
