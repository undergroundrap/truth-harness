import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Mathlib setup contract (not proof evidence)", () => {
  it("provides an install-and-offline-check entry point with unchanged pins", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    expect(pkg.scripts["docker:mathlib"]).toBe("npm run docker:mathlib-template:write");
    expect(pkg.scripts["docker:mathlib-template:write"]).toContain("npm run docker:mathlib-template:build && docker compose run --rm mathlib-proof");
    expect(pkg.scripts["proof:mathlib-template:write"]).toContain("--fail-on-unproved --write --json");
    const manifest = JSON.parse(await readFile("docs/examples/lean-mathlib-template/lake-manifest.json", "utf8"));
    expect(manifest.packages.find((p) => p.name === "mathlib").rev).toBe("809c3fb3b5c8f5d7dace56e200b426187516535a");
    expect((await readFile("docs/examples/lean-mathlib-template/lean-toolchain", "utf8")).trim()).toBe("leanprover/lean4:v4.12.0");
  });

  it("checks M1 through the project-aware proof adapter and fails on unproved", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    expect(pkg.scripts["docker:moment"]).toBe("docker compose run --rm mathlib-proof npm run proof:moment:write");
    const command = pkg.scripts["proof:moment:write"];
    expect(command).toContain("--project docs/examples/lean-mathlib-template");
    expect(command).toContain("--declaration TruthHarnessMathlib.moment_coefficients_zero");
    expect(command).toContain("--fail-on-unproved --write --json");
  });
});
