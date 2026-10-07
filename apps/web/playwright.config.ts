import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 3100;
// Absolute, because the standalone server changes its working directory.
const dataDir = `pglite:${resolve(".data", `e2e-${Date.now()}`)}`;

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
    // The same self-contained server as in the container image (output: "standalone").
    command: [
      "node scripts/seed.ts --e2e",
      "rm -rf .next/standalone/apps/web/.next/static",
      "cp -r .next/static .next/standalone/apps/web/.next/static",
      `PORT=${port} HOSTNAME=127.0.0.1 node .next/standalone/apps/web/server.js`,
    ].join(" && "),
    url: `http://127.0.0.1:${port}`,
    env: {
      DATABASE_URL: dataDir,
      DATABASE_MIGRATIONS_DIR: resolve(process.cwd(), "../../packages/db/drizzle"),
      BLOB_STORE: "memory",
      // Test-only key (32 zero bytes); production refuses to start without a real one.
      BLOB_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
      NEXT_TELEMETRY_DISABLED: "1",
      LLM_PROVIDER: "mock",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
