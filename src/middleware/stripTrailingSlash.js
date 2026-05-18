/**
 * Normalize Django-style URLs so `/api/foo/` matches routes registered as `/api/foo`.
 */
export function stripTrailingSlash(req, _res, next) {
  const raw = req.url || ''
  const qIndex = raw.indexOf('?')
  const pathPart = qIndex === -1 ? raw : raw.slice(0, qIndex)
  const queryPart = qIndex === -1 ? '' : raw.slice(qIndex)
  if (pathPart !== '/' && pathPart.endsWith('/')) {
    req.url = pathPart.replace(/\/+$/, '') + queryPart
  }
  next()
}
