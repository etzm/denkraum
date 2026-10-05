import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const dataDir = `pglite:./.data/e2e-${Date.now()}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...devices["iPad (gen 7)"],
    // The iPad profile uses WebKit by default; CI and local runs use Chromium with the iPad viewport.
    browserName: "chromium",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `node scripts/seed.ts --e2e && next start -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    env: { DATABASE_URL: dataDir, NEXT_TELEMETRY_DISABLED: "1", LLM_PROVIDER: "mock" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
