import { createHash } from "node:crypto";
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
    const proofSource = "example : True := by trivial\n";
    await writeFile(join(root, "Proofs", "Trivial.lean"), proofSource, "utf8");

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
    expect(inspection.files.leanToolchain).toMatchObject({
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      sha256Scope: "file"
    });
    expect(inspection.files.leanFiles.sample[0]).toMatchObject({
      path: "Proofs/Trivial.lean",
      sha256: sha256Hex(proofSource),
      sha256Scope: "file"
    });
    expect(inspection.mathlib.likelyUsesMathlib).toBe(true);
    expect(inspection.declarations).toMatchObject({
      scannedFiles: 1,
      completeProjectScan: true,
      total: 1,
      byKind: {
        theorem: 0,
        lemma: 0,
        example: 1,
        def: 0
      },
      truncated: false
    });
    expect(inspection.declarations.sample[0]).toMatchObject({
      declarationId: expect.stringMatching(/^decl_[a-f0-9]{16}$/u),
      kind: "example",
      path: "Proofs/Trivial.lean",
      line: 1,
      signature: "example : True",
      signatureSha256: sha256Hex("example : True"),
      sourceSha256: sha256Hex(proofSource)
    });
    expect(inspection.proofSafety).toMatchObject({
      scannedFiles: 1,
      completeProjectScan: true,
      blocksProvedTrust: false,
      markers: {
        total: 0,
        truncated: false
      }
    });
    expect(inspection.trustBoundary.noLeanExecution).toBe(true);
    expect(inspection.trustBoundary.proofMarkersBlockProvedTrust).toBe(true);
    expect(inspection.warnings.join(" ")).toContain("does not run Lean");
    expect(inspection.nextActions.join(" ")).toContain("proof check");
  });

  it("surfaces Lean proof placeholders and local assumptions before proof checks run", async () => {
    const root = await tempRoot();
    await mkdir(join(root, "Proofs"), { recursive: true });
    await writeFile(join(root, "lean-toolchain"), "leanprover/lean4:v4.12.0\n", "utf8");
    await writeFile(join(root, "lakefile.lean"), "import Lake\nopen Lake DSL\n", "utf8");
    const gapSource = [
      "-- a comment saying sorry should not count",
      "def quoted : String := \"admit axiom constant\"",
      "axiom fake : False",
      "theorem gap : True := by",
      "  exact ?_",
      "  sorry",
      "constant unchecked : Nat"
    ].join("\n");
    await writeFile(join(root, "Proofs", "Gap.lean"), gapSource, "utf8");

    const inspection = await inspectLeanProject({ rootPath: root });

    expect(inspection.proofSafety.blocksProvedTrust).toBe(true);
    expect(inspection.proofSafety.markers.total).toBe(4);
    expect(inspection.proofSafety.markers.sample.map((marker) => `${marker.kind}:${marker.line}`)).toEqual([
      "axiom:3",
      "hole:5",
      "sorry:6",
      "constant:7"
    ]);
    expect(inspection.proofSafety.markers.sample[0]).toMatchObject({
      path: "Proofs/Gap.lean",
      severity: "blocking"
    });
    const holeMarker = inspection.proofSafety.markers.sample.find((marker) => marker.kind === "hole");
    expect(holeMarker).toMatchObject({
      declaration: {
        declarationId: expect.stringMatching(/^decl_[a-f0-9]{16}$/u),
        kind: "theorem",
        name: "gap",
        path: "Proofs/Gap.lean",
        line: 4,
        column: 1,
        signature: "theorem gap : True",
        signatureSha256: sha256Hex("theorem gap : True")
      },
      repairTarget: {
        repairTargetId: expect.stringMatching(/^lpr_[a-f0-9]{16}$/u),
        sourcePath: "Proofs/Gap.lean",
        sourceSha256: sha256Hex(gapSource),
        markerKind: "hole",
        markerLine: 5,
        markerColumn: 9,
        declarationId: expect.stringMatching(/^decl_[a-f0-9]{16}$/u),
        declarationName: "gap",
        declarationSignatureSha256: sha256Hex("theorem gap : True"),
        afterEditCommands: [
          "truth-harness proof check Proofs/Gap.lean --declaration gap --write",
          expect.stringContaining("proof project <project> --json")
        ],
        evidenceRequired: expect.arrayContaining([
          "edited workspace-local .lean source",
          "proof-safety scan with this marker absent",
          "accepted proof-check record before using the source as proved evidence"
        ]),
        boundary: expect.stringContaining("must not upgrade trust")
      }
    });
    expect(inspection.proofSafety.markers.sample.find((marker) => marker.kind === "sorry")).toMatchObject({
      declaration: {
        kind: "theorem",
        name: "gap",
        signature: "theorem gap : True"
      }
    });
    const axiomMarker = inspection.proofSafety.markers.sample.find((marker) => marker.kind === "axiom");
    expect(axiomMarker?.declaration).toBeUndefined();
    expect(axiomMarker?.repairTarget).toMatchObject({
      repairTargetId: expect.stringMatching(/^lpr_[a-f0-9]{16}$/u),
      sourcePath: "Proofs/Gap.lean",
      sourceSha256: sha256Hex(gapSource),
      markerKind: "axiom",
      markerLine: 3,
      markerColumn: 1,
      afterEditCommands: [
        "truth-harness proof check Proofs/Gap.lean --write",
        expect.stringContaining("proof project <project> --json")
      ]
    });
    expect(axiomMarker?.repairTarget.declarationId).toBeUndefined();
    expect(inspection.proofSafety.markers.sample.find((marker) => marker.kind === "constant")?.declaration).toBeUndefined();
    expect(inspection.declarations.total).toBe(2);
    expect(inspection.declarations.byKind).toMatchObject({
      theorem: 1,
      def: 1
    });
    expect(inspection.declarations.sample.find((declaration) => declaration.kind === "theorem")).toMatchObject({
      declarationId: expect.stringMatching(/^decl_[a-f0-9]{16}$/u),
      kind: "theorem",
      name: "gap",
      signature: "theorem gap : True",
      signatureSha256: sha256Hex("theorem gap : True")
    });
    expect(inspection.warnings.join(" ")).toContain("blocking Lean proof marker");
    expect(inspection.nextActions[0]).toContain("Resolve blocking Lean marker axiom");
  });

  it("reports missing readiness for folders without Lean project metadata", async () => {
    const root = await tempRoot();

    const inspection = await inspectLeanProject({ rootPath: root });

    expect(inspection.readiness).toBe("missing");
    expect(inspection.files.leanFiles.total).toBe(0);
    expect(inspection.proofSafety.scannedFiles).toBe(0);
    expect(inspection.proofSafety.markers.total).toBe(0);
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

function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
