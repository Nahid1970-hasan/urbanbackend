import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ detail: 'Unauthorized' })
  }
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret-change-me'
    req.auth = jwt.verify(token, secret)
    next()
  } catch {
    return res.status(401).json({ detail: 'Unauthorized' })
  }
}
