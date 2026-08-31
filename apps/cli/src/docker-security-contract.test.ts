import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Docker security contract", () => {
  it("runs the default container check from the rebuilt immutable image", async () => {
    const [packageJson, compose] = await Promise.all([
      readFile("package.json", "utf8"),
      readFile("docker-compose.yml", "utf8")
    ]);
    const scripts = (JSON.parse(packageJson) as { scripts: Record<string, string> }).scripts;
    const checkStart = compose.indexOf("  check:\n");
    const checkEnd = compose.indexOf("\n  engine-smoke:", checkStart);
    const checkService = compose.slice(checkStart, checkEnd);

    expect(scripts["docker:check"]).toBe("docker compose run --build --rm check");
    expect(checkStart).toBeGreaterThan(-1);
    expect(checkEnd).toBeGreaterThan(checkStart);
    expect(checkService).toContain('network_mode: "none"');
    expect(checkService).toContain('command: ["npm", "run", "check:native"]');
    expect(checkService).not.toContain("volumes:");
    expect(checkService).not.toContain(".:/workspace");
    expect(checkService).not.toContain("truth_harness_node_modules");
  });
});
