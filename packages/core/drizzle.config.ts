import path from "node:path";
import { defineConfig } from "drizzle-kit";

// Load root .env if DATABASE_URL is not already in the environment
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(path.resolve(__dirname, "../../.env"));
  } catch {
    // Ignore if .env file does not exist
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment or root .env");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
