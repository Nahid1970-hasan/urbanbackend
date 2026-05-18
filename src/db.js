import mysql from 'mysql2/promise'

/**
 * Parse mysql:// or mysql2:// connection strings (Vercel / Railway often provide DATABASE_URL).
 * Password must be URL-encoded if it has special characters (@ : / # etc.).
 */
function parseMysqlUrl(raw) {
  const normalized = raw.replace(/^mysql2?:\/\//i, 'http://')
  let u
  try {
    u = new URL(normalized)
  } catch {
    throw new Error(
      'Invalid DATABASE_URL / MYSQL_URL. Expected mysql://user:password@host:3306/database'
    )
  }

  const database = decodeURIComponent((u.pathname || '/').replace(/^\//, '')).split(
    '?'
  )[0]
  const port = parseInt(u.port || '3306', 10)

  return {
    host: u.hostname,
    port,
    user: decodeURIComponent(u.username || 'root'),
    password: decodeURIComponent(u.password || ''),
    database: database || 'urbanx',
  }
}

/** Shared connection settings (also used before DB exists). */
export function getMysqlPoolOptions() {
  const raw = process.env.DATABASE_URL || process.env.MYSQL_URL
  if (raw && String(raw).trim()) {
    return parseMysqlUrl(String(raw).trim())
  }

  const port = parseInt(process.env.MYSQL_PORT || '3306', 10)
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE || 'urbanx',
  }
}

/**
 * TLS for cloud MySQL. On Vercel, SSL defaults ON unless MYSQL_SSL=0.
 * Set MYSQL_SSL=0 only if your provider explicitly disables TLS.
 */
export function getMysqlSsl() {
  const off = process.env.MYSQL_SSL === '0' || process.env.MYSQL_SSL === 'false'
  if (off) return undefined

  const on =
    process.env.MYSQL_SSL === '1' ||
    process.env.MYSQL_SSL === 'true' ||
    process.env.VERCEL === '1'

  if (on) return { rejectUnauthorized: false }
  return undefined
}

export function createPool() {
  const opts = getMysqlPoolOptions()
  const ssl = getMysqlSsl()
  return mysql.createPool({
    host: opts.host,
    port: opts.port,
    user: opts.user,
    password: opts.password,
    database: opts.database,
    waitForConnections: true,
    connectionLimit: 10,
    ssl,
  })
}
