import { defineConfig, devices } from "@playwright/test";

// Runs against a live stack: `docker compose up -d` (default) or E2E_BASE_URL=http://localhost:5173 for the dev server.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    ...devices["Pixel 7"],
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    colorScheme: "light",
    trace: "retain-on-failure",
  },
});
