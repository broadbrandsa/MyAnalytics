import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Load local Supabase creds for integration tests (RLS, sync idempotency).
config({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
