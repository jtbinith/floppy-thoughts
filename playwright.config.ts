import { defineConfig, devices } from '@playwright/test'

// Browser tests: they drive the real app in Chromium, clicking and typing like a person,
// to catch the bugs unit tests can't (focus, selection, popups). Run with `npm run test:e2e`.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5181/floppy-thoughts/',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  // Its own dev server on a separate port, only reachable from this machine.
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5181 --strictPort',
    url: 'http://127.0.0.1:5181/floppy-thoughts/',
    reuseExistingServer: false,
  },
})
