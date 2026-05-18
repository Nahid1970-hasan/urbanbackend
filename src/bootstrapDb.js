import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'
import { getMysqlPoolOptions, getMysqlSsl } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Adds api_dashboard / public_api on older DBs; no-op when columns already exist. */
async function ensureProjectsExtraColumns(conn) {
  const defs = [
    ['api_dashboard', "VARCHAR(2048) NOT NULL DEFAULT ''"],
    ['public_api', "VARCHAR(2048) NOT NULL DEFAULT ''"],
  ]
  for (const [col, ddl] of defs) {
    try {
      await conn.query(`ALTER TABLE projects ADD COLUMN \`${col}\` ${ddl}`)
    } catch (e) {
      const dup =
        e.code === 'ER_DUP_FIELDNAME' ||
        e.errno === 1060 ||
        /Duplicate column name/i.test(String(e.sqlMessage || e.message || ''))
      if (!dup) throw e
    }
  }
}

function findSchemaSqlPath() {
  const roots = [
    path.join(__dirname, '..'), // repo root (local)
    process.cwd(),
    path.join(process.cwd(), '..'),
  ]
  const seen = new Set()
  for (const root of roots) {
    const p = path.join(root, 'schema.sql')
    if (seen.has(p)) continue
    seen.add(p)
    if (fs.existsSync(p)) return p
  }
  return null
}

/**
 * Ensure database + tables exist. On Vercel, skip CREATE DATABASE (managed DBs disallow it).
 * Set SKIP_DB_BOOTSTRAP=true to skip entirely (tables must already exist).
 */
export async function prepareDatabase() {
  if (process.env.SKIP_DB_BOOTSTRAP === 'true') {
    console.info('SKIP_DB_BOOTSTRAP: skipping schema sync')
    return
  }

  const { host, port, user, password, database } = getMysqlPoolOptions()
  const dbSafe = String(database || 'urbanx').replace(/[^a-zA-Z0-9_]/g, '')
  if (!dbSafe) {
    throw new Error('MYSQL_DATABASE / database name in DATABASE_URL is invalid')
  }

  const onVercel = process.env.VERCEL === '1'

  if (
    onVercel &&
    (host === '127.0.0.1' || host === 'localhost' || !host)
  ) {
    throw new Error(
      'On Vercel use a cloud database. Set DATABASE_URL or MYSQL_HOST to your provider hostname (not localhost). Example: DATABASE_URL=mysql://user:pass@db.example.com:3306/mydb'
    )
  }

  const ssl = getMysqlSsl()

  if (!onVercel) {
    const admin = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
      ssl,
    })

    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbSafe}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    await admin.end()
  }

  let conn
  try {
    conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database: dbSafe,
      multipleStatements: true,
      ssl,
    })
  } catch (e) {
    const extra =
      e.code === 'ECONNREFUSED'
        ? ' Connection refused — check MYSQL_HOST/MYSQL_PORT and that the DB allows inbound from the internet.'
        : e.code === 'ER_ACCESS_DENIED_ERROR'
          ? ' Access denied — wrong MYSQL_USER/MYSQL_PASSWORD or user not allowed from this IP.'
          : e.code === 'ENOTFOUND'
            ? ' Host not found — check MYSQL_HOST / DATABASE_URL hostname.'
            : e.code === 'WRONG_VERSION' || String(e.message || '').includes('SSL')
              ? ' Try MYSQL_SSL=1 (default on Vercel) or MYSQL_SSL=0 if your DB has no TLS.'
              : ''
    throw new Error(`${e.message || e.code || 'MySQL connect failed'}${extra}`)
  }

  const schemaPath = findSchemaSqlPath()
  if (!schemaPath) {
    await conn.end()
    const hint = onVercel
      ? 'Bundle schema.sql (vercel.json includeFiles) or set SKIP_DB_BOOTSTRAP=true if tables already exist.'
      : 'Place schema.sql at project root.'
    throw new Error(`Missing schema.sql. ${hint}`)
  }

  let sql = fs.readFileSync(schemaPath, 'utf8')
  sql = sql.replace(/^\s*--[^\r\n]*$/gm, '')
  sql = sql.replace(/CREATE DATABASE\s+[^;]+;/gi, '')
  sql = sql.replace(/USE\s+[^;]+;/gi, '')
  sql = sql.trim()

  if (sql.length > 0) {
    try {
      await conn.query(sql)
    } catch (e) {
      await conn.end()
      throw new Error(
        `schema.sql failed: ${e.message || e.code}. If tables already exist, set SKIP_DB_BOOTSTRAP=true in Vercel.`
      )
    }
  }

  await ensureProjectsExtraColumns(conn)

  await conn.end()

  console.info(`MySQL ready: database "${dbSafe}" (tables ensured from schema.sql)`)
}
