import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { Pool } from 'pg'
import { authTenants, authUsers, authWorkspaces, authMemberships } from '../src/config/auth.config'

// If DATABASE_URL not set, attempt to load backend/.env
if (!process.env.DATABASE_URL) {
  loadEnv({ path: path.resolve(process.cwd(), 'backend', '.env') })
}
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set. Aborting seed.')
  process.exit(1)
}

const pool = new Pool({ connectionString })

const upsert = async (text: string, params: any[]) => {
  try {
    await pool.query(text, params)
  } catch (err) {
    console.error('Seed error:', err)
    throw err
  }
}

const run = async () => {
  try {
    for (const t of authTenants) {
      await upsert('INSERT INTO tenants (id, slug, name, status) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name, status = EXCLUDED.status', [t.id, t.slug, t.name, t.status])
    }
    for (const u of authUsers) {
      // For seeded demo accounts, set a default password of 'password' (hashed).
      const password = process.env.SEED_PASSWORD ?? 'password'
      const hash = await bcrypt.hash(password, 10)
      await upsert('INSERT INTO users (id, email, display_name, job_title, status, password_hash) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, job_title = EXCLUDED.job_title, status = EXCLUDED.status, password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash)', [u.id, u.email, u.displayName, u.jobTitle, u.status, hash])
    }
    for (const w of authWorkspaces) {
      await upsert('INSERT INTO workspaces (id, tenant_id, slug, name, product) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, slug = EXCLUDED.slug, name = EXCLUDED.name, product = EXCLUDED.product', [w.id, w.tenantId, w.slug, w.name, w.product])
    }
    for (const m of authMemberships) {
      await upsert('INSERT INTO memberships (id, tenant_id, user_id, role, status, workspace_ids) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, user_id = EXCLUDED.user_id, role = EXCLUDED.role, status = EXCLUDED.status, workspace_ids = EXCLUDED.workspace_ids', [m.id, m.tenantId, m.userId, m.role, m.status, JSON.stringify(m.workspaceIds ?? null)])
    }

    console.log('Seed complete')
  } catch (error) {
    console.error('Seeding failed', error)
  } finally {
    await pool.end()
  }
}

run()
