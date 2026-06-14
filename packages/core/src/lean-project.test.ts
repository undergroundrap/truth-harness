import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectLeanProject } from "./lean-project.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("Lean project inspection", () => {
  it("detects pinned Lean/Lake project structure without executing Lean", async () => {
    const root = await tempRoot();
    await mkdir(join(root, "Proofs"), { recursive: true });
    await writeFile(join(root, "lean-toolchain"), "leanprover/lean4:v4.12.0\n", "utf8");
    await writeFile(
      join(root, "lakefile.lean"),
      'import Lake\nopen Lake DSL\nrequire mathlib from git "https://github.com/leanprover-community/mathlib4.git"\n',
      "utf8"
    );
    await writeFile(join(root, "lake-manifest.json"), '{"packages":[{"name":"mathlib"}]}\n', "utf8");
    await writeFile(join(root, "Proofs", "Trivial.lean"), "example : True := by trivial\n", "utf8");

    const inspection = await inspectLeanProject({ rootPath: root });

    expect(inspection.schemaVersion).toBe("truth-harness.lean-project-inspection.v0");
    expect(inspection.localOnly).toBe(true);
    expect(inspection.networkAccess).toBe("none");
    expect(inspection.readiness).toBe("ready");
    expect(inspection.toolchain).toMatchObject({
      channel: "leanprover/lean4:v4.12.0",
      pinned: true
    });
    expect(inspection.files.leanFiles.total).toBe(1);
    expect(inspection.files.leanFiles.sample[0]?.path).toBe("Proofs/Trivial.lean");
    expect(inspection.mathlib.likelyUsesMathlib).toBe(true);
    expect(inspection.trustBoundary.noLeanExecution).toBe(true);
    expect(inspection.warnings.join(" ")).toContain("does not run Lean");
    expect(inspection.nextActions.join(" ")).toContain("proof check");
  });

  it("reports missing readiness for folders without Lean project metadata", async () => {
    const root = await tempRoot();

    const inspection = await inspectLeanProject({ rootPath: root });

    expect(inspection.readiness).toBe("missing");
    expect(inspection.files.leanFiles.total).toBe(0);
    expect(inspection.files.leanToolchain).toBeUndefined();
    expect(inspection.files.lakefileLean).toBeUndefined();
    expect(inspection.warnings.join(" ")).toContain("No lean-toolchain file found");
    expect(inspection.nextActions.join(" ")).toContain("Add a lean-toolchain");
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-lean-project-"));
  roots.push(root);
  return root;
}
