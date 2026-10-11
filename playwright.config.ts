import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

// Сквозные тесты. Локально используют установленный Edge (ничего не скачивается),
// в CI — Chromium, который ставит `npx playwright install chromium`.
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "ru-RU",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        ...(process.env.CI ? {} : { channel: process.env.BROWSER_CHANNEL ?? "msedge" }),
      },
    },
  ],
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
