import { describe, expect, it } from "vitest";
import config from "../vitest.config.ts";

describe("test runner resource policy", () => {
  it("bounds workers without weakening failure detection or isolation", () => {
    expect(config.test.maxWorkers).toBe(2);
    expect(config.test.include).toEqual(["packages/**/*.test.ts", "apps/**/*.test.ts", "tools/**/*.test.js"]);
    expect(config.test.testTimeout).toBeUndefined();
    expect(config.test.hookTimeout).toBeUndefined();
    expect(config.test.retry).toBeUndefined();
    expect(config.test.isolate).not.toBe(false);
    expect(config.test.dangerouslyIgnoreUnhandledErrors).not.toBe(true);
  });
});
