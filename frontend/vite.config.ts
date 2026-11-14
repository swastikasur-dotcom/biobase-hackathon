import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The analysis API (backend/) runs separately; see the "api" script.
  server: { proxy: { '/api': 'http://localhost:8000' } },
})
