import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { Pool } from 'pg'

// If DATABASE_URL not set, attempt to load backend/.env
if (!process.env.DATABASE_URL) {
  loadEnv({ path: path.resolve(process.cwd(), 'backend', '.env') })
}

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'backend', 'db', 'migrations')
const MIGRATION_FILES = [
  '001_init.sql',
  '002_add_password.sql',
  '003_add_brands.sql',
  '004_field_report_mobile.sql',
  '005_report_integrity.sql',
  '006_integrity_revisions.sql',
]

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set. Aborting migrations.')
  process.exit(1)
}

const pool = new Pool({ connectionString })

const run = async () => {
  try {
    for (const file of MIGRATION_FILES) {
      const id = file
      const { rowCount } = await pool.query('SELECT 1 FROM migrations WHERE id = $1', [id]).catch(() => ({ rowCount: 0 }))
      if (rowCount && rowCount > 0) {
        console.log(`${file} already applied, skipping.`)
        continue
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8')
      console.log(`Applying ${file}...`)
      await pool.query(sql)
      await pool.query('INSERT INTO migrations (id) VALUES ($1)', [id])
      console.log(`Applied ${file}`)
    }
    console.log('Migrations complete.')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

run()
