// Kept separate from vite.config.ts: Vitest 3 bundles its own Vite 7 types, which clash with
// Vite 8 plugin types. This file is not part of the tsc project (see tsconfig.node.json).
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'], // e2e/ belongs to Playwright
  },
})
