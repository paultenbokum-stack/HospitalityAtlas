import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load local env for the drizzle-kit CLI (Next loads .env.local itself at runtime).
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
