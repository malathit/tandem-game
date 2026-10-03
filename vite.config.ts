import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // The repo is the organisation's user site (tandem-game.github.io), so it is served from the root
  base: '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Playwright's own runner owns these.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
