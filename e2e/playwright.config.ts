import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { TEST_RESULTS_ROOT } from "./lib/harness.js";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: join(TEST_RESULTS_ROOT, "playwright"),
  globalSetup: "./scripts/playwright-global-setup.ts",
  globalTeardown: "./scripts/playwright-global-teardown.ts",
  timeout: 2 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [
    ["list"],
    ["html", { outputFolder: join(TEST_RESULTS_ROOT, "playwright-report"), open: "never" }],
  ],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
