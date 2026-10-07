import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  // Platform tables plus module tables (prefixed per module); one migration history for all.
  schema: ["./src/schema.ts", "../../modules/*/*/*/db.ts"],
  out: "./drizzle",
});
