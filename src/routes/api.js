import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import { requireAuth } from '../middleware/requireAuth.js'

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

function jwtSecret() {
  return process.env.JWT_SECRET || 'dev-secret-change-me'
}

function publicBaseUrl(req) {
  const env = process.env.PUBLIC_BASE_URL
  if (env) return env.replace(/\/$/, '')
  const host = req.get('host') || `127.0.0.1:${process.env.PORT || 8000}`
  const proto = req.protocol || 'http'
  return `${proto}://${host}`
}

function fmtDate(d) {
  if (d == null || d === '') return ''
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  const s = String(d)
  return s.length >= 10 ? s.slice(0, 10) : s
}

function fmtTs(d) {
  if (d == null || d === '') return ''
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString()
  return String(d)
}

function rowUser(row) {
  return {
    user_id: row.user_id,
    username: row.username,
    email: row.email,
    name: row.name ?? '',
    role: row.role ?? 'admin',
    status: (row.status ?? 'active').toLowerCase(),
    created_date: fmtTs(row.created_date),
  }
}

/** Dashboard row: user_id, username, email, role, active (from status). */
function rowUserDashboard(row) {
  const status = (row.status ?? 'active').toLowerCase()
  return {
    user_id: row.user_id,
    username: row.username ?? '',
    email: row.email ?? '',
    role: row.role ?? 'admin',
    active: status === 'active',
  }
}

function rowProject(row) {
  return {
    project_id: row.project_id,
    id: row.project_id,
    project_name: row.project_name ?? '',
    date: fmtDate(row.date),
    project_details: row.project_details ?? '',
    project_link: row.project_link ?? '',
    api_dashboard: row.api_dashboard ?? '',
    public_api: row.public_api ?? '',
    img_url: row.img_url ?? '',
    status: (row.status ?? 'incoming').toLowerCase(),
    created_at: fmtTs(row.created_at),
    created_date: fmtTs(row.created_at),
  }
}

function rowTeamMember(row) {
  const status = (row.status ?? 'active').toLowerCase()
  return {
    member_id: row.member_id,
    id: row.member_id,
    member_name: row.member_name ?? '',
    mem_phone: row.mem_phone ?? '',
    mem_designation: row.mem_designation ?? '',
    mem_description: row.mem_description ?? '',
    mem_mail: row.mem_mail ?? '',
    details: row.details ?? '',
    mem_photo: row.mem_photo ?? '',
    img_url: row.mem_photo ?? '',
    status,
    member_status: status,
    created_at: fmtTs(row.created_at),
    created_date: fmtTs(row.created_at),
  }
}

function rowBlog(row) {
  return {
    blog_id: row.blog_id,
    id: row.blog_id,
    blog_title: row.blog_title ?? '',
    date: fmtDate(row.date),
    blog_content: row.blog_content ?? '',
    blog_link: row.blog_link ?? '',
    img_url: row.img_url ?? '',
    status: (row.status ?? 'incoming').toLowerCase(),
    created_at: fmtTs(row.created_at),
    created_date: fmtTs(row.created_at),
    blog_status: (row.status ?? 'incoming').toLowerCase(),
  }
}

function rowContact(row) {
  return {
    id: row.contact_id,
    contact_id: row.contact_id,
    name: row.name ?? '',
    email: row.email ?? '',
    message: row.message ?? '',
    created_at: fmtTs(row.created_at),
    date: fmtTs(row.created_at),
    created_date: fmtTs(row.created_at),
  }
}

function rowInvoice(row) {
  const num = (v) => (v == null ? '' : String(v))
  return {
    invoice_id: row.invoice_id,
    id: row.invoice_id,
    pk: row.invoice_id,
    invoice_no: row.invoice_no ?? '',
    own_com_name: row.own_com_name ?? '',
    own_com_title: row.own_com_title ?? '',
    own_com_logo: row.own_com_logo ?? '',
    client_name: row.client_name ?? '',
    client_id: row.client_id ?? '',
    client_company: row.client_company ?? '',
    client_phone: row.client_phone ?? '',
    client_address: row.client_address ?? '',
    unit_price: num(row.unit_price),
    total_price: num(row.total_price),
    billing_description: row.billing_description ?? '',
    invoice_date: fmtDate(row.invoice_date),
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    created_at: fmtTs(row.created_at),
  }
}

function rowCompany(row) {
  return {
    com_id: row.com_id,
    id: row.com_id,
    pk: row.com_id,
    own_com_name: row.own_com_name ?? '',
    own_com_title: row.own_com_title ?? '',
    own_com_logo: row.own_com_logo ?? '',
    address: row.address ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    description: row.description ?? '',
    created_at: fmtTs(row.created_at),
  }
}

function rowClient(row) {
  const status = (row.status ?? 'active').toLowerCase()
  return {
    client_id: row.client_id,
    id: row.client_id,
    pk: row.client_id,
    name: row.name ?? '',
    client_name: row.name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    company: row.company ?? '',
    address: row.address ?? '',
    notes: row.notes ?? '',
    status,
    client_status: status,
    created_at: fmtTs(row.created_at),
    created_date: fmtTs(row.created_at),
  }
}

export function createUploadRoot() {
  const useTmp =
    process.env.UPLOAD_TMP === '1' || process.env.VERCEL === '1'
  const uploadRoot = useTmp
    ? path.join('/tmp', 'urban-uploads')
    : path.join(process.cwd(), 'uploads')
  fs.mkdirSync(uploadRoot, { recursive: true })
  return uploadRoot
}

export function createApiRouter(pool) {
  const router = express.Router()
  const uploadRoot = createUploadRoot()

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadRoot),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.bin'
      cb(null, `${randomUUID()}${ext}`)
    },
  })
  const uploadFile = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } })
  const uploadNone = multer().none()

  /** Skip multer for JSON/urlencoded; only parse multipart when Content-Type says so. */
  const multipartNone = (req, res, next) => {
    const ct = String(req.headers['content-type'] || '').toLowerCase()
    if (ct.includes('multipart/form-data')) {
      return uploadNone(req, res, (err) => {
        if (err) {
          err.statusCode = err.statusCode || 400
          return next(err)
        }
        next()
      })
    }
    next()
  }

  router.get('/api/ping', (_req, res) => {
    res.json({
      ok: true,
      service: 'urban-api',
      login_post: '/api/users/login/',
      logout_post: '/api/users/logout/',
    })
  })

  router.post(
    '/api/users/login',
    asyncHandler(async (req, res) => {
      const b = req.body && typeof req.body === 'object' ? req.body : {}
      const login = String(
        b.username ??
          b.email ??
          b.user ??
          b.login ??
          ''
      ).trim()
      const password = String(
        b.password ?? b.pass ?? b.password1 ?? ''
      ).trim()
      if (!login || !password) {
        return res.status(400).json({
          detail:
            'Username (or email) and password are required. Send JSON or form-urlencoded body.',
        })
      }
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
        [login, login]
      )
      const row = rows[0]
      const hash = row?.password_hash
      const secretOk =
        hash &&
        (await bcrypt.compare(password, hash).catch(() => false))
      if (!row || !secretOk) {
        return res.status(401).json({ detail: 'Invalid credentials.' })
      }
      const userRole = String(row.role || '').toLowerCase()
      if (!['admin', 'superadmin'].includes(userRole)) {
        return res.status(403).json({ detail: 'Not allowed.' })
      }
      const token = jwt.sign(
        { sub: row.user_id, role: userRole },
        jwtSecret(),
        { expiresIn: '7d' }
      )
      res.json({
        token,
        access: token,
        user: rowUser(row),
        role: userRole,
      })
    })
  )

  router.post(
    '/api/users/logout',
    multipartNone,
    asyncHandler(async (_req, res) => {
      // Bearer JWT is stateless — no server-side session to destroy.
      res.json({
        ok: true,
        detail:
          'Logged out on the API side. Discard the bearer token locally (memory, cookie, storage).',
      })
    })
  )

  router.get(
    '/api/users/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = req.auth.sub
      const [rows] = await pool.execute('SELECT * FROM users WHERE user_id = ?', [id])
      const row = rows[0]
      if (!row) return res.status(404).json({ detail: 'User not found.' })
      res.json(rowUser(row))
    })
  )

  router.get(
    '/api/users',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        'SELECT * FROM users ORDER BY created_date DESC'
      )
      res.json(rows.map(rowUser))
    })
  )

  router.get(
    '/api/users/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [rows] = await pool.execute('SELECT * FROM users WHERE user_id = ?', [id])
      const row = rows[0]
      if (!row) return res.status(404).json({ detail: 'User not found.' })
      res.json(rowUser(row))
    })
  )

  router.get(
    '/api/dashboarduser',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        'SELECT * FROM users ORDER BY created_date DESC'
      )
      res.json(rows.map(rowUser))
    })
  )

  router.get(
    '/api/alluser',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        `SELECT user_id, username, email, role, status
         FROM users
         ORDER BY created_date DESC`
      )
      res.json(rows.map(rowUserDashboard))
    })
  )

  router.get(
    '/api/alluser/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [rows] = await pool.execute('SELECT * FROM users WHERE user_id = ?', [id])
      const row = rows[0]
      if (!row) return res.status(404).json({ detail: 'User not found.' })
      res.json(rowUser(row))
    })
  )

  router.patch(
    '/api/updateusers/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const body = req.body || {}
      const [existingRows] = await pool.execute(
        'SELECT * FROM users WHERE user_id = ?',
        [id]
      )
      if (!existingRows[0]) return res.status(404).json({ detail: 'User not found.' })

      const updates = []
      const vals = []
      if (body.name !== undefined) {
        updates.push('name = ?')
        vals.push(String(body.name))
      }
      if (body.email !== undefined) {
        updates.push('email = ?')
        vals.push(String(body.email))
      }
      if (body.username !== undefined) {
        updates.push('username = ?')
        vals.push(String(body.username))
      }
      if (body.role !== undefined) {
        updates.push('role = ?')
        vals.push(String(body.role))
      }
      if (body.status !== undefined) {
        updates.push('status = ?')
        vals.push(String(body.status).toLowerCase())
      }
      if (body.password !== undefined && String(body.password).trim()) {
        updates.push('password_hash = ?')
        vals.push(await bcrypt.hash(String(body.password), 10))
      }
      if (!updates.length) {
        return res.json(rowUser(existingRows[0]))
      }
      vals.push(id)
      await pool.execute(
        `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`,
        vals
      )
      const [after] = await pool.execute('SELECT * FROM users WHERE user_id = ?', [id])
      res.json(rowUser(after[0]))
    })
  )

  router.patch(
    '/api/updateusers/:id/role',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const roleRaw = req.body?.role != null ? String(req.body.role).trim().toLowerCase() : ''
      if (!roleRaw || !['admin', 'superadmin'].includes(roleRaw)) {
        return res.status(400).json({ detail: 'role must be admin or superadmin.' })
      }
      const [result] = await pool.execute(
        'UPDATE users SET role = ? WHERE user_id = ?',
        [roleRaw, id]
      )
      if (!result.affectedRows) return res.status(404).json({ detail: 'User not found.' })
      const [rows] = await pool.execute('SELECT * FROM users WHERE user_id = ?', [id])
      res.json(rowUser(rows[0]))
    })
  )

  router.post(
    '/api/addusers',
    requireAuth,
    asyncHandler(async (req, res) => {
      const body = req.body || {}
      const email = String(body.email || body.username || '').trim()
      const name = String(body.name || '').trim()
      const username = String(body.username || email).trim()
      const role = String(body.role || 'admin').toLowerCase()
      const status = String(body.status || 'active').toLowerCase()
      const pwdRaw = body.password != null ? String(body.password).trim() : ''
      const rawPwd =
        pwdRaw ||
        String(process.env.DEFAULT_NEW_USER_PASSWORD || 'TempPass123!')
      const password_hash = await bcrypt.hash(rawPwd, 10)
      if (!email || !username) {
        return res.status(400).json({ detail: 'Email and username are required.' })
      }
      try {
        const [r] = await pool.execute(
          `INSERT INTO users (username, email, password_hash, name, role, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [username, email, password_hash, name || username, role, status]
        )
        const newId = r.insertId
        const [rows] = await pool.execute(
          'SELECT * FROM users WHERE user_id = ?',
          [newId]
        )
        res.status(201).json(rowUser(rows[0]))
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ detail: 'Username or email already exists.' })
        }
        throw e
      }
    })
  )

  router.delete(
    '/api/deleteusers/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [r] = await pool.execute('DELETE FROM users WHERE user_id = ?', [id])
      if (!r.affectedRows) return res.status(404).json({ detail: 'User not found.' })
      res.status(204).end()
    })
  )

  router.get(
    '/api/superadmin_dashboard',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [[uc]] = await pool.execute('SELECT COUNT(*) AS n FROM users')
      const [[pc]] = await pool.execute('SELECT COUNT(*) AS n FROM projects')
      const [[cc]] = await pool.execute('SELECT COUNT(*) AS n FROM clients')
      const [[tc]] = await pool.execute(
        'SELECT COUNT(*) AS n FROM team_members'
      )
      res.json({
        users: uc.n,
        projects: pc.n,
        clients: cc.n,
        team_members: tc.n,
        results: [],
      })
    })
  )

  router.get(
    '/api/projectdashboard',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        'SELECT * FROM projects ORDER BY created_at DESC'
      )
      res.json(rows.map(rowProject))
    })
  )

  router.get(
    '/api/project_public_dashboard',
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        'SELECT * FROM projects ORDER BY created_at DESC'
      )
      res.json(rows.map(rowProject))
    })
  )

  router.get(
    '/api/projectall/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [rows] = await pool.execute(
        'SELECT * FROM projects WHERE project_id = ?',
        [id]
      )
      if (!rows[0]) return res.status(404).json({ detail: 'Project not found.' })
      res.json(rowProject(rows[0]))
    })
  )

  router.post(
    '/api/add_project',
    requireAuth,
    multipartNone,
    asyncHandler(async (req, res) => {
      const b = req.body || {}
      const ad =
        String(
          b.api_dashboard ??
            b.dashboard_api ??
            b.dashboardApi ??
            ''
        )
      const pu = String(b.public_api ?? b.publicApi ?? '')
      const [r] = await pool.execute(
        `INSERT INTO projects (project_name, date, project_details, project_link, api_dashboard, public_api, img_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(b.project_name || ''),
          b.date || null,
          String(b.project_details || ''),
          String(b.project_link || ''),
          ad,
          pu,
          String(b.img_url || ''),
          String(b.status || 'incoming').toLowerCase(),
        ]
      )
      const [rows] = await pool.execute(
        'SELECT * FROM projects WHERE project_id = ?',
        [r.insertId]
      )
      res.status(201).json(rowProject(rows[0]))
    })
  )

  const handleUpdateProject = asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const b = req.body || {}
      const [existingRows] = await pool.execute(
        'SELECT * FROM projects WHERE project_id = ?',
        [id]
      )
      if (!existingRows[0]) return res.status(404).json({ detail: 'Project not found.' })
      const ex = existingRows[0]
      const mergeStr = (v, fb) =>
        String(
          v ??
            fb ??
            ''
        )

      await pool.execute(
        `UPDATE projects SET project_name = ?, date = ?, project_details = ?, project_link = ?, api_dashboard = ?, public_api = ?, img_url = ?, status = ?
         WHERE project_id = ?`,
        [
          mergeStr(b.project_name, ex.project_name),
          b.date !== undefined ? b.date || null : ex.date,
          mergeStr(b.project_details, ex.project_details),
          mergeStr(b.project_link, ex.project_link),
          mergeStr(
            b.api_dashboard ?? b.dashboard_api ?? b.dashboardApi,
            ex.api_dashboard
          ),
          mergeStr(b.public_api ?? b.publicApi, ex.public_api),
          mergeStr(b.img_url, ex.img_url),
          String(b.status ?? ex.status ?? 'incoming').toLowerCase(),
          id,
        ]
      )
      const [rows] = await pool.execute(
        'SELECT * FROM projects WHERE project_id = ?',
        [id]
      )
      res.json(rowProject(rows[0]))
    })

  router.patch(
    '/api/update_project/:id',
    requireAuth,
    multipartNone,
    handleUpdateProject
  )
  router.put(
    '/api/update_project/:id',
    requireAuth,
    multipartNone,
    handleUpdateProject
  )

  router.delete(
    '/api/delete_project/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [r] = await pool.execute(
        'DELETE FROM projects WHERE project_id = ?',
        [id]
      )
      if (!r.affectedRows) return res.status(404).json({ detail: 'Project not found.' })
      res.status(204).end()
    })
  )

  router.get(
    '/api/teammemberdashboard',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        'SELECT * FROM team_members ORDER BY created_at DESC'
      )
      res.json(rows.map(rowTeamMember))
    })
  )

  router.get(
    '/api/teammember_public_dashboard',
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        'SELECT * FROM team_members ORDER BY created_at DESC'
      )
      res.json(rows.map(rowTeamMember))
    })
  )

  router.get(
    '/api/teammemberall/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [rows] = await pool.execute(
        'SELECT * FROM team_members WHERE member_id = ?',
        [id]
      )
      if (!rows[0]) return res.status(404).json({ detail: 'Team member not found.' })
      res.json(rowTeamMember(rows[0]))
    })
  )

  router.post(
    '/api/add_teammember',
    requireAuth,
    multipartNone,
    asyncHandler(async (req, res) => {
      const b = req.body || {}
      const [r] = await pool.execute(
        `INSERT INTO team_members (member_name, mem_phone, mem_designation, mem_description, mem_mail, details, mem_photo, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(b.member_name ?? ''),
          String(b.mem_phone ?? b.phone ?? ''),
          String(b.mem_designation ?? ''),
          String(b.mem_description ?? ''),
          String(b.mem_mail ?? b.email ?? ''),
          String(b.details ?? ''),
          String(b.mem_photo ?? b.img_url ?? b.photo ?? ''),
          String(b.status ?? b.member_status ?? 'active').toLowerCase(),
        ]
      )
      const [rows] = await pool.execute(
        'SELECT * FROM team_members WHERE member_id = ?',
        [r.insertId]
      )
      res.status(201).json(rowTeamMember(rows[0]))
    })
  )

  const handleUpdateTeamMember = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
    const b = req.body || {}
    const [existingRows] = await pool.execute(
      'SELECT * FROM team_members WHERE member_id = ?',
      [id]
    )
    if (!existingRows[0])
      return res.status(404).json({ detail: 'Team member not found.' })
    const ex = existingRows[0]
    const mergeStr = (v, fb) =>
      String(
        v ??
          fb ??
          ''
      )
    await pool.execute(
      `UPDATE team_members SET member_name = ?, mem_phone = ?, mem_designation = ?, mem_description = ?, mem_mail = ?, details = ?, mem_photo = ?, status = ?
       WHERE member_id = ?`,
      [
        mergeStr(b.member_name, ex.member_name),
        mergeStr(b.mem_phone ?? b.phone, ex.mem_phone),
        mergeStr(b.mem_designation, ex.mem_designation),
        mergeStr(b.mem_description, ex.mem_description),
        mergeStr(b.mem_mail ?? b.email, ex.mem_mail),
        mergeStr(b.details, ex.details),
        mergeStr(b.mem_photo ?? b.img_url ?? b.photo, ex.mem_photo ?? ''),
        String(b.status ?? b.member_status ?? ex.status ?? 'active').toLowerCase(),
        id,
      ]
    )
    const [rows] = await pool.execute(
      'SELECT * FROM team_members WHERE member_id = ?',
      [id]
    )
    res.json(rowTeamMember(rows[0]))
  })

  router.patch(
    '/api/update_teammember/:id',
    requireAuth,
    multipartNone,
    handleUpdateTeamMember
  )
  router.put(
    '/api/update_teammember/:id',
    requireAuth,
    multipartNone,
    handleUpdateTeamMember
  )

  router.delete(
    '/api/delete_teammember/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [r] = await pool.execute(
        'DELETE FROM team_members WHERE member_id = ?',
        [id]
      )
      if (!r.affectedRows)
        return res.status(404).json({ detail: 'Team member not found.' })
      res.status(204).end()
    })
  )

  router.get(
    '/api/blogdashboard',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        'SELECT * FROM blogs ORDER BY created_at DESC'
      )
      res.json(rows.map(rowBlog))
    })
  )

  router.get(
    '/api/blogall/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [rows] = await pool.execute('SELECT * FROM blogs WHERE blog_id = ?', [id])
      if (!rows[0]) return res.status(404).json({ detail: 'Blog not found.' })
      res.json(rowBlog(rows[0]))
    })
  )

  router.post(
    '/api/add_blog',
    requireAuth,
    multipartNone,
    asyncHandler(async (req, res) => {
      const b = req.body || {}
      const [r] = await pool.execute(
        `INSERT INTO blogs (blog_title, date, blog_content, blog_link, img_url, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          String(b.blog_title || ''),
          b.date || null,
          String(b.blog_content || ''),
          String(b.blog_link || ''),
          String(b.img_url || ''),
          String(b.status || 'incoming').toLowerCase(),
        ]
      )
      const [rows] = await pool.execute(
        'SELECT * FROM blogs WHERE blog_id = ?',
        [r.insertId]
      )
      res.status(201).json(rowBlog(rows[0]))
    })
  )

  router.patch(
    '/api/update_blog/:id',
    requireAuth,
    multipartNone,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const b = req.body || {}
      const [existingRows] = await pool.execute(
        'SELECT * FROM blogs WHERE blog_id = ?',
        [id]
      )
      if (!existingRows[0]) return res.status(404).json({ detail: 'Blog not found.' })
      const cur = existingRows[0]
      await pool.execute(
        `UPDATE blogs SET blog_title = ?, date = ?, blog_content = ?, blog_link = ?, img_url = ?, status = ?
         WHERE blog_id = ?`,
        [
          String(b.blog_title ?? cur.blog_title ?? ''),
          b.date !== undefined ? b.date || null : cur.date,
          String(b.blog_content ?? cur.blog_content ?? ''),
          String(b.blog_link ?? cur.blog_link ?? ''),
          String(b.img_url ?? cur.img_url ?? ''),
          String(b.status ?? cur.status ?? 'incoming').toLowerCase(),
          id,
        ]
      )
      const [rows] = await pool.execute('SELECT * FROM blogs WHERE blog_id = ?', [id])
      res.json(rowBlog(rows[0]))
    })
  )

  router.delete(
    '/api/delete_blog/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [r] = await pool.execute('DELETE FROM blogs WHERE blog_id = ?', [id])
      if (!r.affectedRows) return res.status(404).json({ detail: 'Blog not found.' })
      res.status(204).end()
    })
  )

  router.post(
    '/api/save_contacts',
    asyncHandler(async (req, res) => {
      const body = req.body || {}
      const name = String(body.name || '').trim()
      const email = String(body.email || '').trim()
      const message = String(body.message || '').trim()
      if (!name || !email || !message) {
        return res.status(400).json({ detail: 'Name, email, and message are required.' })
      }
      const [r] = await pool.execute(
        'INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)',
        [name, email, message]
      )
      res.status(201).json({
        id: r.insertId,
        contact_id: r.insertId,
        name,
        email,
        message,
      })
    })
  )

  router.get(
    '/api/contacts',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        'SELECT * FROM contacts ORDER BY created_at DESC'
      )
      res.json(rows.map(rowContact))
    })
  )

  router.delete(
    '/api/delete_contacts/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [r] = await pool.execute(
        'DELETE FROM contacts WHERE contact_id = ?',
        [id]
      )
      if (!r.affectedRows) return res.status(404).json({ detail: 'Contact not found.' })
      res.status(204).end()
    })
  )

  router.get(
    '/api/invoices',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        'SELECT * FROM invoices ORDER BY created_at DESC'
      )
      res.json(rows.map(rowInvoice))
    })
  )

  router.get(
    '/api/invoices/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [rows] = await pool.execute(
        'SELECT * FROM invoices WHERE invoice_id = ?',
        [id]
      )
      if (!rows[0]) return res.status(404).json({ detail: 'Invoice not found.' })
      res.json(rowInvoice(rows[0]))
    })
  )

  router.get(
    '/api/invoice_generate/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [rows] = await pool.execute(
        'SELECT * FROM invoices WHERE invoice_id = ?',
        [id]
      )
      if (!rows[0]) return res.status(404).json({ detail: 'Invoice not found.' })
      res.json(rowInvoice(rows[0]))
    })
  )

  router.post(
    '/api/add_invoice',
    requireAuth,
    asyncHandler(async (req, res) => {
      const b = req.body || {}
      const invoiceNoRaw =
        b.invoice_no != null && String(b.invoice_no).trim()
          ? String(b.invoice_no).trim()
          : null
      const [r] = await pool.execute(
        `INSERT INTO invoices (
          invoice_no, own_com_name, own_com_title, own_com_logo,
          client_name, client_id, client_company, client_phone, client_address,
          unit_price, total_price, billing_description, invoice_date, subtotal, discount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceNoRaw,
          String(b.own_com_name || ''),
          String(b.own_com_title || ''),
          String(b.own_com_logo || ''),
          String(b.client_name || ''),
          String(b.client_id || ''),
          String(b.client_company || ''),
          String(b.client_phone || ''),
          String(b.client_address || ''),
          parseFloat(String(b.unit_price || 0).replace(/,/g, '')) || 0,
          parseFloat(String(b.total_price || 0).replace(/,/g, '')) || 0,
          String(b.billing_description || ''),
          b.invoice_date || null,
          parseFloat(String(b.subtotal || 0).replace(/,/g, '')) || 0,
          parseFloat(String(b.discount || 0).replace(/,/g, '')) || 0,
        ]
      )
      const [rows] = await pool.execute(
        'SELECT * FROM invoices WHERE invoice_id = ?',
        [r.insertId]
      )
      res.status(201).json(rowInvoice(rows[0]))
    })
  )

  router.patch(
    '/api/update_invoice/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [existingRows] = await pool.execute(
        'SELECT * FROM invoices WHERE invoice_id = ?',
        [id]
      )
      if (!existingRows[0]) return res.status(404).json({ detail: 'Invoice not found.' })
      const cur = existingRows[0]
      const b = req.body || {}

      const invoice_no =
        b.invoice_no !== undefined
          ? String(b.invoice_no).trim() || null
          : cur.invoice_no
      const own_com_name =
        b.own_com_name !== undefined ? String(b.own_com_name) : cur.own_com_name
      const own_com_title =
        b.own_com_title !== undefined ? String(b.own_com_title) : cur.own_com_title
      const own_com_logo =
        b.own_com_logo !== undefined ? String(b.own_com_logo) : cur.own_com_logo
      const client_name =
        b.client_name !== undefined ? String(b.client_name) : cur.client_name
      const client_id =
        b.client_id !== undefined ? String(b.client_id) : cur.client_id
      const client_company =
        b.client_company !== undefined ? String(b.client_company) : cur.client_company
      const client_phone =
        b.client_phone !== undefined ? String(b.client_phone) : cur.client_phone
      const client_address =
        b.client_address !== undefined ? String(b.client_address) : cur.client_address
      const billing_description =
        b.billing_description !== undefined
          ? String(b.billing_description)
          : cur.billing_description
      const invoice_date =
        b.invoice_date !== undefined ? b.invoice_date || null : cur.invoice_date

      const unit_price =
        b.unit_price !== undefined
          ? parseFloat(String(b.unit_price).replace(/,/g, '')) || 0
          : cur.unit_price
      const total_price =
        b.total_price !== undefined
          ? parseFloat(String(b.total_price).replace(/,/g, '')) || 0
          : cur.total_price
      const subtotal =
        b.subtotal !== undefined
          ? parseFloat(String(b.subtotal).replace(/,/g, '')) || 0
          : cur.subtotal
      const discount =
        b.discount !== undefined
          ? parseFloat(String(b.discount).replace(/,/g, '')) || 0
          : cur.discount

      await pool.execute(
        `UPDATE invoices SET
          invoice_no = ?, own_com_name = ?, own_com_title = ?, own_com_logo = ?,
          client_name = ?, client_id = ?, client_company = ?, client_phone = ?, client_address = ?,
          unit_price = ?, total_price = ?, billing_description = ?, invoice_date = ?, subtotal = ?, discount = ?
        WHERE invoice_id = ?`,
        [
          invoice_no,
          own_com_name,
          own_com_title,
          own_com_logo,
          client_name,
          client_id,
          client_company,
          client_phone,
          client_address,
          unit_price,
          total_price,
          billing_description,
          invoice_date,
          subtotal,
          discount,
          id,
        ]
      )
      const [rows] = await pool.execute(
        'SELECT * FROM invoices WHERE invoice_id = ?',
        [id]
      )
      res.json(rowInvoice(rows[0]))
    })
  )

  router.delete(
    '/api/delete_invoice/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [r] = await pool.execute(
        'DELETE FROM invoices WHERE invoice_id = ?',
        [id]
      )
      if (!r.affectedRows) return res.status(404).json({ detail: 'Invoice not found.' })
      res.status(204).end()
    })
  )

  router.get(
    '/api/companyinfo',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        'SELECT * FROM companyinfo ORDER BY created_at DESC'
      )
      res.json(rows.map(rowCompany))
    })
  )

  router.get(
    '/api/companyinfo/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [rows] = await pool.execute(
        'SELECT * FROM companyinfo WHERE com_id = ?',
        [id]
      )
      if (!rows[0]) return res.status(404).json({ detail: 'Company not found.' })
      res.json(rowCompany(rows[0]))
    })
  )

  router.post(
    '/api/add_companyinfo',
    requireAuth,
    multipartNone,
    asyncHandler(async (req, res) => {
      const b = req.body || {}
      const [r] = await pool.execute(
        `INSERT INTO companyinfo (own_com_name, own_com_title, own_com_logo, address, phone, email, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          String(b.own_com_name || ''),
          String(b.own_com_title || ''),
          String(b.own_com_logo || ''),
          String(b.address || ''),
          String(b.phone || ''),
          String(b.email || ''),
          String(b.description || ''),
        ]
      )
      const [rows] = await pool.execute(
        'SELECT * FROM companyinfo WHERE com_id = ?',
        [r.insertId]
      )
      res.status(201).json(rowCompany(rows[0]))
    })
  )

  router.patch(
    '/api/update_companyinfo/:id',
    requireAuth,
    multipartNone,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const b = req.body || {}
      const [existingRows] = await pool.execute(
        'SELECT * FROM companyinfo WHERE com_id = ?',
        [id]
      )
      if (!existingRows[0]) return res.status(404).json({ detail: 'Company not found.' })
      const cur = existingRows[0]
      await pool.execute(
        `UPDATE companyinfo SET own_com_name = ?, own_com_title = ?, own_com_logo = ?, address = ?, phone = ?, email = ?, description = ?
         WHERE com_id = ?`,
        [
          String(b.own_com_name ?? cur.own_com_name ?? ''),
          String(b.own_com_title ?? cur.own_com_title ?? ''),
          String(b.own_com_logo ?? cur.own_com_logo ?? ''),
          String(b.address ?? cur.address ?? ''),
          String(b.phone ?? cur.phone ?? ''),
          String(b.email ?? cur.email ?? ''),
          String(b.description ?? cur.description ?? ''),
          id,
        ]
      )
      const [rows] = await pool.execute(
        'SELECT * FROM companyinfo WHERE com_id = ?',
        [id]
      )
      res.json(rowCompany(rows[0]))
    })
  )

  router.delete(
    '/api/delete_companyinfo/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [r] = await pool.execute(
        'DELETE FROM companyinfo WHERE com_id = ?',
        [id]
      )
      if (!r.affectedRows) return res.status(404).json({ detail: 'Company not found.' })
      res.status(204).end()
    })
  )

  router.get(
    '/api/clientdashboard',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        'SELECT * FROM clients ORDER BY created_at DESC'
      )
      res.json(rows.map(rowClient))
    })
  )

  router.get(
    '/api/client_public_dashboard',
    asyncHandler(async (_req, res) => {
      const [rows] = await pool.execute(
        'SELECT * FROM clients ORDER BY created_at DESC'
      )
      res.json(rows.map(rowClient))
    })
  )

  router.get(
    '/api/clientall/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id, 10)
      if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
      const [rows] = await pool.execute(
        'SELECT * FROM clients WHERE client_id = ?',
        [id]
      )
      if (!rows[0]) return res.status(404).json({ detail: 'Client not found.' })
      res.json(rowClient(rows[0]))
    })
  )

  const handleAddClient = asyncHandler(async (req, res) => {
    const b = req.body || {}
    const name = String(b.client_name ?? b.name ?? '').trim()
    const email = String(b.client_email ?? b.email ?? '').trim()
    const [r] = await pool.execute(
      `INSERT INTO clients (name, email, phone, company, address, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email,
        String(b.client_phone ?? b.phone ?? ''),
        String(b.client_company ?? b.company ?? ''),
        String(b.client_address ?? b.address ?? ''),
        String(b.notes ?? ''),
        String(b.client_status ?? b.status ?? 'active').toLowerCase(),
      ]
    )
    const [rows] = await pool.execute(
      'SELECT * FROM clients WHERE client_id = ?',
      [r.insertId]
    )
    res.status(201).json(rowClient(rows[0]))
  })

  router.post(
    '/api/addclient',
    requireAuth,
    multipartNone,
    handleAddClient
  )
  router.post(
    '/api/add_client',
    requireAuth,
    multipartNone,
    handleAddClient
  )

  const handleUpdateClient = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
    const b = req.body || {}
    const [existingRows] = await pool.execute(
      'SELECT * FROM clients WHERE client_id = ?',
      [id]
    )
    if (!existingRows[0]) return res.status(404).json({ detail: 'Client not found.' })
    const ex = existingRows[0]
    const mergeStr = (v, fb) =>
      String(v !== undefined && v !== null ? v : fb ?? '')
    const nameProvided =
      b.client_name !== undefined || b.name !== undefined
    const emailProvided =
      b.client_email !== undefined || b.email !== undefined
    const nextName = nameProvided
      ? String(b.client_name ?? b.name ?? '').trim()
      : String(ex.name ?? '')
    const nextEmail = emailProvided
      ? String(b.client_email ?? b.email ?? '').trim()
      : String(ex.email ?? '')
    await pool.execute(
      `UPDATE clients SET name = ?, email = ?, phone = ?, company = ?, address = ?, notes = ?, status = ?
       WHERE client_id = ?`,
      [
        nextName,
        nextEmail,
        mergeStr(b.client_phone ?? b.phone, ex.phone),
        mergeStr(b.client_company ?? b.company, ex.company),
        mergeStr(b.client_address ?? b.address, ex.address),
        mergeStr(b.notes, ex.notes),
        String(
          b.client_status ?? b.status ?? ex.status ?? 'active'
        ).toLowerCase(),
        id,
      ]
    )
    const [rows] = await pool.execute(
      'SELECT * FROM clients WHERE client_id = ?',
      [id]
    )
    res.json(rowClient(rows[0]))
  })

  router.patch(
    '/api/updateclient/:id',
    requireAuth,
    multipartNone,
    handleUpdateClient
  )
  router.put(
    '/api/updateclient/:id',
    requireAuth,
    multipartNone,
    handleUpdateClient
  )
  router.patch(
    '/api/update_client/:id',
    requireAuth,
    multipartNone,
    handleUpdateClient
  )
  router.put(
    '/api/update_client/:id',
    requireAuth,
    multipartNone,
    handleUpdateClient
  )

  const handleDeleteClient = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ detail: 'Invalid id.' })
    const [r] = await pool.execute(
      'DELETE FROM clients WHERE client_id = ?',
      [id]
    )
    if (!r.affectedRows) return res.status(404).json({ detail: 'Client not found.' })
    res.status(204).end()
  })

  router.delete('/api/deleteclient/:id', requireAuth, handleDeleteClient)
  router.delete('/api/delete_client/:id', requireAuth, handleDeleteClient)

  router.post(
    '/api/upload',
    requireAuth,
    uploadFile.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ detail: 'No file uploaded.' })
      }
      const url = `${publicBaseUrl(req)}/uploads/${req.file.filename}`
      res.status(201).json({ url, img_url: url, path: url })
    })
  )

  router.use((err, _req, res, _next) => {
    console.error(err)
    const status = err.statusCode || err.status || 500
    const msg = err.message || 'Internal server error'
    res.status(status).json({ detail: msg })
  })

  return router
}
