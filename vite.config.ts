import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from /floppy-thoughts/
  base: '/floppy-thoughts/',
  plugins: [react()],
  // Unit tests live next to the code; the browser tests in e2e/ run with Playwright instead.
  test: { include: ['src/**/*.test.ts'] },
})
