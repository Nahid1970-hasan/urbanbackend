/**
 * Vercel Serverless — see vercel.json rewrites.
 * Startup errors return JSON with the real message so you can fix env without reading logs only.
 */
import { createApp } from '../src/createApp.js'

let appPromise

async function getApp() {
  if (!appPromise) {
    appPromise = createApp().catch((err) => {
      appPromise = null
      throw err
    })
  }
  return appPromise
}

function serializeErr(err) {
  const body = {
    detail: err.message || String(err),
    code: err.code,
    errno: err.errno,
    sqlState: err.sqlState,
    sqlMessage: err.sqlMessage,
    hint:
      'Vercel: set DATABASE_URL or MYSQL_HOST (+ user/pass/db). TLS defaults ON on Vercel; use MYSQL_SSL=0 to disable.',
  }
  if (process.env.API_DEBUG_ERRORS === '1') {
    body.stack = err.stack
  }
  return body
}

export default async function handler(req, res) {
  try {
    const app = await getApp()
    return app(req, res)
  } catch (err) {
    console.error('[api] createApp failed:', err)
    if (!res.headersSent) {
      return res.status(503).json(serializeErr(err))
    }
  }
}
