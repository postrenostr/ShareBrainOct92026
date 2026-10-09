import { defineConfig } from "vitest/config";
import path from "node:path";

// Explicit opt-in: the ordinary setup replaces DATABASE_URL with a dummy value.
// This configuration tests only isolated development DB fixtures, not providers.
export default defineConfig({
  resolve: { alias: { "@shared": path.resolve("shared") } },
  test: {
    environment: "node",
    include: ["server/services/tenWords/apiKeys.db.test.ts", "server/services/tenWords/hdUpgradeJob.db.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
