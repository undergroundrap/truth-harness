import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Mathlib setup contract (not proof evidence)", () => {
  it("builds the imported moment module and exposes a fail-closed M2 replay", async () => {
    const lakefile = await readFile("docs/examples/lean-mathlib-template/lakefile.lean", "utf8");
    expect(lakefile).toContain("@[default_target]");
    expect(lakefile).toContain("`TruthHarnessMathlib.Moments");
    expect(lakefile).toContain("`TruthHarnessMathlib.SparseIdentity");
    const compose = await readFile("docker-compose.yml", "utf8");
    const replay = compose.split("  sparse-identity-proof:")[1].split("\nvolumes:")[0];
    expect(replay).toContain("<<: *mathlib-proof");
    expect(replay).toContain('"TruthHarnessMathlib.sparse_prime_identity"');
    expect(replay).toContain('"--fail-on-unproved", "--write", "--json"');
    const source = await readFile("docs/examples/lean-mathlib-template/TruthHarnessMathlib/SparseIdentity.lean", "utf8");
    expect(source).toContain("import TruthHarnessMathlib.Moments");
    expect(source).toContain("#print axioms sparse_prime_identity");
    expect(source).toContain("#guard_msgs");
  });

  it("isolates proof dependencies from application sources and excludes host Lake caches", async () => {
    const dockerfile = await readFile("Dockerfile", "utf8");
    const leanEnvironment = dockerfile.split("FROM dependencies AS lean-environment")[1].split("FROM lean-environment AS lean-proof")[0];
    const mathlibDependencies = dockerfile.split("FROM lean-environment AS mathlib-dependencies")[1].split("FROM mathlib-dependencies AS mathlib-proof")[0];
    expect(leanEnvironment).not.toContain("COPY --chown=truth:truth . .");
    expect(leanEnvironment).toContain("elan toolchain install");
    expect(mathlibDependencies).not.toContain("COPY --chown=truth:truth . .");
    expect(mathlibDependencies).toContain("lake-manifest.json");
    expect(mathlibDependencies).toContain("lake exe cache get");
    const runtime = dockerfile.split("FROM mathlib-dependencies AS mathlib-proof")[1].split("FROM sage-math AS all-engines")[0];
    expect(runtime).toContain("COPY --chown=truth:truth . .");
    expect(runtime).toContain("npm run build");
    expect(runtime).toContain("lake build");
    expect(runtime).toContain("npm run proof:mathlib-template:check");
    expect((await readFile(".dockerignore", "utf8")).split(/\r?\n/u)).toContain("**/.lake");
  });

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
