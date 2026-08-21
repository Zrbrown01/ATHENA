import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "performance-budgets.spec.ts",
  outputDir: "test-results/performance",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ["line"],
    ["json", { outputFile: ".wrangler/browser-performance-report.json" }],
  ],
  use: {
    baseURL: "http://localhost:3101",
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
  },
  projects: [
    {
      name: "chromium-production",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: {
    command:
      "ATHENA_PILOT_PARTNER_USER_IDS=user-maya-chen ATHENA_PILOT_SUPPORT_USER_IDS=support-e2e npx wrangler dev --config dist/server/wrangler.json --port 3101 --persist-to .wrangler/state --show-interactive-dev-session false",
    url: "http://localhost:3101",
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
