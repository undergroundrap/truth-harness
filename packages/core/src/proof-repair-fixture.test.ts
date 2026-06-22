import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type ProofBackendCommandRunner } from "./proof-backend.js";
import { writeProofRepairFixtureWorkspace } from "./proof-repair-fixture.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("proof repair fixture", () => {
  it("creates a failed Lean attempt, repair handoff, accepted proof, and satisfied route obligation", async () => {
    const root = await tempRoot();
    let proofRuns = 0;
    const runner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
      }

      proofRuns += 1;
      return proofRuns === 1
        ? { status: 1, stdout: "", stderr: "application type mismatch\n" }
        : { status: 0, stdout: "", stderr: "" };
    };

    const result = await writeProofRepairFixtureWorkspace({
      rootPath: root,
      now: "2026-06-21T12:00:00.000Z",
      writeRunNextPlan: true,
      runner
    });
    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(result).toMatchObject({
      schemaVersion: "truth-harness.proof-repair-fixture.v0",
      localOnly: true,
      networkAccess: "none",
      sourcePath: "Proofs/TruthHarnessRepair.lean",
      rejectedProof: {
        record: {
          status: "rejected",
          trust: "unverified",
          scope: {
            routeId: result.route.route.routeId,
            obligationId: result.obligation.obligationId,
            statement: result.statement
          }
        }
      },
      repairedProof: {
        record: {
          status: "accepted",
          trust: "proved",
          proofCheckerBacked: true,
          scope: {
            routeId: result.route.route.routeId,
            obligationId: result.obligation.obligationId,
            statement: result.statement
          }
        }
      }
    });
    expect(result.rejectedProof.record.stderr).toContain("application type mismatch");
    expect(result.repairRunNext.plan).toMatchObject({
      status: "planned",
      item: {
        kind: "route-obligation",
        obligationKind: "formal-proof",
        proofAttempt: {
          checkId: result.rejectedProof.record.checkId,
          sourceStatus: "unchanged"
        }
      },
      execution: {
        kind: "proof-repair-source-unchanged",
        status: "planned"
      }
    });
    expect(result.routeSatisfaction).toMatchObject({
      obligation: {
        obligationId: result.obligation.obligationId,
        status: "satisfied"
      },
      evidence: {
        kind: "proof",
        trust: "proved",
        status: "accepted",
        proofCheckerBacked: true,
        acceptedProofChecker: true
      }
    });
    expect(result.finalReview.items).not.toContainEqual(
      expect.objectContaining({
        kind: "route-obligation",
        routeId: result.route.route.routeId,
        obligationId: result.obligation.obligationId
      })
    );
    expect(validation.summary.invalidFiles).toBe(0);
    expect(proofRuns).toBe(2);
  });

  it("keeps the route open when Lean is unavailable", async () => {
    const root = await tempRoot();
    const runner: ProofBackendCommandRunner = () => ({
      status: null,
      stdout: "",
      stderr: "",
      error: {
        name: "Error",
        message: "spawn lean ENOENT"
      }
    });

    const result = await writeProofRepairFixtureWorkspace({
      rootPath: root,
      now: "2026-06-21T12:00:00.000Z",
      writeRunNextPlan: false,
      runner
    });

    expect(result.rejectedProof.record.status).toBe("backend-unavailable");
    expect(result.repairedProof.record.status).toBe("backend-unavailable");
    expect(result.repairedProof.record.trust).toBe("unverified");
    expect(result.routeSatisfaction).toBeUndefined();
    expect(result.warnings.join(" ")).toContain("route obligation remains open");
    expect(result.finalReview.items).toContainEqual(
      expect.objectContaining({
        kind: "route-obligation",
        routeId: result.route.route.routeId,
        obligationId: result.obligation.obligationId
      })
    );
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-proof-repair-fixture-"));
  roots.push(root);
  return root;
}
