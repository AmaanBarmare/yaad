import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Mirror the production Vercel "services" routing: the frontend calls /api/*
    // and the backend is mounted at /api. Locally, proxy /api to uvicorn and
    // strip the prefix so the FastAPI routes (/customers, /billing/...) match.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
