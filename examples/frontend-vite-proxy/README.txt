How to fix 404 on http://127.0.0.1:5177/api/...

Option A — Proxy (same-origin URLs like /api/clientdashboard):
  Copy vite.config.example.ts into your frontend Vite project (adjust plugins/target port).
  Restart npm run dev on the frontend.

Option B — Full API URL (no proxy):
  In frontend .env set:
    VITE_API_BASE_URL=http://127.0.0.1:8000
  Call:
    `${import.meta.env.VITE_API_BASE_URL}/api/clientdashboard`
  Header for protected routes:
    Authorization: Bearer <token>

The Urban API must be running (npm run dev in urbanbackend).
