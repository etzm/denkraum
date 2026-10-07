import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  // Platform tables plus each module's own tables (docs/module-sdk.md).
  schema: ["./src/schema.ts", "../../modules/*/*/*/db.ts"],
  out: "./drizzle",
});
