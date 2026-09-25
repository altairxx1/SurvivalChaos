import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    // PW_CHROMIUM lets you point at a preinstalled browser; otherwise run `npx playwright install chromium`
    launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined, args: ['--ignore-gpu-blocklist', '--use-gl=angle'] },
  },
  webServer: { command: 'npx vite --port 5173', port: 5173, reuseExistingServer: true },
});
