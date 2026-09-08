import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "tools/**/*.test.js"],
    // Integration files spawn CLI/verifier processes; CPU-count fan-out oversubscribes them.
    maxWorkers: 2,
    globals: false
  }
});
