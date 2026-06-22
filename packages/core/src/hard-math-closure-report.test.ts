import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeHardMathClosureReport } from "./hard-math-closure-report.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("hard-math closure reports", () => {
  it("writes a schema-validated local finding without dangling temp evidence refs", async () => {
    const root = await tempRoot();

    const written = await writeHardMathClosureReport({
      rootPath: root,
      createdAt: "2026-06-20T12:00:00.000Z",
      completedAt: "2026-06-20T12:00:03.000Z",
      runtime: {
        kind: "docker",
        command: "npm run docker:smt-closure",
        containerized: true
      },
      cases: [
        {
          caseId: "smt-bounded-closure-fixture",
          passed: true,
          requiredTrust: "smt-checked",
          transientWorkspacePath: "/tmp/truth-harness-hard-math-closure-test",
          transientWorkspaceCleaned: true,
          validationPlanId: "plan_example",
          proofGateStatus: "satisfied",
          gateEvidence: [{ kind: "smt", trust: "smt-checked" }],
          executedSteps: 1,
          attachedEvidenceSteps: 1,
          loopStatus: "completed",
          loopStopReason: "no-open-item",
          validationPassed: true,
          validationErrors: 0,
          validationWarnings: 0,
          evidenceSummary: "SMT query bounded_integer_sat closed with smt-checked evidence.",
          warnings: []
        }
      ]
    });

    expect(written.report).toMatchObject({
      schemaVersion: "truth-harness.hard-math-closure.v0",
      localOnly: true,
      networkAccess: "none",
      summary: {
        totalCases: 1,
        passedCases: 1,
        failedCases: 0
      }
    });
    expect(written.markdown).toContain("Truth Harness Hard-Math Closure Report");
    expect(JSON.parse(await readFile(written.jsonPath, "utf8"))).toMatchObject({
      closureId: written.report.closureId
    });

    const validation = await validateWorkspaceArtifacts({ rootPath: root });
    expect(validation.passed).toBe(true);
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "findings",
        artifactId: written.report.closureId,
        schemaVersion: "truth-harness.hard-math-closure.v0",
        issueCodes: []
      })
    );
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-hard-math-closure-report-"));
  roots.push(root);
  return root;
}
