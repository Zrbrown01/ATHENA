import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
  use: {
    baseURL: "http://localhost:3000",
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
