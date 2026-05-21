/**
 * Drop this into your FRONTEND repo as vite.config.ts (merge with your plugins).
 *
 * Problem: GET http://127.0.0.1:5177/api/clientdashboard → 404 (Vite is not the API).
 * Fix: Proxy /api (and /uploads) to the Urban API (default http://127.0.0.1:8000).
 *
 * Also ensure backend .env has PORT=8000 (or match `target` below).
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    host: true,
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
