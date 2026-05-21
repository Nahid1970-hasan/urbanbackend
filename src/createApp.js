import 'dotenv/config'
import fs from 'fs'
import express from 'express'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import { createPool } from './db.js'
import { prepareDatabase } from './bootstrapDb.js'
import { stripTrailingSlash } from './middleware/stripTrailingSlash.js'
import { createApiRouter, createUploadRoot } from './routes/api.js'

async function resyncSeedAdminPassword(pool) {
  const flag = String(process.env.RESYNC_ADMIN_PASSWORD || '').toLowerCase()
  if (!['1', 'true', 'yes'].includes(flag)) return

  const username = process.env.SEED_ADMIN_USERNAME || 'admin'
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
  const pwd =
    process.env.SEED_ADMIN_PASSWORD === undefined
      ? 'admin'
      : process.env.SEED_ADMIN_PASSWORD
  const hash = await bcrypt.hash(String(pwd), 10)

  let [r] = await pool.execute(
    'UPDATE users SET password_hash = ? WHERE username = ?',
    [hash, username]
  )
  if (!r.affectedRows) {
    ;[r] = await pool.execute(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [hash, email]
    )
  }
  if (r.affectedRows) {
    console.info(
      `RESYNC_ADMIN_PASSWORD: password updated for "${username}" (matched by username or email)`
    )
  } else {
    console.warn(
      'RESYNC_ADMIN_PASSWORD: no matching user — rely on first-time seed or create the user first'
    )
  }
}

async function seedAdminIfEmpty(pool) {
  const [[row]] = await pool.execute('SELECT COUNT(*) AS n FROM users')
  if (row.n > 0) return
  const pwd = process.env.SEED_ADMIN_PASSWORD || 'admin'
  const hash = await bcrypt.hash(pwd, 10)
  const username = process.env.SEED_ADMIN_USERNAME || 'admin'
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
  await pool.execute(
    `INSERT INTO users (username, email, password_hash, name, role, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [username, email, hash, 'Administrator', 'superadmin', 'active']
  )
  console.info(
    `Seeded admin: username="${username}", email="${email}" (password from SEED_ADMIN_PASSWORD)`
  )
}

/** Single Express instance for local server + Vercel serverless. */
export async function createApp() {
  await prepareDatabase()
  const pool = createPool()
  await seedAdminIfEmpty(pool)
  await resyncSeedAdminPassword(pool)

  const uploadRoot = createUploadRoot()
  fs.mkdirSync(uploadRoot, { recursive: true })

  const app = express()

  app.disable('x-powered-by')
  app.use(stripTrailingSlash)

  const declaredPort = Number.parseInt(process.env.FRONTEND_PORT || '', 10)
  const devPorts = new Set(
    [
      Number.isFinite(declaredPort) && declaredPort > 0 ? declaredPort : 5177,
      5177,
      5173,
    ].filter((n) => n > 0)
  )
  const defaultDevOrigins = [...devPorts].flatMap((port) => [
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
  ])
  const envOrigins = (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const allowedOrigins = [...new Set([...defaultDevOrigins, ...envOrigins])]

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true)
        if (allowedOrigins.includes(origin)) return callback(null, true)
        callback(null, false)
      },
      credentials: true,
    })
  )

  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))
  app.use('/uploads', express.static(uploadRoot))

  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: 'urban-api',
      ping: '/api/ping',
      login: '/api/users/login/',
      logout: 'POST /api/users/logout',
      projects_table: [
        'project_name',
        'api_dashboard',
        'public_api',
        'project_link',
        'project_details',
        'img_url',
        'status',
        'date',
      ],
      projects_api: {
        dashboard_list: '/api/projectdashboard',
        public_list: '/api/project_public_dashboard',
        one: '/api/projectall/:id',
        insert: 'POST /api/add_project',
        update: 'PATCH or PUT /api/update_project/:id',
        delete: 'DELETE /api/delete_project/:id',
      },
      clients_api: {
        dashboard_list: '/api/clientdashboard',
        one: '/api/clientall/:id',
        insert: 'POST /api/addclient',
        update: 'PATCH or PUT /api/updateclient/:id',
        delete: 'DELETE /api/deleteclient/:id',
      },
    })
  })

  app.use(createApiRouter(pool))

  app.use((err, _req, res, _next) => {
    console.error(err)
    if (res.headersSent) return
    res.status(500).json({ detail: err.message || 'Server error.' })
  })

  return app
}
