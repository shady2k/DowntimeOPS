import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./client/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:5174",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "bun run dev:server",
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "bun run dev:client",
      port: 5174,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
