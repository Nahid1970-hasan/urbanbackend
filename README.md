# Urban API

Node.js (**Express**) + **MySQL** REST API — **backend only**. Frontend / admin SPA lives in a separate repo.

## Requirements

- **Node.js 18+**
- **MySQL** (local dev) or a **hosted MySQL** (PlanetScale-compatible, Railway, AWS RDS, etc.) for production

## Setup

```bash
npm install
cp .env.example .env
# Edit .env — especially MYSQL_* and JWT_SECRET
npm run dev
```

API listens on `http://127.0.0.1:8000` unless `PORT` is set.

## Endpoints overview

Routes are mounted with an `/api/...` prefix (see `src/routes/api.js`). Examples:

- `GET /` — short JSON pointing to health + login URLs (also wired on Vercel via `vercel.json`)
- `GET /api/ping` — health
- `POST /api/users/login/` — JWT login (`username`, `password` as JSON body)
- `GET /api/users/me/` — current user (requires `Authorization: Bearer <token>`)

## Vercel

- `api/index.js` runs the Express app as a Serverless Function (with a try/catch so startup failures return **503 JSON** instead of crashing the function).
- `vercel.json` rewrites `/`, `/api/*`, and `/uploads/*` to that handler.
- **`schema.sql`** is bundled with the function via `includeFiles` so table creation can run on cold start.

Configure in Vercel (Project → Settings → Environment Variables):

| Variable | Notes |
|----------|--------|
| `MYSQL_HOST` | **Required** — hostname of a **public** MySQL (never `127.0.0.1` / `localhost` on Vercel) |
| `MYSQL_PORT` | Usually `3306` |
| `MYSQL_USER` | |
| `MYSQL_PASSWORD` | |
| `MYSQL_DATABASE` | Existing database name (we skip `CREATE DATABASE` on Vercel) |
| `MYSQL_SSL` | Set to **`1`** for most cloud providers |
| `JWT_SECRET` | Long random string |
| `PUBLIC_BASE_URL` | e.g. `https://urban-api.example.com` (no trailing slash) |
| `FRONTEND_ORIGIN` | Your admin SPA origin(s), comma-separated |

Optional:

| Variable | Meaning |
|----------|--------|
| `SKIP_DB_BOOTSTRAP=true` | Do not run `schema.sql` on startup (tables must already exist). |
| `API_DEBUG_ERRORS=1` | Return real error messages in the 503 body (debug only). |

On first boot (unless `SKIP_DB_BOOTSTRAP=true`), **`schema.sql`** is applied and an admin is seeded when `users` is empty (`SEED_ADMIN_*`).

## Frontend (separate project)

Your React/Vite SPA should call **this API’s origin**, not the Vite dev port.

- **Wrong:** `http://127.0.0.1:5177/api/...` — `5177` is the **frontend** dev server. It does not run Express, so `/api` requests fail or show **`net::ERR_CONNECTION_RESET`** unless you add a proxy (below).
- **Right:** `http://127.0.0.1:8000/api/...` (same host/port as this backend; set `PORT` in `.env` if different), **or** set `VITE_API_BASE_URL=http://127.0.0.1:8000` and use that as the base URL for `fetch` / axios.

Example env in the **frontend** repo:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Optional: same-origin `/api` on port 5177 (Vite proxy)

If you want relative URLs like `fetch('/api/add_project')` while Vite runs on `5177`, add a dev proxy so `/api` is forwarded to this server:

```ts
// vite.config.ts (frontend project)
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
```

Restart `npm run dev` on the frontend after changing Vite config.

This API is configured via its own env (e.g. `PUBLIC_BASE_URL`) — **not** via `VITE_*` in this repository.

