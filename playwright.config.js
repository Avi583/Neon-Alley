import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;

// Browser tests only. Unit tests run under Vitest (npm test).
// @playwright/test is pinned to an exact version because that pins the Chromium build.
export default defineConfig({
  testDir: 'tests',
  testMatch: '*.pw.js',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/tests/textures.html`,
  },
});
