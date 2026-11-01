import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;
const BUILD_PORT = 5200;
const BUILD_DIR = 'node_modules/.cache/test-build'; // not docs/, which is the deployed site

// Browser tests only. Unit tests run under Vitest (npm test).
// @playwright/test is pinned to an exact version because that pins the Chromium build.
export default defineConfig({
  testDir: 'tests',
  testMatch: '*.pw.js',
  fullyParallel: true,
  workers: 4,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `npx vite --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/tests/textures.html`,
    },
    // The real build, served under a subpath like GitHub Pages, so a wrong asset base path 404s.
    {
      command: `npx vite build --logLevel warn --emptyOutDir --outDir ${BUILD_DIR} && npx vite preview --outDir ${BUILD_DIR} --base /Neon-Alley/ --port ${BUILD_PORT} --strictPort`,
      url: `http://localhost:${BUILD_PORT}/Neon-Alley/`,
      timeout: 120_000,
    },
  ],
});
