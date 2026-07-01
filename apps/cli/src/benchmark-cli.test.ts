import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { createReceipt, writeEngineVerificationRun } from "@truth-harness/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeLeanProofCheckRecord, type ProofBackendCommandRunner } from "../../../packages/core/src/proof-backend.js";
import type { EngineVerificationCommandRunner } from "../../../packages/core/src/engine-verification.js";
import { writeReportDraft } from "../../../packages/core/src/report-draft.js";
import { addResearchSessionCheckpoint } from "../../../packages/core/src/research-session.js";
import { verifierRouteStatementBoundaryHash } from "../../../packages/core/src/verifier-route.js";
import { program } from "./index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("benchmark CLI", () => {
  it("reports CAS backend status without requiring Maxima to be installed", async () => {
    const result = await runCli([
      "cas",
      "backends",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--json"
    ]);
    const json = JSON.parse(result.stdout) as {
      casBackendsAvailable: number;
      backends: Array<{ backendId: string; status: string; canCheckSymbolic: boolean; statusProbeMintedCheck: boolean }>;
      trustBoundary: { statusProbeIsNotCheck: boolean; crossCheckedRequiresIndependentRun: boolean };
    };

    expect(result.exitCode).toBe(0);
    expect(json.casBackendsAvailable).toBe(0);
    expect(json.backends[0]).toMatchObject({
      backendId: "maxima",
      status: "missing",
      canCheckSymbolic: false,
      statusProbeMintedCheck: false
    });
    expect(json.trustBoundary.statusProbeIsNotCheck).toBe(true);
    expect(json.trustBoundary.crossCheckedRequiresIndependentRun).toBe(true);
  });

  it("shows saved Docker reviewer evidence in engine plans without treating host-missing engines as runnable", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--name", "Engine Plan Lab"]);
    const savedRun = await writeEngineVerificationRun({
      rootPath: root,
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      cvc5Command: "cvc5-test",
      leanCommand: "lean-test",
      sageCommand: "sage-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      requirements: {
        maxima: true,
        z3: true,
        cvc5: true,
        lean: true,
        sage: true
      },
      runner: passingEngineRunner
    });

    const jsonResult = await runCli([
      "engines",
      "plan",
      "prove a theorem with Lean and no sorry",
      "--workspace",
      root,
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--json"
    ]);
    const humanResult = await runCli([
      "engines",
      "plan",
      "prove a theorem with Lean and no sorry",
      "--workspace",
      root,
      "--lean-command",
      "truth-harness-missing-lean-command"
    ]);
    const plan = JSON.parse(jsonResult.stdout) as {
      savedReviewerEvidence: { status: string; runId?: string; coveredCapabilityIds: string[]; trustBoundary: string };
      steps: Array<{ capabilityId: string; status: string; canRunNow: boolean; limitation: string }>;
      nextActions: string[];
    };
    const leanStep = plan.steps.find((step) => step.capabilityId === "lean-proof-checker");

    expect(jsonResult.exitCode).toBe(0);
    expect(plan.savedReviewerEvidence).toMatchObject({
      status: "available",
      runId: savedRun.record.runId,
      coveredCapabilityIds: expect.arrayContaining(["lean-proof-checker", "sage-cas"])
    });
    expect(plan.savedReviewerEvidence.trustBoundary).toContain("each new claim still needs its own concrete");
    expect(leanStep).toMatchObject({
      status: "missing",
      canRunNow: false
    });
    expect(leanStep?.limitation).toContain(`Saved reviewer Docker evidence ${savedRun.record.runId} covers this capability`);
    expect(plan.nextActions.join("\n")).toContain(`Saved reviewer Docker evidence ${savedRun.record.runId} previously covered`);
    expect(humanResult.stdout).toContain(`Saved reviewer evidence: Saved strict all-engine Docker reviewer run ${savedRun.record.runId}`);
  });

  it("writes and reopens visual artifacts from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--name", "Visual CLI Lab"]);

    const created = JSON.parse(
      (
        await runCli([
          "visual",
          "create",
          "Exact fraction visual",
          "--workspace",
          root,
          "--kind",
          "concept-map",
          "--renderer",
          "truth-harness-native",
          "--source",
          "manual:cli-visual-test",
          "--payload-format",
          "svg",
          "--payload-text",
          "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 320 180\"><text x=\"20\" y=\"40\">3/4 + 5/8 = 11/8</text></svg>",
          "--tag",
          "fractions",
          "--json"
        ])
      ).stdout
    ) as {
      visual: { schemaVersion: string; visualId: string; kind: string; trustBoundary: { visualDoesNotUpgradeTrust: boolean } };
      jsonPath: string;
      markdownPath: string;
    };
    const listed = JSON.parse((await runCli(["visual", "list", root, "--json"])).stdout) as {
      total: number;
      visuals: Array<{ visualId: string; kind: string; renderer: string }>;
    };
    const shown = JSON.parse(
      (await runCli(["visual", "show", created.visual.visualId, "--workspace", root, "--json"])).stdout
    ) as { visualId: string; payload: { format: string }; warnings: string[] };

    expect(created.visual.schemaVersion).toBe("truth-harness.visual-artifact.v0");
    expect(created.visual.visualId).toMatch(/^vis_[a-f0-9]{16}$/u);
    expect(created.visual.kind).toBe("concept-map");
    expect(created.visual.trustBoundary.visualDoesNotUpgradeTrust).toBe(true);
    expect(created.jsonPath).toContain(".truth-harness");
    expect(created.markdownPath).toContain(".truth-harness");
    expect(listed.total).toBe(1);
    expect(listed.visuals[0]).toMatchObject({
      visualId: created.visual.visualId,
      kind: "concept-map",
      renderer: "truth-harness-native"
    });
    expect(shown.visualId).toBe(created.visual.visualId);
    expect(shown.payload.format).toBe("svg");
    expect(shown.warnings.join("\n")).toContain("not proof by themselves");
  });

  it("writes graph, plot, and canvas visual artifacts from adapters", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--name", "Visual Adapter CLI Lab"]);
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    await writeFile(join(root, ".truth-harness", "receipts", "fraction.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

    const graph = JSON.parse(
      (await runCli(["visual", "graph", "--workspace", root, "--renderer", "graphviz", "--json"])).stdout
    ) as { visual: { kind: string; renderer: { engine: string }; payload: { format: string; content: unknown; rendererSource?: { language: string; content: string; contentHash: string } } } };
    const plot = JSON.parse(
      (await runCli(["visual", "plot", ".truth-harness/receipts/fraction.json", "--workspace", root, "--renderer", "plotly", "--json"])).stdout
    ) as { visual: { visualId: string; kind: string; renderer: { engine: string }; payload: { format: string }; data?: { rows: string[][] } } };
    const renderedPlot = JSON.parse(
      (await runCli(["visual", "render", plot.visual.visualId, "--workspace", root, "--engine", "plotly", "--json"])).stdout
    ) as { renderer: string; sourceVisual: { visualId: string }; visual: { kind: string; renderer: { engine: string; adapter: string }; payload: { format: string; content: string }; sourceRefs: Array<{ kind: string; ref: string }> } };
    const canvas = JSON.parse(
      (await runCli(["visual", "canvas", "--workspace", root, "--json"])).stdout
    ) as { visual: { kind: string; renderer: { engine: string }; payload: { format: string } } };
    const list = JSON.parse((await runCli(["visual", "list", root, "--json"])).stdout) as {
      total: number;
      visuals: Array<{ kind: string; renderer: string }>;
    };

    expect(graph.visual).toMatchObject({
      kind: "lineage-graph",
      renderer: { engine: "graphviz" },
      payload: {
        format: "graph-json",
        rendererSource: { language: "dot" }
      }
    });
    expect(JSON.stringify(graph.visual.payload.content)).toContain("digraph TruthHarnessWorkspace");
    expect(graph.visual.payload.rendererSource?.content).toContain("digraph TruthHarnessWorkspace");
    expect(graph.visual.payload.rendererSource?.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(plot.visual).toMatchObject({
      kind: "plot",
      renderer: { engine: "plotly" },
      payload: { format: "plotly-json" }
    });
    expect(plot.visual.data?.rows.some((row) => row.includes("11/8"))).toBe(true);
    expect(renderedPlot).toMatchObject({
      renderer: "plotly",
      sourceVisual: {
        visualId: plot.visual.visualId
      },
      visual: {
        kind: "plot",
        renderer: {
          engine: "truth-harness-native",
          adapter: "plotly-json-svg-renderer"
        },
        payload: {
          format: "svg"
        }
      }
    });
    expect(renderedPlot.visual.payload.content).toContain("<svg");
    expect(renderedPlot.visual.sourceRefs[0]).toMatchObject({
      kind: "visual",
      ref: expect.stringContaining(plot.visual.visualId)
    });
    expect(canvas.visual).toMatchObject({
      kind: "mind-map",
      renderer: { engine: "tldraw" },
      payload: { format: "canvas-json" }
    });
    expect(list.total).toBe(4);
    expect(list.visuals.map((visual) => `${visual.kind}/${visual.renderer}`).sort()).toEqual([
      "lineage-graph/graphviz",
      "mind-map/tldraw",
      "plot/plotly",
      "plot/truth-harness-native"
    ]);
  });

  it("runs the demo gauntlet and writes a shareable HTML report", async () => {
    const root = await tempRoot();
    const reportPath = join(root, "truth-harness-demo-report.html");
    const result = await runCli([
      "demo",
      "--no-color",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--report",
      reportPath
    ]);
    const report = await readFile(reportPath, "utf8");
    const caseCards = report.match(/<section class="case-card">/g) ?? [];

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Truth Harness — Verified Math for AI Agents");
    expect(result.stdout).toContain("[16]");
    expect(result.stdout).toContain("refuted");
    expect(result.stdout).toContain("exact-computed");
    expect(result.stdout).toContain("unverified");
    expect(result.stdout).toContain("dimension-checked");
    expect(result.stdout).toContain("bounded-numeric");
    expect(result.stdout).toContain("SMT Solver");
    expect(result.stdout).toContain("Report:");
    expect(report).toContain("Truth Harness Demo Report");
    expect(caseCards).toHaveLength(16);
    expect(report).toContain("truth-harness ask");
    expect(report).toContain("truth-harness smt check");
    expect(report).toContain("Evidence JSON");
  });

  it("fails the recording demo gate when symbolic cross-checks are unavailable", async () => {
    const root = await tempRoot();
    const reportPath = join(root, "truth-harness-demo-report.html");
    const result = await runCli([
      "demo",
      "--no-color",
      "--require-symbolic-cross-check",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--report",
      reportPath
    ]);
    const report = await readFile(reportPath, "utf8");

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Recording gate failures:");
    expect(result.stdout).toContain("recording gate requires cross-checked");
    expect(result.stdout).toContain("recording gate requires smt-checked");
    expect(report).toContain("Recording Gate Failures");
  });

  it("checks symbolic CAS results without minting trust when Maxima is unavailable", async () => {
    const result = await runCli([
      "cas",
      "check",
      "--operation",
      "simplify",
      "--expression",
      "sin(x)^2 + cos(x)^2",
      "--result",
      "1",
      "--variable",
      "x",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--timeout-ms",
      "50",
      "--json",
      "--fail-on-unverified"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      status: string;
      trust: string;
      proofCheckerBacked: boolean;
      backend: { acceptedProofChecker: boolean };
    };

    expect(result.exitCode).toBe(1);
    expect(json.schemaVersion).toBe("truth-harness.cas-check.v0");
    expect(json.status).toBe("solver-unavailable");
    expect(json.trust).toBe("unverified");
    expect(json.proofCheckerBacked).toBe(false);
    expect(json.backend.acceptedProofChecker).toBe(false);
  });

  it("supports optional cvc5 SMT backend selection without minting trust when unavailable", async () => {
    const root = await tempRoot();
    const source = join(root, "constraints.smt2");
    await writeFile(source, "(set-logic QF_LIA)\n(assert false)\n(check-sat)\n", "utf8");

    const backends = JSON.parse(
      (
        await runCli([
          "smt",
          "backends",
          "--z3-command",
          "truth-harness-missing-z3-command",
          "--cvc5-command",
          "truth-harness-missing-cvc5-command",
          "--json"
        ])
      ).stdout
    ) as { smtSolversAvailable: number; backends: Array<{ backendId: string; status: string }> };
    const check = await runCli([
      "smt",
      "check",
      source,
      "--backend",
      "cvc5",
      "--cvc5-command",
      "truth-harness-missing-cvc5-command",
      "--json",
      "--fail-on-unverified"
    ]);
    const record = JSON.parse(check.stdout) as { backend: { id: string; adapter: string }; status: string; trust: string };

    expect(backends.smtSolversAvailable).toBe(0);
    expect(backends.backends).toContainEqual(expect.objectContaining({ backendId: "z3", status: "missing" }));
    expect(backends.backends).toContainEqual(expect.objectContaining({ backendId: "cvc5", status: "missing" }));
    expect(check.exitCode).toBe(1);
    expect(record.backend).toMatchObject({
      id: "cvc5",
      adapter: "local-cvc5-smtlib-subprocess"
    });
    expect(record.status).toBe("solver-unavailable");
    expect(record.trust).toBe("unverified");
  });

  it("writes and lists CAS check workspace records", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const write = await runCli([
      "cas",
      "check",
      "--operation",
      "simplify",
      "--expression",
      "sin(x)^2 + cos(x)^2",
      "--result",
      "1",
      "--workspace",
      root,
      "--write",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--timeout-ms",
      "50",
      "--json"
    ]);
    const writeJson = JSON.parse(write.stdout) as {
      record: { checkId: string; trust: string };
      result: { jsonPath: string; markdownPath: string };
    };
    const list = JSON.parse((await runCli(["cas", "list", root, "--json"])).stdout) as {
      total: number;
      checks: Array<{ checkId: string; trust: string; path: string }>;
    };

    expect(write.exitCode).toBe(0);
    expect(writeJson.record.trust).toBe("unverified");
    expect(writeJson.result.jsonPath).toContain(".truth-harness");
    expect(writeJson.result.markdownPath).toContain(".truth-harness");
    expect(list.total).toBe(1);
    expect(list.checks[0]).toMatchObject({
      checkId: writeJson.record.checkId,
      trust: "unverified"
    });
    expect(list.checks[0]?.path).toContain(".truth-harness/cas/");
  });

  it("prints an engine manifest for humans and agents", async () => {
    const result = await runCli([
      "engines",
      "--json",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      nativeCount: number;
      adapterCount: number;
      plannedCount: number;
      deterministicCount: number;
      replayDeterministicCount: number;
      machineContract: { jsonFirst: boolean; deterministicTrustRequiresReplayableArtifact: boolean };
      capabilities: Array<{
        id: string;
        status: string;
        canMintTrust: boolean;
        determinism?: { determinismClass: string; primitiveSemantics: string };
      }>;
      trustBoundary: { statusProbeIsNotEvidence: boolean; provedRequiresAcceptedProofCheckerRun: boolean };
    };

    expect(result.exitCode).toBe(0);
    expect(json.schemaVersion).toBe("truth-harness.engine-manifest.v0");
    expect(json.nativeCount).toBeGreaterThan(0);
    expect(json.adapterCount).toBeGreaterThan(0);
    expect(json.plannedCount).toBeGreaterThan(0);
    expect(json.deterministicCount).toBeGreaterThan(0);
    expect(json.replayDeterministicCount).toBeGreaterThan(0);
    expect(json.machineContract.jsonFirst).toBe(true);
    expect(json.machineContract.deterministicTrustRequiresReplayableArtifact).toBe(true);
    expect(json.capabilities).toContainEqual(
      expect.objectContaining({
        id: "lean-proof-checker",
        status: "missing",
        canMintTrust: false,
        determinism: expect.objectContaining({
          determinismClass: "replay-deterministic",
          primitiveSemantics: "formal-proof"
        })
      })
    );
    expect(json.trustBoundary.statusProbeIsNotEvidence).toBe(true);
    expect(json.trustBoundary.provedRequiresAcceptedProofCheckerRun).toBe(true);
  });

  it("prints engine readiness without upgrading status probes into evidence", async () => {
    const result = await runCli([
      "engines",
      "readiness",
      "--json",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--sage-command",
      "truth-harness-missing-sage-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--cvc5-command",
      "truth-harness-missing-cvc5-command"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      status: string;
      summary: { readyClaimClasses: number; readyTrustLabels: string[]; missingExternalEngines: string[] };
      savedEvidence?: { sandboxRun?: unknown };
      gates: Array<{ id: string; status: string; missingClaimClasses: string[] }>;
      claimClasses: Array<{ id: string; status: string; targetTrust: string; missingCapabilityIds: string[] }>;
      trustBoundary: { readinessDoesNotMintEvidence: boolean; provedRequiresAcceptedProofCheckerRun: boolean };
    };

    expect(result.exitCode).toBe(0);
    expect(json.schemaVersion).toBe("truth-harness.engine-readiness.v0");
    expect(json.status).toBe("research-core-ready");
    expect(json.savedEvidence?.sandboxRun).toBeUndefined();
    expect(json.summary.readyClaimClasses).toBeGreaterThan(0);
    expect(json.summary.readyTrustLabels).toEqual(expect.arrayContaining(["exact-computed", "refuted"]));
    expect(json.summary.missingExternalEngines).toEqual(
      expect.arrayContaining(["Maxima independent CAS", "Lean proof checker", "Z3 SMT solver"])
    );
    expect(json.gates).toContainEqual(
      expect.objectContaining({
        id: "math-core",
        status: "ready"
      })
    );
    expect(json.gates).toContainEqual(
      expect.objectContaining({
        id: "professor-review",
        status: "blocked",
        missingClaimClasses: ["independent-cas-cross-check", "smt-constraint-check", "accepted-proof-checking"]
      })
    );
    expect(json.claimClasses).toContainEqual(
      expect.objectContaining({
        id: "accepted-proof-checking",
        status: "blocked",
        targetTrust: "proved",
        missingCapabilityIds: ["lean-proof-checker"]
      })
    );
    expect(json.trustBoundary.readinessDoesNotMintEvidence).toBe(true);
    expect(json.trustBoundary.provedRequiresAcceptedProofCheckerRun).toBe(true);
  });

  it("keeps saved-sandbox readiness lookup conservative when no saved measurement exists", async () => {
    const root = await tempRoot();
    const result = await runCli([
      "engines",
      "readiness",
      "--json",
      "--include-saved-sandbox",
      "--workspace",
      root,
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--sage-command",
      "truth-harness-missing-sage-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--cvc5-command",
      "truth-harness-missing-cvc5-command"
    ]);
    const json = JSON.parse(result.stdout) as {
      savedEvidence?: { sandboxRun?: unknown };
      gates: Array<{ id: string; status: string }>;
    };

    expect(result.exitCode).toBe(0);
    expect(json.savedEvidence?.sandboxRun).toBeUndefined();
    expect(json.gates).toContainEqual(
      expect.objectContaining({
        id: "agent-autonomy",
        status: "blocked"
      })
    );
  });

  it("writes and lists engine evidence runs from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const write = await runCli([
      "engines",
      "verify",
      "--workspace",
      root,
      "--write",
      "--json",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command"
    ]);
    const writeJson = JSON.parse(write.stdout) as {
      record: { schemaVersion: string; runId: string; localOnly: boolean; networkAccess: string; report: { cases: unknown[] } };
      jsonPath: string;
      markdownPath: string;
    };

    expect(write.exitCode).toBe(0);
    expect(writeJson.record.schemaVersion).toBe("truth-harness.engine-run.v0");
    expect(writeJson.record.localOnly).toBe(true);
    expect(writeJson.record.networkAccess).toBe("none");
    expect(writeJson.record.report.cases.length).toBeGreaterThan(0);
    expect(writeJson.jsonPath).toContain(".truth-harness");
    expect(existsSync(writeJson.jsonPath)).toBe(true);
    expect(existsSync(writeJson.markdownPath)).toBe(true);

    const list = JSON.parse((await runCli(["engines", "runs", root, "--json"])).stdout) as Array<{
      runId: string;
      status: string;
      path: string;
    }>;
    expect(list).toContainEqual(
      expect.objectContaining({
        runId: writeJson.record.runId,
        path: expect.stringContaining(".truth-harness/engine-runs/")
      })
    );
  });

  it("fails closed when the strict all-engines evidence gate is requested", async () => {
    const result = await runCli([
      "engines",
      "verify",
      "--json",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--cvc5-command",
      "truth-harness-missing-cvc5-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--sage-command",
      "truth-harness-missing-sage-command",
      "--require-all-engines"
    ]);
    const report = JSON.parse(result.stdout) as {
      status: string;
      requiredPassed: number;
      requiredTotal: number;
      cases: Array<{ id: string; required: boolean; status: string }>;
    };

    expect(result.exitCode).toBe(1);
    expect(report.status).toBe("failed");
    expect(report.requiredPassed).toBe(0);
    expect(report.requiredTotal).toBe(5);
    expect(report.cases.filter((entry) => entry.required).map((entry) => entry.id).sort()).toEqual([
      "cvc5-smt-check",
      "lean-proof-fixture",
      "maxima-symbolic-cross-check",
      "sage-symbolic-cross-check",
      "z3-smt-check"
    ]);
    expect(report.cases.filter((entry) => entry.required).every((entry) => entry.status === "missing")).toBe(true);
  });

  it("rebuilds and searches the workspace catalog from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    await writeFile(join(root, ".truth-harness", "receipts", "fraction.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    const claim = JSON.parse(
      (
        await runCli([
          "claim",
          "add",
          "3 / 4 + 5 / 8 equals 11 / 8.",
          "--workspace",
          root,
          "--domain",
          "math",
          "--trust",
          "exact-computed",
          "--evidence",
          "receipt:.truth-harness/receipts/fraction.json",
          "--json"
        ])
      ).stdout
    ) as { claim: { claimId: string } };

    const missingStatus = JSON.parse((await runCli(["catalog", "status", root, "--json"])).stdout) as {
      readable: boolean;
      stale: boolean;
    };
    const rebuild = JSON.parse((await runCli(["catalog", "rebuild", root, "--json"])).stdout) as {
      schemaVersion: string;
      artifactCount: number;
      validation: { passed: boolean };
    };
    const search = JSON.parse(
      (await runCli(["catalog", "search", "11/8", "--workspace", root, "--kind", "receipts", "--trust", "exact-computed", "--json"])).stdout
    ) as {
      schemaVersion: string;
      total: number;
      results: Array<{ kind: string; trust: string; path: string }>;
      warnings: string[];
    };
    const refSearch = JSON.parse(
      (await runCli(["catalog", "search", "--workspace", root, "--kind", "claims", "--ref", ".truth-harness/receipts/fraction.json", "--json"]))
        .stdout
    ) as {
      schemaVersion: string;
      filters: { ref?: string };
      results: Array<{ kind: string; artifactId?: string }>;
    };
    const human = await runCli(["catalog", "search", "11/8", "--workspace", root, "--kind", "receipts"]);

    expect(missingStatus.readable).toBe(false);
    expect(missingStatus.stale).toBe(true);
    expect(rebuild.schemaVersion).toBe("truth-harness.catalog-rebuild.v0");
    expect(rebuild.validation.passed).toBe(true);
    expect(rebuild.artifactCount).toBeGreaterThanOrEqual(2);
    expect(search.schemaVersion).toBe("truth-harness.catalog-search.v0");
    expect(search.results).toContainEqual(
      expect.objectContaining({
        kind: "receipts",
        trust: "exact-computed",
        path: ".truth-harness/receipts/fraction.json"
      })
    );
    expect(refSearch.filters.ref).toBe(".truth-harness/receipts/fraction.json");
    expect(refSearch.results).toContainEqual(
      expect.objectContaining({
        kind: "claims",
        artifactId: claim.claim.claimId
      })
    );
    expect(search.warnings.join("\n")).toContain("do not upgrade trust labels");
    expect(human.stdout).toContain("Truth Harness catalog search");
    expect(human.stdout).toContain(".truth-harness/receipts/fraction.json");
  });

  it("lists append-only workspace events from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const claim = JSON.parse(
      (await runCli(["claim", "add", "Event log records artifact writes.", "--workspace", root, "--tag", "events", "--json"])).stdout
    ) as { claim: { claimId: string }; jsonPath: string };

    const events = JSON.parse((await runCli(["workspace", "events", root, "--limit", "5", "--json"])).stdout) as {
      schemaVersion: string;
      total: number;
      events: Array<{ action: string; kind?: string; artifactId?: string; path?: string; artifact?: { sha256: string } }>;
    };
    const human = await runCli(["workspace", "events", root, "--limit", "1"]);

    expect(events.schemaVersion).toBe("truth-harness.event-list.v0");
    expect(events.total).toBeGreaterThanOrEqual(1);
    expect(events.events).toContainEqual(
      expect.objectContaining({
        action: "artifact-written",
        kind: "claims",
        artifactId: claim.claim.claimId,
        path: expect.stringContaining(".truth-harness/claims/"),
        artifact: expect.objectContaining({
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/u)
        })
      })
    );
    expect(human.stdout).toContain("Truth Harness workspace events");
    expect(human.stdout).toContain("artifact-written");
    expect(human.stdout).toContain(claim.claim.claimId);
  });

  it("renders teaching packets from saved receipts", async () => {
    const root = await tempRoot();
    const receipt = createReceipt("compute 3 / 4 + 5 / 8");
    const receiptPath = join(root, "fraction-receipt.json");
    const outPath = join(root, "fraction-teaching.md");
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

    const human = await runCli(["teach", receiptPath, "--audience", "college"]);
    const write = await runCli(["teach", receiptPath, "--audience", "high", "--out", outPath]);
    const json = JSON.parse((await runCli(["teach", receiptPath, "--json"])).stdout) as {
      packet: { schemaVersion: string; receiptRunId: string; audience: string; trust: string };
      markdown: string;
    };
    const writtenMarkdown = await readFile(outPath, "utf8");

    expect(human.exitCode).toBe(0);
    expect(human.stdout).toContain("# Teaching Packet:");
    expect(human.stdout).toContain("| Audience | `college` |");
    expect(human.stdout).toContain("| Trust | `exact-computed` |");
    expect(human.stdout).toContain("## Teaching Boundary");
    expect(write.exitCode).toBe(0);
    expect(write.stdout).toContain("Wrote teaching packet:");
    expect(writtenMarkdown).toContain("| Audience | `high` |");
    expect(json.packet).toMatchObject({
      schemaVersion: "truth-harness.teaching-packet.v0",
      receiptRunId: receipt.runId,
      audience: "college",
      trust: "exact-computed"
    });
    expect(json.markdown).toContain("## Assessment Rubric");
  });

  it("prints a verifier route with receipt trust and manifest gaps", async () => {
    const result = await runCli([
      "verify",
      "compute",
      "3 / 4 + 5 / 8",
      "--json",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      finalTrust: string;
      receipt: { trust: string };
      usedCapabilities: Array<{ capabilityId: string }>;
      gaps: Array<{ capabilityId: string }>;
      proofObligations: Array<{ kind: string; status: string; sourceCapabilityId: string }>;
      trustBoundary: { routeIsNotProof: boolean };
    };

    expect(result.exitCode).toBe(0);
    expect(json.schemaVersion).toBe("truth-harness.verifier-route.v0");
    expect(json.finalTrust).toBe("exact-computed");
    expect(json.receipt.trust).toBe("exact-computed");
    expect(json.usedCapabilities).toContainEqual(
      expect.objectContaining({
        capabilityId: "local-rational-arithmetic"
      })
    );
    expect(json.gaps).toContainEqual(
      expect.objectContaining({
        capabilityId: "accepted-proof-checker"
      })
    );
    expect(json.proofObligations).toContainEqual(
      expect.objectContaining({
        kind: "formal-proof",
        status: "not-required",
        sourceCapabilityId: "accepted-proof-checker"
      })
    );
    expect(json.trustBoundary.routeIsNotProof).toBe(true);
  });

  it("prints proof obligations in human verifier route output", async () => {
    const result = await runCli([
      "verify",
      "compute",
      "3 / 4 + 5 / 8",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Proof obligations:");
    expect(result.stdout).toContain("not-required: Formal proof-checker obligation");
    expect(result.stdout).toContain("Required before: Before labeling this scoped claim proved.");
  });

  it("prints independent SMT verifier route obligations when requested", async () => {
    const result = await runCli([
      "verify",
      "prove",
      "the",
      "Riemann",
      "hypothesis",
      "--json",
      "--require-independent-smt",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--cvc5-command",
      "truth-harness-missing-cvc5-command"
    ]);
    const json = JSON.parse(result.stdout) as {
      reviewPolicy?: { smt: string };
      replay: string;
      proofObligations: Array<{ kind: string; sourceCapabilityId: string; acceptanceCriteria: string[] }>;
    };

    expect(result.exitCode).toBe(0);
    expect(json.reviewPolicy).toEqual({ smt: "independent" });
    expect(json.replay).toContain("--require-independent-smt");
    expect(json.proofObligations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "solver-encoding",
          sourceCapabilityId: "z3-smt-solver",
          acceptanceCriteria: expect.arrayContaining(["The SMT check record backend id is z3."])
        }),
        expect.objectContaining({
          kind: "solver-encoding",
          sourceCapabilityId: "cvc5-smt-solver",
          acceptanceCriteria: expect.arrayContaining(["The SMT check record backend id is cvc5."])
        })
      ])
    );
  });

  it("writes and inspects persisted verifier routes", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const write = await runCli([
      "verify",
      "compute",
      "3 / 4 + 5 / 8",
      "--write",
      "--workspace",
      root,
      "--json",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command"
    ]);
    const written = JSON.parse(write.stdout) as {
      written: true;
      route: { routeId: string; finalTrust: string };
      result: { jsonPath: string; markdownPath: string };
    };
    const listed = JSON.parse((await runCli(["route", "list", root, "--json"])).stdout) as {
      total: number;
      routes: Array<{
        routeId: string;
        finalTrust: string;
        path: string;
        proofObligations: number;
        openProofObligations: number;
        satisfiedProofObligations: number;
        notRequiredProofObligations: number;
        criticalOpenProofObligations: number;
        readyForNarrowClaim: boolean;
        strongestRouteTrust: string;
        blockingObligations: number;
      }>;
    };
    const shown = JSON.parse(
      (await runCli(["route", "show", written.route.routeId, "--workspace", root, "--json"])).stdout
    ) as { routeId: string; finalTrust: string; replay: string };
    const humanList = await runCli(["route", "list", root]);

    expect(write.exitCode).toBe(0);
    expect(written.written).toBe(true);
    expect(written.route.finalTrust).toBe("exact-computed");
    expect(written.result.jsonPath).toContain(".truth-harness");
    expect(written.result.markdownPath).toContain(".truth-harness");
    expect(listed.total).toBe(1);
    expect(listed.routes[0]).toMatchObject({
      routeId: written.route.routeId,
      finalTrust: "exact-computed",
      proofObligations: 1,
      openProofObligations: 0,
      satisfiedProofObligations: 0,
      notRequiredProofObligations: 1,
      criticalOpenProofObligations: 0,
      readyForNarrowClaim: true,
      strongestRouteTrust: "exact-computed",
      blockingObligations: 0
    });
    expect(shown.routeId).toBe(written.route.routeId);
    expect(shown.replay).toContain("truth-harness verify");
    expect(humanList.stdout).toContain("Proof obligations: 1 total / 1 not-required");
    expect(humanList.stdout).toContain("Readiness: ready (exact-computed)");
  });

  it("satisfies verifier route obligations from accepted local evidence", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const write = await runCli([
      "verify",
      "prove",
      "the",
      "Riemann",
      "hypothesis",
      "--write",
      "--workspace",
      root,
      "--json",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command"
    ]);
    const written = JSON.parse(write.stdout) as {
      route: {
        routeId: string;
        proofObligations: Array<{ obligationId: string; kind: string; status: string; statement: string }>;
      };
    };
    const obligation = written.route.proofObligations.find((candidate) => candidate.kind === "formal-proof");
    const obligationId = obligation?.obligationId ?? "obl_0123456789abcdef";
    const obligationStatement = obligation?.statement ?? "formal-proof fixture statement";
    const proofRef = join(".truth-harness", "proofs", "manual-proof.json");
    await mkdir(join(root, ".truth-harness", "proofs"), { recursive: true });
    await writeFile(
      join(root, proofRef),
      `${JSON.stringify(
        {
          schemaVersion: "truth-harness.proof-check.v0",
          checkId: "proof_0123456789abcdef",
          createdAt: "2026-06-12T00:00:00.000Z",
          backend: {
            id: "lean",
            displayName: "Lean proof checker",
            adapter: "local-lean-subprocess",
            role: "proof-checker",
            acceptedProofChecker: true,
            command: "lean",
            args: ["manual-proof.lean"],
            exitCode: 0
          },
          source: {
            path: "manual-proof.lean",
            sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            byteLength: 16
          },
          scope: {
            routeId: written.route.routeId,
            obligationId,
            statement: obligationStatement,
            statementHash: verifierRouteStatementBoundaryHash(obligationStatement)
          },
          status: "accepted",
          trust: "proved",
          proofCheckerBacked: true,
          localOnly: true,
          networkAccess: "none",
          replay: "truth-harness proof check manual-proof.lean --write --json",
          limitations: ["Test fixture for CLI route-satisfaction contract only."],
          warnings: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const satisfy = await runCli([
      "route",
      "satisfy",
      written.route.routeId,
      obligationId,
      "--workspace",
      root,
      "--evidence",
      `proof:${proofRef}`,
      "--json"
    ]);
    const result = JSON.parse(satisfy.stdout) as {
      route: { proofObligations: Array<{ status: string; severity: string }> };
      obligation: { status: string; satisfiedBy: Array<{ kind: string; ref: string; trust: string }> };
      evidence: { trust: string; schemaVersion: string };
    };
    const shown = JSON.parse(
      (await runCli(["route", "show", written.route.routeId, "--workspace", root, "--json"])).stdout
    ) as { proofObligations: Array<{ obligationId: string; status: string }> };
    const human = await runCli([
      "route",
      "satisfy",
      written.route.routeId,
      obligationId,
      "--workspace",
      root,
      "--evidence",
      `proof:${proofRef}`
    ]);

    expect(satisfy.exitCode).toBe(0);
    expect(result.obligation.status).toBe("satisfied");
    expect(result.obligation.satisfiedBy[0]).toMatchObject({
      kind: "proof",
      ref: proofRef,
      trust: "proved"
    });
    expect(result.evidence).toMatchObject({
      trust: "proved",
      schemaVersion: "truth-harness.proof-check.v0",
      scope: {
        routeId: written.route.routeId,
        obligationId
      }
    });
    expect(shown.proofObligations.find((candidate) => candidate.obligationId === obligationId)).toMatchObject({
      status: "satisfied"
    });
    const openObligations = result.route.proofObligations.filter((candidate) => candidate.status === "open").length;
    const criticalOpenObligations = result.route.proofObligations.filter(
      (candidate) => candidate.status === "open" && candidate.severity === "critical"
    ).length;
    const satisfiedObligations = result.route.proofObligations.filter(
      (candidate) => candidate.status === "satisfied"
    ).length;
    expect(human.stdout).toContain(
      `Proof obligations: ${result.route.proofObligations.length} total / ${openObligations} open / ${criticalOpenObligations} critical-open / ${satisfiedObligations} satisfied`
    );
    expect(human.stdout).toContain("Readiness: not-ready (proved)");
    expect(human.stdout).toContain("Claim ledger follow-up:");
  });

  it("reports proof backend status without requiring Lean to be installed", async () => {
    const result = await runCli([
      "proof",
      "backends",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--json"
    ]);
    const json = JSON.parse(result.stdout) as {
      proofCheckersAvailable: number;
      backends: Array<{ backendId: string; status: string; canCheckProofs: boolean; statusProbeMintedProof: boolean }>;
      trustBoundary: { statusProbeIsNotProof: boolean };
    };

    expect(result.exitCode).toBe(0);
    expect(json.proofCheckersAvailable).toBe(0);
    expect(json.backends[0]).toMatchObject({
      backendId: "lean",
      status: "missing",
      canCheckProofs: false,
      statusProbeMintedProof: false
    });
    expect(json.trustBoundary.statusProbeIsNotProof).toBe(true);
  });

  it("writes a proof-repair fixture without closing the route when Lean is unavailable", async () => {
    const root = await tempRoot();
    const result = await runCli([
      "proof",
      "repair-fixture",
      root,
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--no-run-next",
      "--json"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      routeSatisfaction?: unknown;
      rejectedProof: { record: { status: string; trust: string } };
      repairedProof: { record: { status: string; trust: string } };
      repairRunNext: { plan: { status: string; item?: { command: string } } };
      finalReview: { items: Array<{ kind: string; routeId?: string; obligationId?: string }> };
      route: { route: { routeId: string } };
      obligation: { obligationId: string };
      warnings: string[];
    };

    expect(result.exitCode).toBe(0);
    expect(json.schemaVersion).toBe("truth-harness.proof-repair-fixture.v0");
    expect(json.rejectedProof.record).toMatchObject({ status: "backend-unavailable", trust: "unverified" });
    expect(json.repairedProof.record).toMatchObject({ status: "backend-unavailable", trust: "unverified" });
    expect(json.routeSatisfaction).toBeUndefined();
    expect(json.repairRunNext.plan.status).toBe("planned");
    expect(json.repairRunNext.plan.item?.command).toContain("truth-harness proof check");
    expect(json.finalReview.items).toContainEqual(
      expect.objectContaining({
        kind: "route-obligation",
        routeId: json.route.route.routeId,
        obligationId: json.obligation.obligationId
      })
    );
    expect(json.warnings.join(" ")).toContain("route obligation remains open");
  });

  it("can gate proof-repair fixtures so missing Lean cannot look green", async () => {
    const root = await tempRoot();
    const result = await runCli([
      "proof",
      "repair-fixture",
      root,
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--no-run-next",
      "--fail-on-open",
      "--json"
    ]);
    const json = JSON.parse(result.stdout) as {
      routeSatisfaction?: unknown;
      warnings: string[];
    };

    expect(result.exitCode).toBe(1);
    expect(json.routeSatisfaction).toBeUndefined();
    expect(json.warnings.join(" ")).toContain("route obligation remains open");
  });

  it("seeds the professor challenge workspace from the CLI", async () => {
    const root = await tempRoot();
    const result = await runCli([
      "workspace",
      "seed-professor-challenge",
      root,
      "--now",
      "2026-06-20T12:00:00.000Z",
      "--json"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      seedId: string;
      preset: string;
      paths: { json: string; markdown: string };
      cases: Array<{ caseId: string; validationPlanId?: string }>;
      runNext?: { plan?: { schemaVersion: string; dryRun: boolean; item?: { kind: string } } };
    };
    const latest = JSON.parse(
      (await runCli(["workspace", "hard-math-seeds", root, "--preset", "professor-challenge", "--latest", "--json"])).stdout
    ) as {
      total: number;
      latest: boolean;
      preset: string;
      seed?: { seedId: string; preset: string; paths: { json: string } };
    };
    const listedHuman = await runCli(["workspace", "hard-math-seeds", root, "--preset", "professor-challenge", "--latest"]);
    const handoff = await runCli(["workspace", "hard-math-seeds", root, "--preset", "professor-challenge", "--handoff"]);
    const handoffJson = JSON.parse(
      (await runCli(["workspace", "hard-math-seeds", root, "--preset", "professor-challenge", "--handoff", "--json"])).stdout
    ) as {
      total: number;
      latest: boolean;
      handoff: boolean;
      handoffMarkdown: string;
    };

    expect(result.exitCode).toBe(0);
    expect(json).toMatchObject({
      schemaVersion: "truth-harness.hard-math-seed.v0",
      preset: "professor-challenge"
    });
    expect(json.paths.json).toContain(".truth-harness/findings/");
    expect(latest).toMatchObject({
      total: 1,
      latest: true,
      preset: "professor-challenge",
      seed: {
        seedId: json.seedId,
        preset: "professor-challenge",
        paths: {
          json: json.paths.json
        }
      }
    });
    expect(listedHuman.stdout).toContain("Truth Harness hard-math seeds: 1 latest");
    expect(listedHuman.stdout).toContain(json.seedId);
    expect(handoff.exitCode).toBe(0);
    expect(handoff.stdout).toContain("Truth Harness Professor Challenge Handoff");
    expect(handoff.stdout).toContain("## First Gate");
    expect(handoff.stdout).toContain("## Local Artifacts");
    expect(handoff.stdout).toContain(json.paths.json);
    expect(handoff.stdout).toContain("Do not label any seeded claim proved from this packet.");
    expect(handoffJson).toMatchObject({
      total: 1,
      latest: true,
      handoff: true,
      handoffMarkdown: expect.stringContaining("Truth Harness Professor Challenge Handoff")
    });
    expect(json.cases.map((seedCase) => seedCase.caseId)).toEqual([
      "exact-fraction-lemma",
      "false-parity-trap",
      "symbolic-cas-closure-fixture",
      "smt-bounded-closure-fixture",
      "lean-trivial-proof-boundary"
    ]);
    expect(json.runNext?.plan).toMatchObject({
      schemaVersion: "truth-harness.workspace-run-next.v0",
      dryRun: true,
      item: {
        kind: "validation-gate"
      }
    });
  });

  it("inspects Lean project readiness without running Lean", async () => {
    const root = await tempRoot();
    await mkdir(join(root, "Proofs"), { recursive: true });
    await writeFile(join(root, "lean-toolchain"), "leanprover/lean4:v4.12.0\n", "utf8");
    await writeFile(join(root, "lakefile.lean"), "import Lake\nopen Lake DSL\n", "utf8");
    await writeFile(join(root, "lake-manifest.json"), "{}\n", "utf8");
    await writeFile(join(root, "Proofs", "Trivial.lean"), "example : True := by trivial\n", "utf8");

    const result = await runCli(["proof", "project", ".", "--workspace", root, "--json"]);
    const human = await runCli(["proof", "project", ".", "--workspace", root]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      readiness: string;
      toolchain: { pinned: boolean };
      files: { leanFiles: { total: number; sample: Array<{ sha256: string; sha256Scope: string }> } };
      declarations: {
        total: number;
        byKind: { example: number };
        sample: Array<{ declarationId: string; kind: string; signature: string; signatureSha256: string; sourceSha256: string }>;
      };
      proofSafety: { markers: { total: number }; blocksProvedTrust: boolean };
      trustBoundary: { noLeanExecution: boolean; provedRequiresProofCheckRecord: boolean; proofMarkersBlockProvedTrust: boolean };
    };

    expect(result.exitCode).toBe(0);
    expect(json.schemaVersion).toBe("truth-harness.lean-project-inspection.v0");
    expect(json.readiness).toBe("ready");
    expect(json.toolchain.pinned).toBe(true);
    expect(json.files.leanFiles.total).toBe(1);
    expect(json.files.leanFiles.sample[0]).toMatchObject({
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      sha256Scope: "file"
    });
    expect(json.declarations.total).toBe(1);
    expect(json.declarations.byKind.example).toBe(1);
    expect(json.declarations.sample[0]).toMatchObject({
      declarationId: expect.stringMatching(/^decl_[a-f0-9]{16}$/u),
      kind: "example",
      signature: "example : True",
      signatureSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });
    expect(json.proofSafety.markers.total).toBe(0);
    expect(json.proofSafety.blocksProvedTrust).toBe(false);
    expect(json.trustBoundary.noLeanExecution).toBe(true);
    expect(json.trustBoundary.provedRequiresProofCheckRecord).toBe(true);
    expect(json.trustBoundary.proofMarkersBlockProvedTrust).toBe(true);
    expect(human.stdout).toContain("Truth Harness Lean project inspection");
    expect(human.stdout).toContain("Readiness: ready");
    expect(human.stdout).toContain("sha256:");
    expect(human.stdout).toContain("Formalization targets:");
    expect(human.stdout).toContain("sig:");
    expect(human.stdout).toContain("Kinds: theorem=0, lemma=0, example=1, def=0");
    expect(human.stdout).toContain("Proof safety:");
    expect(human.stdout).toContain("This inspection does not run Lean or prove a claim.");
  });

  it("checks Lean proof artifacts without minting proved when Lean is unavailable", async () => {
    const root = await tempRoot();
    const proofPath = join(root, "example.lean");
    await writeFile(proofPath, "example : True := by trivial\n", "utf8");

    const result = await runCli([
      "proof",
      "check",
      proofPath,
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--json",
      "--fail-on-unproved"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      status: string;
      trust: string;
      proofCheckerBacked: boolean;
      backend: { acceptedProofChecker: boolean };
      source: { sha256: string };
    };

    expect(result.exitCode).toBe(1);
    expect(json.schemaVersion).toBe("truth-harness.proof-check.v0");
    expect(json.status).toBe("backend-unavailable");
    expect(json.trust).toBe("unverified");
    expect(json.proofCheckerBacked).toBe(false);
    expect(json.backend.acceptedProofChecker).toBe(true);
    expect(json.source.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("writes and lists proof-check workspace records", async () => {
    const root = await tempRoot();
    const proofPath = join(root, "example.lean");
    await writeFile(proofPath, "example : True := by trivial\n", "utf8");

    await runCli(["workspace", "init", root, "--json"]);
    const write = await runCli([
      "proof",
      "check",
      proofPath,
      "--workspace",
      root,
      "--write",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--json"
    ]);
    const writeJson = JSON.parse(write.stdout) as {
      record: { checkId: string; trust: string };
      result: { jsonPath: string; markdownPath: string };
    };
    const list = JSON.parse((await runCli(["proof", "list", root, "--json"])).stdout) as {
      total: number;
      checks: Array<{ checkId: string; trust: string; path: string }>;
    };

    expect(write.exitCode).toBe(0);
    expect(writeJson.record.trust).toBe("unverified");
    expect(writeJson.result.jsonPath).toContain(".truth-harness");
    expect(writeJson.result.markdownPath).toContain(".truth-harness");
    expect(list.total).toBe(1);
    expect(list.checks[0]).toMatchObject({
      checkId: writeJson.record.checkId,
      trust: "unverified"
    });
    expect(list.checks[0]?.path).toContain(".truth-harness/proofs/");
  });

  it("creates visual artifacts from proof-check workspace records", async () => {
    const root = await tempRoot();
    const proofPath = join(root, "example.lean");
    await writeFile(proofPath, "example : True := by trivial\n", "utf8");

    await runCli(["workspace", "init", root, "--json"]);
    const write = await runCli([
      "proof",
      "check",
      proofPath,
      "--workspace",
      root,
      "--write",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--json"
    ]);
    const proofWrite = JSON.parse(write.stdout) as {
      record: { checkId: string; trust: string };
    };
    const visual = await runCli([
      "proof",
      "visual",
      proofWrite.record.checkId,
      "--workspace",
      root,
      "--json"
    ]);
    const visualJson = JSON.parse(visual.stdout) as {
      visual: {
        schemaVersion: string;
        visualId: string;
        kind: string;
        payload: { format: string; content: string };
        sourceRefs: Array<{ kind: string; ref: string }>;
        trustBoundary: { visualDoesNotUpgradeTrust: boolean };
      };
    };
    const list = JSON.parse((await runCli(["visual", "list", root, "--json"])).stdout) as {
      total: number;
      visuals: Array<{ visualId: string; kind: string }>;
    };

    expect(visual.exitCode).toBe(0);
    expect(visualJson.visual.schemaVersion).toBe("truth-harness.visual-artifact.v0");
    expect(visualJson.visual.kind).toBe("proof-tree");
    expect(visualJson.visual.payload.format).toBe("svg");
    expect(visualJson.visual.payload.content).toContain(proofWrite.record.checkId);
    expect(visualJson.visual.sourceRefs).toContainEqual(
      expect.objectContaining({
        kind: "proof",
        ref: expect.stringContaining(".truth-harness/proofs/")
      })
    );
    expect(visualJson.visual.trustBoundary.visualDoesNotUpgradeTrust).toBe(true);
    expect(list.total).toBe(1);
    expect(list.visuals[0]).toMatchObject({
      visualId: visualJson.visual.visualId,
      kind: "proof-tree"
    });
  });

  it("reports SMT backend status without requiring SMT solvers to be installed", async () => {
    const result = await runCli([
      "smt",
      "backends",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--cvc5-command",
      "truth-harness-missing-cvc5-command",
      "--json"
    ]);
    const json = JSON.parse(result.stdout) as {
      smtSolversAvailable: number;
      backends: Array<{ backendId: string; status: string; canCheckSmt: boolean; statusProbeMintedCheck: boolean }>;
      trustBoundary: { statusProbeIsNotCheck: boolean; smtCheckedIsNotProofCheckerProof: boolean };
    };

    expect(result.exitCode).toBe(0);
    expect(json.smtSolversAvailable).toBe(0);
    expect(json.backends[0]).toMatchObject({
      backendId: "z3",
      status: "missing",
      canCheckSmt: false,
      statusProbeMintedCheck: false
    });
    expect(json.trustBoundary.statusProbeIsNotCheck).toBe(true);
    expect(json.trustBoundary.smtCheckedIsNotProofCheckerProof).toBe(true);
  });

  it("checks SMT-LIB artifacts without minting smt-checked when Z3 is unavailable", async () => {
    const root = await tempRoot();
    const smtPath = join(root, "constraints.smt2");
    await writeFile(smtPath, "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n", "utf8");

    const result = await runCli([
      "smt",
      "check",
      smtPath,
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--json",
      "--fail-on-unverified"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      status: string;
      trust: string;
      proofCheckerBacked: boolean;
      backend: { acceptedProofChecker: boolean };
      source: { sha256: string };
    };

    expect(result.exitCode).toBe(1);
    expect(json.schemaVersion).toBe("truth-harness.smt-check.v0");
    expect(json.status).toBe("solver-unavailable");
    expect(json.trust).toBe("unverified");
    expect(json.proofCheckerBacked).toBe(false);
    expect(json.backend.acceptedProofChecker).toBe(false);
    expect(json.source.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("writes and lists SMT check workspace records", async () => {
    const root = await tempRoot();
    const smtPath = join(root, "constraints.smt2");
    await writeFile(smtPath, "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n", "utf8");

    await runCli(["workspace", "init", root, "--json"]);
    const write = await runCli([
      "smt",
      "check",
      smtPath,
      "--workspace",
      root,
      "--write",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--json"
    ]);
    const writeJson = JSON.parse(write.stdout) as {
      record: { checkId: string; trust: string };
      result: { jsonPath: string; markdownPath: string };
    };
    const list = JSON.parse((await runCli(["smt", "list", root, "--json"])).stdout) as {
      total: number;
      checks: Array<{ checkId: string; trust: string; path: string }>;
    };

    expect(write.exitCode).toBe(0);
    expect(writeJson.record.trust).toBe("unverified");
    expect(writeJson.result.jsonPath).toContain(".truth-harness");
    expect(writeJson.result.markdownPath).toContain(".truth-harness");
    expect(list.total).toBe(1);
    expect(list.checks[0]).toMatchObject({
      checkId: writeJson.record.checkId,
      trust: "unverified"
    });
    expect(list.checks[0]?.path).toContain(".truth-harness/smt/");
  });

  it("generates workspace-local SMT-LIB from explicit constraints and checks it", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);

    const result = await runCli([
      "smt",
      "solve",
      "--workspace",
      root,
      "--name",
      "small_positive_integer",
      "--int",
      "x",
      "--constraint",
      "x > 0",
      "--constraint",
      "x < 3",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--json",
      "--fail-on-unverified"
    ]);
    const json = JSON.parse(result.stdout) as {
      problem: { problemId: string; sourceText: string };
      sourceRef: string;
      check: { record: { trust: string; source: { path: string } }; jsonPath: string };
    };
    const list = JSON.parse((await runCli(["smt", "list", root, "--json"])).stdout) as { total: number };

    expect(result.exitCode).toBe(1);
    expect(json.problem.problemId).toMatch(/^smt_problem_[a-f0-9]{16}$/);
    expect(json.problem.sourceText).toContain("(assert (> x 0))");
    expect(json.sourceRef).toContain(".truth-harness/smt/sources/");
    expect(json.check.record.source.path).toBe(json.sourceRef);
    expect(json.check.record.trust).toBe("unverified");
    expect(json.check.jsonPath).toContain(".truth-harness");
    expect(list.total).toBe(1);
  });

  it("runs a policy-gated local code command and lists the code-run record", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);

    const result = await runCli([
      "code",
      "run",
      "capture a tiny local code execution",
      "--workspace",
      root,
      "--title",
      "CLI code execution",
      "--command",
      process.execPath,
      "--allow-executable",
      process.execPath,
      "--arg",
      "-e",
      "--arg",
      "console.log('cli-code-run')",
      "--code",
      "inline:node-eval",
      "--input",
      "prompt:cli-code-run",
      "--output",
      "stdout",
      "--json",
      "--fail-on-nonzero"
    ]);
    const json = JSON.parse(result.stdout) as {
      record: {
        runId: string;
        execution: { status: string; exitCode: number };
        command: { shell: boolean };
        policy: { mode: string; matchedAllowlist: boolean; detected: { categories: string[] } };
        stdout: { text: string };
      };
      jsonPath: string;
    };
    const list = JSON.parse((await runCli(["code", "list", root, "--json"])).stdout) as {
      total: number;
      records: Array<{ runId: string; status: string }>;
    };

    expect(result.exitCode).toBe(0);
    expect(json.record.runId).toMatch(/^code_run_[a-f0-9]{16}$/);
    expect(json.record.command.shell).toBe(false);
    expect(json.record.policy).toMatchObject({
      mode: "default-local",
      matchedAllowlist: true,
      detected: { categories: [] }
    });
    expect(json.record.execution).toMatchObject({ status: "passed", exitCode: 0 });
    expect(json.record.stdout.text.trim()).toBe("cli-code-run");
    expect(json.jsonPath).toContain(".truth-harness");
    expect(list.total).toBe(1);
    expect(list.records[0]).toMatchObject({
      runId: json.record.runId,
      status: "passed"
    });
  });

  it("reports code-run sandbox status from the CLI", async () => {
    const result = await runCli(["code", "sandbox-status", "--json"]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      available: boolean;
      provider: string;
      canAttestNetworkNone: boolean;
    };

    expect(json.schemaVersion).toBe("truth-harness.code-run-sandbox-status.v0");
    expect(result.exitCode).toBe(json.available ? 0 : 1);
    if (json.available) {
      expect(json.provider).toBe("container");
      expect(json.canAttestNetworkNone).toBe(true);
    } else {
      expect(json.provider).toBe("none");
      expect(json.canAttestNetworkNone).toBe(false);
    }
  });

  it("writes code-run sandbox status evidence from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const result = await runCli(["code", "sandbox-status", "--write", "--workspace", root, "--json"]);
    const json = JSON.parse(result.stdout) as {
      status: { available: boolean };
      written: true;
      result: {
        record: {
          schemaVersion: string;
          runId: string;
          status: string;
          measurement: { schemaVersion: string; canAttestNetworkNone: boolean };
        };
        jsonPath: string;
        markdownPath: string;
      };
    };

    expect(result.exitCode).toBe(json.status.available ? 0 : 1);
    expect(json.written).toBe(true);
    expect(json.result.record.schemaVersion).toBe("truth-harness.sandbox-run.v0");
    expect(json.result.record.runId).toMatch(/^sandbox_run_[a-f0-9]{16}$/);
    expect(json.result.record.measurement.schemaVersion).toBe("truth-harness.code-run-sandbox-status.v0");
    expect(json.result.record.status).toBe(json.result.record.measurement.canAttestNetworkNone ? "passed" : "failed");
    expect(json.result.jsonPath).toContain(".truth-harness");
    expect(json.result.markdownPath).toContain(".truth-harness");
  });

  it("repairs older workspace manifests from the CLI", async () => {
    const root = await tempRoot();
    const init = JSON.parse((await runCli(["workspace", "init", root, "--json"])).stdout) as {
      manifestPath: string;
      manifest: { directories: Record<string, string> };
    };
    const legacyManifest = {
      ...init.manifest,
      directories: { ...init.manifest.directories }
    };
    delete legacyManifest.directories["code-runs"];
    await rm(join(root, init.manifest.directories["code-runs"]), { recursive: true, force: true });
    await writeFile(init.manifestPath, `${JSON.stringify(legacyManifest, null, 2)}\n`, "utf8");

    const statusResult = await runCli(["workspace", "status", root, "--json"]);
    const status = JSON.parse(statusResult.stdout) as {
      manifestRepair?: { applied: boolean; addedDirectories: string[] };
      missingDirectories: string[];
    };
    const repair = JSON.parse((await runCli(["workspace", "repair", root, "--json"])).stdout) as {
      repaired: boolean;
      manifestRepair?: { applied: boolean; addedDirectories: string[] };
      createdDirectories: string[];
      missingDirectoriesAfter: string[];
    };
    const rawManifest = JSON.parse(await readFile(init.manifestPath, "utf8")) as { directories: Record<string, string> };

    expect(statusResult.exitCode).toBe(1);
    expect(status.manifestRepair).toEqual({ applied: false, addedDirectories: ["code-runs"] });
    expect(status.missingDirectories).toEqual([".truth-harness/code-runs"]);
    expect(repair.repaired).toBe(true);
    expect(repair.manifestRepair).toEqual({ applied: true, addedDirectories: ["code-runs"] });
    expect(repair.createdDirectories).toEqual([".truth-harness/code-runs"]);
    expect(repair.missingDirectoriesAfter).toEqual([]);
    expect(rawManifest.directories["code-runs"]).toBe(".truth-harness/code-runs");
  });

  it("prints bounded workspace review packets from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    await runCli([
      "verify",
      "compute 3 / 4 + 5 / 8",
      "--workspace",
      root,
      "--write",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--timeout-ms",
      "50",
      "--json"
    ]);
    await runCli([
      "claim",
      "add",
      "A blocked finance claim needs evidence.",
      "--workspace",
      root,
      "--domain",
      "finance",
      "--next-check",
      "Attach audited source data before using this claim.",
      "--json"
    ]);

    const reviewResult = await runCli(["workspace", "review", root, "--max-routes", "1", "--max-claims", "0", "--json"]);
    const review = JSON.parse(reviewResult.stdout) as {
      schemaVersion: string;
      reviewId: string;
      localOnly: boolean;
      networkAccess: string;
      summary: { routes: number; claims: number };
      markdown: string;
    };
    const writeResult = await runCli(["workspace", "review", root, "--max-routes", "1", "--max-claims", "0", "--write", "--json"]);
    const written = JSON.parse(writeResult.stdout) as {
      written: true;
      review: { reviewId: string };
      result: { jsonPath: string; markdownPath: string };
    };
    const reviewList = JSON.parse((await runCli(["workspace", "reviews", root, "--json"])).stdout) as {
      total: number;
      reviews: Array<{ reviewId: string; path: string; totalItems: number }>;
    };
    const reviewShow = JSON.parse(
      (await runCli(["workspace", "show-review", written.review.reviewId, "--workspace", root, "--json"])).stdout
    ) as { reviewId: string; summary: { routes: number } };
    const graph = JSON.parse((await runCli(["workspace", "graph", root, "--json"])).stdout) as {
      schemaVersion: string;
      localOnly: boolean;
      networkAccess: string;
      summary: { nodes: number; artifacts: number };
    };
    const reviewListText = await runCli(["workspace", "reviews", root]);
    const reviewText = await runCli(["workspace", "review", root, "--max-routes", "1", "--max-claims", "0", "--write"]);
    const graphText = await runCli(["workspace", "graph", root]);

    expect(reviewResult.exitCode).toBe(0);
    expect(review.schemaVersion).toBe("truth-harness.workspace-review.v0");
    expect(review.reviewId).toMatch(/^wrev_[a-f0-9]{16}$/u);
    expect(review.localOnly).toBe(true);
    expect(review.networkAccess).toBe("none");
    expect(review.summary.routes).toBe(1);
    expect(review.summary.claims).toBe(0);
    expect(review.markdown).toContain("## Ordered Work Queue");
    expect(writeResult.exitCode).toBe(0);
    expect(written.written).toBe(true);
    expect(written.review.reviewId).toMatch(/^wrev_[a-f0-9]{16}$/u);
    expect(written.result.jsonPath.replace(/\\/g, "/")).toContain(".truth-harness/findings/");
    expect(written.result.markdownPath.replace(/\\/g, "/")).toContain(".truth-harness/findings/");
    expect(await readFile(written.result.markdownPath, "utf8")).toContain("## Ordered Work Queue");
    expect(reviewList.total).toBe(1);
    expect(reviewList.reviews[0]).toMatchObject({
      reviewId: written.review.reviewId,
      path: expect.stringContaining(`${written.review.reviewId}-workspace-review.json`)
    });
    expect(reviewShow.reviewId).toBe(written.review.reviewId);
    expect(reviewShow.summary.routes).toBe(1);
    expect(graph.schemaVersion).toBe("truth-harness.workspace-graph.v0");
    expect(graph.localOnly).toBe(true);
    expect(graph.networkAccess).toBe("none");
    expect(graph.summary.nodes).toBeGreaterThan(0);
    expect(graph.summary.artifacts).toBeGreaterThan(0);
    expect(reviewListText.stdout).toContain("Truth Harness workspace reviews: 1");
    expect(reviewListText.stdout).toContain(written.review.reviewId);
    expect(reviewText.stdout).toContain("Truth Harness workspace review");
    expect(reviewText.stdout).toContain("Queue items:");
    expect(reviewText.stdout).toContain("Markdown:");
    expect(graphText.stdout).toContain("Truth Harness workspace graph");
    expect(graphText.stdout).toContain("Nodes:");
  });

  it("writes and verifies credibility reviewer bundles from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);

    const bundleResult = await runCli([
      "workspace",
      "credibility-bundle",
      root,
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--max-sessions",
      "0",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--sage-command",
      "truth-harness-missing-sage-command",
      "--cvc5-command",
      "truth-harness-missing-cvc5-command",
      "--require-all-engines",
      "--json"
    ]);
    const bundle = JSON.parse(bundleResult.stdout) as {
      manifest: {
        schemaVersion: string;
        bundleId: string;
        packStatus: string;
        packSummary: { requiredEngineGates: string };
        summary: { totalFiles: number };
        reviewerCommands: {
          verifyBundle: string;
          verifyEngines: string;
          runAdversarialBenchmark: string;
          runMathCredibilityLadder: string;
          runExactHardMathClosure: string;
          runSymbolicHardMathClosure: string;
          runSmtHardMathClosure: string;
          reproducePack: string;
          dockerProfessorEvidence: string;
          dockerStrictProfessorEvidence: string;
          dockerLeanRepairGate: string;
          dockerAllEngines: string;
        };
      };
      result: { bundleDir: string; manifestPath: string; packMarkdownPath: string };
    };
    const verifyById = JSON.parse(
      (await runCli(["workspace", "verify-credibility-bundle", root, bundle.manifest.bundleId, "--json"])).stdout
    ) as {
      schemaVersion: string;
      verificationId: string;
      bundleId: string;
      passed: boolean;
      sourceMatchesWorkspace: boolean;
      checkedBundleFiles: number;
    };
    const writtenVerify = JSON.parse(
      (await runCli(["workspace", "verify-credibility-bundle", root, bundle.manifest.bundleId, "--write", "--json"])).stdout
    ) as {
      verification: {
        schemaVersion: string;
        verificationId: string;
        bundleId: string;
        passed: boolean;
      };
      paths: { json: string; markdown: string };
    };
    const humanBundle = await runCli([
      "workspace",
      "credibility-bundle",
      root,
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--max-sessions",
      "0",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--sage-command",
      "truth-harness-missing-sage-command",
      "--cvc5-command",
      "truth-harness-missing-cvc5-command",
      "--require-all-engines"
    ]);
    const humanVerify = await runCli([
      "workspace",
      "verify-credibility-bundle",
      bundle.manifest.bundleId,
      "--workspace",
      root
    ]);

    expect(bundleResult.exitCode).toBe(0);
    expect(bundle.manifest.schemaVersion).toBe("truth-harness.credibility-bundle.v0");
    expect(bundle.manifest.bundleId).toMatch(/^cbun_[a-f0-9]{16}$/u);
    expect(bundle.manifest.packStatus).toBe("blocked");
    expect(bundle.manifest.packSummary.requiredEngineGates).toBe("0/5");
    expect(bundle.manifest.summary.totalFiles).toBeGreaterThan(0);
    expect(bundle.manifest.reviewerCommands.verifyBundle).toContain("workspace verify-credibility-bundle");
    expect(bundle.manifest.reviewerCommands.verifyEngines).toContain("--require-all-engines");
    expect(bundle.manifest.reviewerCommands.runAdversarialBenchmark).toContain("ai-failure-seed");
    expect(bundle.manifest.reviewerCommands.runMathCredibilityLadder).toContain("math-credibility-ladder");
    expect(bundle.manifest.reviewerCommands.runExactHardMathClosure).toBe("npm run docker:hard-math-closure");
    expect(bundle.manifest.reviewerCommands.runSymbolicHardMathClosure).toBe("npm run docker:symbolic-closure");
    expect(bundle.manifest.reviewerCommands.runSmtHardMathClosure).toBe("npm run docker:smt-closure");
    expect(bundle.manifest.reviewerCommands.reproducePack).toContain("--require-all-engines");
    expect(bundle.manifest.reviewerCommands.dockerProfessorEvidence).toBe("npm run docker:professor");
    expect(bundle.manifest.reviewerCommands.dockerStrictProfessorEvidence).toBe("npm run docker:professor:all");
    expect(bundle.manifest.reviewerCommands.dockerLeanRepairGate).toBe("npm run docker:proof-repair");
    expect(bundle.manifest.reviewerCommands.dockerAllEngines).toBe("npm run docker:all-engines:write");
    expect(bundle.result.bundleDir.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(await readFile(bundle.result.manifestPath, "utf8")).toContain(bundle.manifest.bundleId);
    expect(verifyById).toMatchObject({
      schemaVersion: "truth-harness.credibility-bundle-verification.v0",
      verificationId: expect.stringMatching(/^cver_[a-f0-9]{16}$/u),
      bundleId: bundle.manifest.bundleId,
      passed: true,
      sourceMatchesWorkspace: true
    });
    expect(verifyById.checkedBundleFiles).toBe(bundle.manifest.summary.totalFiles);
    expect(writtenVerify.verification).toMatchObject({
      schemaVersion: "truth-harness.credibility-bundle-verification.v0",
      verificationId: expect.stringMatching(/^cver_[a-f0-9]{16}$/u),
      bundleId: bundle.manifest.bundleId,
      passed: true
    });
    expect(existsSync(writtenVerify.paths.json)).toBe(true);
    expect(existsSync(writtenVerify.paths.markdown)).toBe(true);
    expect(await readFile(writtenVerify.paths.markdown, "utf8")).toContain(writtenVerify.verification.verificationId);
    expect(humanBundle.stdout).toContain("Truth Harness portable reviewer bundle");
    expect(humanBundle.stdout).toContain("Reviewer commands:");
    expect(humanBundle.stdout).toContain("npm run docker:professor:all");
    expect(humanBundle.stdout).toContain("npm run docker:all-engines:write");
    expect(humanVerify.stdout).toContain("Truth Harness credibility bundle verification");
    expect(humanVerify.stdout).toContain("Bundle integrity: passed");

    await writeFile(bundle.result.packMarkdownPath, "tampered reviewer markdown\n", "utf8");
    const tampered = JSON.parse(
      (await runCli(["workspace", "verify-credibility-bundle", bundle.result.bundleDir, "--workspace", root, "--json"])).stdout
    ) as {
      passed: boolean;
      sourceMatchesWorkspace: boolean;
      changedBundleFiles: Array<{ path: string }>;
      changedSourceFiles: Array<{ path: string }>;
    };

    expect(tampered.passed).toBe(false);
    expect(tampered.sourceMatchesWorkspace).toBe(true);
    expect(tampered.changedBundleFiles).toContainEqual(expect.objectContaining({ path: "credibility-pack.md" }));
    expect(tampered.changedSourceFiles).toHaveLength(0);
  });

  it("lists credibility reviewer actions without executing them", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);

    const result = await runCli([
      "workspace",
      "credibility-actions",
      root,
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--max-sessions",
      "0",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--sage-command",
      "truth-harness-missing-sage-command",
      "--cvc5-command",
      "truth-harness-missing-cvc5-command",
      "--require-all-engines",
      "--category",
      "engine",
      "--json"
    ]);
    const actions = JSON.parse(result.stdout) as {
      schemaVersion: string;
      status: string;
      professorReady: boolean;
      totalActions: number;
      criticalActions: number;
      actions: Array<{
        category: string;
        priority: string;
        title: string;
        detail: string;
        command: string;
        closes: string[];
      }>;
    };
    const human = await runCli([
      "workspace",
      "credibility-actions",
      root,
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--max-sessions",
      "0",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--z3-command",
      "truth-harness-missing-z3-command",
      "--lean-command",
      "truth-harness-missing-lean-command",
      "--sage-command",
      "truth-harness-missing-sage-command",
      "--cvc5-command",
      "truth-harness-missing-cvc5-command",
      "--require-all-engines",
      "--priority",
      "critical"
    ]);

    expect(result.exitCode).toBe(0);
    expect(actions.schemaVersion).toBe("truth-harness.credibility-actions.v0");
    expect(actions.status).toBe("blocked");
    expect(actions.professorReady).toBe(false);
    expect(actions.totalActions).toBeGreaterThanOrEqual(5);
    expect(actions.criticalActions).toBeGreaterThanOrEqual(5);
    expect(actions.actions).toContainEqual(
      expect.objectContaining({
        category: "engine",
        priority: "critical",
        title: "Close required Maxima symbolic cross-check gate",
        command: expect.stringContaining("truth-harness engines verify --write --require-all-engines"),
        closes: expect.arrayContaining(["required-engine:maxima-symbolic-cross-check"])
      })
    );
    expect(actions.actions).toContainEqual(
      expect.objectContaining({
        title: "Close required SageMath symbolic cross-check gate",
        closes: expect.arrayContaining(["required-engine:sage-symbolic-cross-check"])
      })
    );
    expect(actions.actions.map((action) => action.detail).join("\n")).not.toContain("spawnSync");
    expect(human.stdout).toContain("Truth Harness reviewer action queue");
    expect(human.stdout).toContain("Close required Lean proof fixture gate");
    expect(human.stdout).toContain("Command: truth-harness engines verify --write --require-all-engines");
  });

  it("plans and executes one workspace autonomy action without shell execution", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const claim = await runCli([
      "claim",
      "add",
      "A blocked finance claim needs audited evidence before use.",
      "--workspace",
      root,
      "--domain",
      "finance",
      "--next-check",
      "Attach audited source data before using this claim.",
      "--json"
    ]);
    const writtenClaim = JSON.parse(claim.stdout) as { claim: { claimId: string } };
    const dryRun = await runCli([
      "workspace",
      "run-next",
      root,
      "--max-routes",
      "0",
      "--max-sessions",
      "0",
      "--json"
    ]);
    const dryPlan = JSON.parse(dryRun.stdout) as {
      planId: string;
      dryRun: boolean;
      status: string;
      mode: string;
      item?: { kind: string; claimId?: string; command: string };
      execution: { status: string; kind: string; summary: string };
      rationale?: { target?: string; source?: string; executionBoundary?: string };
    };
    const executed = await runCli([
      "workspace",
      "run-next",
      root,
      "--max-routes",
      "0",
      "--max-sessions",
      "0",
      "--execute-local",
      "--json"
    ]);
    const writtenDryRun = await runCli([
      "workspace",
      "run-next",
      root,
      "--max-routes",
      "0",
      "--max-sessions",
      "0",
      "--write",
      "--json"
    ]);
    const executedPlan = JSON.parse(executed.stdout) as {
      dryRun: boolean;
      status: string;
      mode: string;
      item?: { kind: string; claimId?: string };
      execution: { status: string; kind: string; summary: string; evidenceRef?: string; result: { route?: { routeId: string } } };
      networkAccess: string;
    };
    const writtenDryRunPayload = JSON.parse(writtenDryRun.stdout) as {
      written: boolean;
      plan: {
        schemaVersion: string;
        planId: string;
        dryRun: boolean;
        sourceRevision?: { revisionId: string; path: string; sourceSnapshotId: string; sourceSnapshotPath: string };
        sourceSnapshot?: { snapshotId: string; path: string };
      };
      result: { jsonPath: string; markdownPath: string; markdown: string };
    };
    const human = await runCli([
      "workspace",
      "run-next",
      root,
      "--max-routes",
      "0",
      "--max-sessions",
      "0"
    ]);

    expect(dryRun.exitCode).toBe(0);
    expect(dryPlan.planId).toMatch(/^wrn_[a-f0-9]{8}$/u);
    expect(dryPlan.dryRun).toBe(true);
    expect(dryPlan.status).toBe("planned");
    expect(dryPlan.mode).toBe("human-review-gated");
    expect(dryPlan.item).toMatchObject({
      kind: "claim-blocker",
      claimId: writtenClaim.claim.claimId
    });
    expect(dryPlan.item?.command).toContain("truth-harness verify");
    expect(dryPlan.item?.command).toContain("--write");
    expect(dryPlan.execution).toMatchObject({
      status: "planned",
      kind: "dry-run"
    });
    expect(dryPlan.rationale).toMatchObject({
      target: writtenClaim.claim.claimId,
      source: "claim-blocker / high"
    });
    expect(dryPlan.rationale?.executionBoundary).toContain("Dry-run only");
    expect(executed.exitCode).toBe(0);
    expect(executedPlan.dryRun).toBe(false);
    expect(executedPlan.status).toBe("executed");
    expect(executedPlan.networkAccess).toBe("none");
    expect(executedPlan.execution.status).toBe("executed");
    expect(executedPlan.execution.kind).toBe("verifier-route");
    expect(executedPlan.execution.evidenceRef).toMatch(/^route:/u);
    expect(executedPlan.execution.result.route?.routeId).toMatch(/^route_/u);
    expect(writtenDryRun.exitCode).toBe(0);
    expect(writtenDryRunPayload.written).toBe(true);
    expect(writtenDryRunPayload.plan).toMatchObject({
      schemaVersion: "truth-harness.workspace-run-next.v0",
      dryRun: true,
      sourceRevision: {
        revisionId: expect.stringMatching(/^rev_[a-f0-9]{16}$/u),
        path: expect.stringContaining(".truth-harness/revisions/"),
        sourceSnapshotId: expect.stringMatching(/^snap_[a-f0-9]{16}$/u),
        sourceSnapshotPath: expect.stringContaining(".truth-harness/snapshots/")
      },
      sourceSnapshot: {
        snapshotId: expect.stringMatching(/^snap_[a-f0-9]{16}$/u),
        path: expect.stringContaining(".truth-harness/snapshots/")
      }
    });
    expect(writtenDryRunPayload.result.jsonPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(writtenDryRunPayload.result.markdownPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(writtenDryRunPayload.result.markdown).toContain("Truth Harness Run-Next Plan");
    const writtenPlan = JSON.parse(await readFile(writtenDryRunPayload.result.jsonPath, "utf8")) as { planId: string };
    expect(writtenPlan.planId).toBe(writtenDryRunPayload.plan.planId);
    const planList = await runCli(["workspace", "run-nexts", root, "--json"]);
    const planListPayload = JSON.parse(planList.stdout) as {
      total: number;
      plans: Array<{
        planId: string;
        path: string;
        dryRun: boolean;
        executionKind: string;
        rationaleTarget?: string;
        rationaleSource?: string;
        rationaleExecutionBoundary?: string;
        sourceRevisionId?: string;
        sourceRevisionPath?: string;
        sourceRevisionStatus?: string;
        sourceRevisionAdded?: number;
        sourceRevisionIgnoredAdded?: number;
        sourceSnapshotId?: string;
        sourceSnapshotPath?: string;
        sourceSnapshotStatus?: string;
        sourceSnapshotAdded?: number;
        sourceSnapshotIgnoredAdded?: number;
        resumeDecision: {
          safeToResume: boolean;
          status: string;
          action: string;
          nextCommand: string;
        };
      }>;
    };
    const listedPlan = planListPayload.plans.find((plan) => plan.planId === writtenDryRunPayload.plan.planId);
    const humanList = await runCli(["workspace", "run-nexts", root]);
    const verifiedPlanList = await runCli(["workspace", "run-nexts", root, "--verify-snapshots", "--json"]);
    const verifiedPlanListPayload = JSON.parse(verifiedPlanList.stdout) as typeof planListPayload;
    const verifiedListedPlan = verifiedPlanListPayload.plans.find(
      (plan) => plan.planId === writtenDryRunPayload.plan.planId
    );
    const verifiedHumanList = await runCli(["workspace", "run-nexts", root, "--verify-snapshots"]);
    expect(planList.exitCode).toBe(0);
    expect(planListPayload.total).toBeGreaterThanOrEqual(1);
    expect(listedPlan).toMatchObject({
      planId: writtenDryRunPayload.plan.planId,
      dryRun: true,
      executionKind: "dry-run",
      rationaleTarget: writtenClaim.claim.claimId,
      rationaleSource: "claim-blocker / high",
      rationaleExecutionBoundary: expect.stringContaining("Dry-run only"),
      sourceRevisionId: writtenDryRunPayload.plan.sourceRevision?.revisionId,
      sourceRevisionPath: writtenDryRunPayload.plan.sourceRevision?.path,
      sourceSnapshotId: writtenDryRunPayload.plan.sourceSnapshot?.snapshotId,
      sourceSnapshotPath: writtenDryRunPayload.plan.sourceSnapshot?.path,
      resumeDecision: {
        safeToResume: false,
        status: "verify-snapshot-first",
        action: "verify-source-snapshot",
        nextCommand: expect.stringContaining("show-run-next")
      }
    });
    expect(humanList.exitCode).toBe(0);
    expect(humanList.stdout).toContain(`Target: ${writtenClaim.claim.claimId}`);
    expect(humanList.stdout).toContain("Source: claim-blocker / high");
    expect(humanList.stdout).toContain("Boundary: Dry-run only");
    expect(humanList.stdout).toContain("Resume: verify-snapshot-first (hold)");
    expect(humanList.stdout).toContain(`Source snapshot: ${writtenDryRunPayload.plan.sourceSnapshot?.snapshotId}`);
    expect(verifiedPlanList.exitCode).toBe(0);
    expect(verifiedListedPlan).toMatchObject({
      planId: writtenDryRunPayload.plan.planId,
      sourceRevisionStatus: "verified",
      sourceRevisionAdded: 0,
      sourceRevisionIgnoredAdded: 3,
      sourceSnapshotStatus: "verified",
      sourceSnapshotAdded: 0,
      sourceSnapshotIgnoredAdded: 3,
      resumeDecision: {
        safeToResume: true,
        status: "safe-to-resume",
        action: "run-selected-command"
      }
    });
    expect(verifiedHumanList.exitCode).toBe(0);
    expect(verifiedHumanList.stdout).toContain("Revision drift: verified");
    expect(verifiedHumanList.stdout).toContain("Snapshot drift: verified");
    expect(verifiedHumanList.stdout).toContain("Resume: safe-to-resume (safe)");
    const shownById = await runCli([
      "workspace",
      "show-run-next",
      writtenDryRunPayload.plan.planId,
      "--workspace",
      root,
      "--json"
    ]);
    expect(JSON.parse(shownById.stdout)).toMatchObject({
      planId: writtenDryRunPayload.plan.planId,
      dryRun: true
    });
    const shownByIdWithSnapshot = await runCli([
      "workspace",
      "show-run-next",
      writtenDryRunPayload.plan.planId,
      "--workspace",
      root,
      "--verify-snapshot",
      "--json"
    ]);
    expect(JSON.parse(shownByIdWithSnapshot.stdout)).toMatchObject({
      schemaVersion: "truth-harness.workspace-run-next-inspection.v0",
      plan: {
        planId: writtenDryRunPayload.plan.planId,
        dryRun: true
      },
      resumeDecision: {
        safeToResume: true,
        status: "safe-to-resume",
        action: "run-selected-command"
      },
      sourceSnapshot: {
        sourceSnapshotStatus: "verified",
        sourceSnapshotAdded: 0,
        sourceSnapshotIgnoredAdded: 3
      },
      sourceRevision: {
        sourceRevisionStatus: "verified",
        sourceRevisionAdded: 0,
        sourceRevisionIgnoredAdded: 3
      }
    });
    const shownByPath = await runCli([
      "workspace",
      "show-run-next",
      listedPlan?.path ?? "",
      "--workspace",
      root,
      "--json"
    ]);
    expect(JSON.parse(shownByPath.stdout)).toMatchObject({
      planId: writtenDryRunPayload.plan.planId
    });
    const shownHumanWithSnapshot = await runCli([
      "workspace",
      "show-run-next",
      writtenDryRunPayload.plan.planId,
      "--workspace",
      root,
      "--verify-snapshot"
    ]);
    expect(shownHumanWithSnapshot.stdout).toContain("Source revision check:");
    expect(shownHumanWithSnapshot.stdout).toContain("Source snapshot check:");
    expect(shownHumanWithSnapshot.stdout).toContain("Status: verified");
    expect(shownHumanWithSnapshot.stdout).toContain("Resume decision:");
    expect(shownHumanWithSnapshot.stdout).toContain("Safe to resume: yes");
    expect(shownHumanWithSnapshot.stdout).toContain("Action: run-selected-command");
    const savedPilotLoop = await runCli([
      "workspace",
      "pilot-loop",
      root,
      "--source",
      "saved-run-next",
      "--plan-ref",
      writtenDryRunPayload.plan.planId,
      "--write",
      "--json"
    ]);
    const savedPilotLoopPayload = JSON.parse(savedPilotLoop.stdout) as {
      loop: {
        schemaVersion: string;
        loopId: string;
        source: string;
        dryRun: boolean;
        status: string;
        stopReason: string;
        warnings: string[];
        steps: Array<{
          item?: { kind: string; claimId?: string; command: string };
          execution: { status: string; kind: string };
        }>;
      };
      runNextWrites: unknown[];
      written?: boolean;
      result?: { jsonPath: string; markdownPath: string };
    };
    expect(savedPilotLoop.exitCode).toBe(0);
    expect(savedPilotLoopPayload.loop).toMatchObject({
      schemaVersion: "truth-harness.workspace-pilot-loop.v0",
      source: "saved-run-next",
      dryRun: true,
      status: "stopped",
      stopReason: "dry-run"
    });
    expect(savedPilotLoopPayload.loop.steps[0]).toMatchObject({
      item: {
        command: expect.any(String)
      },
      execution: {
        status: "planned",
        kind: "dry-run"
      }
    });
    expect(savedPilotLoopPayload.loop.warnings).toContainEqual(
      expect.stringContaining(`resumed ${writtenDryRunPayload.plan.planId}`)
    );
    expect(savedPilotLoopPayload.written).toBe(true);
    expect(savedPilotLoopPayload.result?.jsonPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(savedPilotLoopPayload.result?.markdownPath.replace(/\\/gu, "/")).toContain(".truth-harness/findings/");
    expect(savedPilotLoopPayload.runNextWrites).toHaveLength(1);
    const pilotLoopList = await runCli(["workspace", "pilot-loops", root, "--json"]);
    const pilotLoopListPayload = JSON.parse(pilotLoopList.stdout) as {
      total: number;
      loops: Array<{
        loopId: string;
        path: string;
        markdownPath?: string;
        source: string;
        status: string;
        stopReason: string;
        firstCommand?: string;
        runNextPlanCount?: number;
        lastRunNextPlanPath?: string;
        lastRunNextMarkdownPath?: string;
      }>;
    };
    const listedPilotLoop = pilotLoopListPayload.loops.find(
      (loop) => loop.loopId === savedPilotLoopPayload.loop.loopId
    );
    expect(pilotLoopList.exitCode).toBe(0);
    expect(listedPilotLoop).toMatchObject({
      loopId: savedPilotLoopPayload.loop.loopId,
      path: expect.stringContaining(".truth-harness/findings/"),
      markdownPath: expect.stringContaining(".truth-harness/findings/"),
      source: "saved-run-next",
      status: "stopped",
      stopReason: "dry-run",
      firstCommand: expect.any(String),
      runNextPlanCount: 1,
      lastRunNextPlanPath: expect.stringContaining(".truth-harness/findings/"),
      lastRunNextMarkdownPath: expect.stringContaining(".truth-harness/findings/")
    });
    const pilotLoopHumanList = await runCli(["workspace", "pilot-loops", root]);
    expect(pilotLoopHumanList.stdout).toContain("Truth Harness workspace pilot-loop transcripts");
    expect(pilotLoopHumanList.stdout).toContain(savedPilotLoopPayload.loop.loopId);
    expect(pilotLoopHumanList.stdout).toContain("Run-next handoffs: 1");
    expect(pilotLoopHumanList.stdout).toContain("Latest packet: .truth-harness/findings/");
    expect(pilotLoopHumanList.stdout).toContain("Latest markdown: .truth-harness/findings/");
    expect(pilotLoopHumanList.stdout).toContain("Continue: truth-harness workspace continue-pilot-loop");
    expect(pilotLoopHumanList.stdout).toContain("Open latest handoff: truth-harness workspace show-run-next .truth-harness/findings/");
    const refreshedWrittenDryRun = await runCli([
      "workspace",
      "run-next",
      root,
      "--max-routes",
      "0",
      "--max-sessions",
      "0",
      "--write",
      "--json"
    ]);
    expect(refreshedWrittenDryRun.exitCode).toBe(0);
    const resumeIndex = await runCli(["workspace", "resume-index", root, "--json"]);
    const resumeIndexPayload = JSON.parse(resumeIndex.stdout) as {
      schemaVersion: string;
      summary: {
        safeSavedRunNextHandoffs: number;
        savedRunNextHandoffs: number;
        pilotLoopTranscripts: number;
        openReviewItems: number;
      };
      items: Array<{
        kind: string;
        command: string;
        safeToResume?: boolean;
        source: { ref: string };
      }>;
      warnings: string[];
    };
    const resumeIndexHuman = await runCli(["workspace", "resume-index", root]);
    expect(resumeIndex.exitCode).toBe(0);
    expect(resumeIndexPayload.schemaVersion).toBe("truth-harness.workspace-resume-index.v0");
    expect(resumeIndexPayload.summary.safeSavedRunNextHandoffs).toBeGreaterThanOrEqual(1);
    expect(resumeIndexPayload.summary.savedRunNextHandoffs).toBeGreaterThanOrEqual(1);
    expect(resumeIndexPayload.summary.pilotLoopTranscripts).toBeGreaterThanOrEqual(1);
    expect(resumeIndexPayload.items[0]).toMatchObject({
      kind: "saved-run-next",
      safeToResume: true
    });
    expect(resumeIndexPayload.items).toContainEqual(
      expect.objectContaining({
        kind: "pilot-loop-transcript",
        command: expect.stringContaining("continue-pilot-loop")
      })
    );
    expect(resumeIndexPayload.warnings).toContainEqual(expect.stringContaining("navigation only"));
    expect(resumeIndexHuman.exitCode).toBe(0);
    expect(resumeIndexHuman.stdout).toContain("Truth Harness workspace resume index");
    expect(resumeIndexHuman.stdout).toContain("saved-run-next");
    expect(resumeIndexHuman.stdout).toContain("Safe to resume: yes");
    const shownPilotLoop = await runCli([
      "workspace",
      "show-pilot-loop",
      savedPilotLoopPayload.loop.loopId,
      "--workspace",
      root,
      "--json"
    ]);
    expect(JSON.parse(shownPilotLoop.stdout)).toMatchObject({
      schemaVersion: "truth-harness.workspace-pilot-loop-inspection.v0",
      loop: {
        loopId: savedPilotLoopPayload.loop.loopId
      }
    });
    const shownPilotLoopHuman = await runCli([
      "workspace",
      "show-pilot-loop",
      savedPilotLoopPayload.loop.loopId,
      "--workspace",
      root
    ]);
    expect(shownPilotLoopHuman.stdout).toContain("Truth Harness workspace pilot-loop");
    expect(shownPilotLoopHuman.stdout).toContain("Run-next packet: .truth-harness/findings/");
    expect(shownPilotLoopHuman.stdout).toContain("Run-next markdown: .truth-harness/findings/");
    expect(shownPilotLoopHuman.stdout).toContain("Transcript:");
    expect(human.stdout).toContain("Truth Harness workspace run-next");
    expect(human.stdout).toContain("Plan:");
    expect(human.stdout).toContain("Dry run: true");
    expect(human.stdout).toContain("Why this action:");
    expect(human.stdout).toContain(`Target: ${writtenClaim.claim.claimId}`);
    expect(human.stdout).toContain("Source: claim-blocker / high");
    expect(human.stdout).toContain("Candidate evidence: none selected");
    expect(human.stdout).toContain("Execution: planned (dry-run)");
  });

  it("prints idle run-next handoff actions when no workspace item is open", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);

    const json = await runCli(["workspace", "run-next", root, "--json"]);
    const plan = JSON.parse(json.stdout) as {
      status: string;
      execution: { kind: string };
      idleNextActions?: Array<{ actionId: string; command: string; requiresHumanInput: boolean }>;
    };
    const human = await runCli(["workspace", "run-next", root]);

    expect(plan).toMatchObject({
      status: "blocked",
      execution: { kind: "no-open-item" },
      idleNextActions: [
        expect.objectContaining({
          actionId: "start-validation-backed-harness",
          command: expect.stringContaining("truth-harness research harness"),
          requiresHumanInput: true
        }),
        expect.objectContaining({
          actionId: "refresh-strict-docker-professor-rehearsal",
          command: "npm run docker:professor:all",
          requiresHumanInput: true
        }),
        expect.objectContaining({
          actionId: "refresh-docker-professor-rehearsal",
          command: "npm run docker:professor",
          requiresHumanInput: true
        }),
        expect.objectContaining({
          actionId: "refresh-professor-review",
          command: expect.stringContaining("truth-harness workspace credibility-pack"),
          requiresHumanInput: false
        }),
        expect.objectContaining({
          actionId: "refresh-release-audit",
          command: expect.stringContaining("truth-harness workspace release-audit"),
          requiresHumanInput: false
        })
      ]
    });
    expect(human.stdout).toContain("Idle next actions:");
    expect(human.stdout).toContain("start-validation-backed-harness");
    expect(human.stdout).toContain("refresh-strict-docker-professor-rehearsal");
    expect(human.stdout).toContain("refresh-docker-professor-rehearsal");
    expect(human.stdout).toContain("refresh-professor-review");
    expect(human.stdout).toContain("refresh-release-audit");
  });

  it("writes, lists, shows, and verifies workspace revisions from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    await mkdir(join(root, ".truth-harness", "receipts"), { recursive: true });
    await writeFile(
      join(root, ".truth-harness", "receipts", "fraction.json"),
      `${JSON.stringify(createReceipt("compute 3 / 4 + 5 / 8"), null, 2)}\n`,
      "utf8"
    );

    const written = await runCli([
      "workspace",
      "revision",
      root,
      "--title",
      "CLI handoff checkpoint",
      "--reason",
      "Give the next agent a stable evidence state.",
      "--session",
      "rs_cli_demo",
      "--validation",
      "vp_cli_demo",
      "--claim",
      "claim_cli_demo",
      "--artifact",
      ".truth-harness/receipts/fraction.json",
      "--json"
    ]);
    const payload = JSON.parse(written.stdout) as {
      revision: {
        revisionId: string;
        title: string;
        sourceSnapshot: { snapshotId: string; path: string; sha256: string };
        artifactRefs: Array<{ path: string; role: string; sha256?: string }>;
      };
      path: string;
      snapshotPath: string;
    };
    const list = await runCli(["workspace", "revisions", root, "--json"]);
    const listPayload = JSON.parse(list.stdout) as {
      total: number;
      revisions: Array<{ revisionId: string; title: string; path: string }>;
    };
    const shown = await runCli([
      "workspace",
      "show-revision",
      payload.revision.revisionId,
      "--workspace",
      root,
      "--json"
    ]);
    const shownPayload = JSON.parse(shown.stdout) as { revisionId: string; sourceSnapshot: { path: string } };
    const verified = await runCli([
      "workspace",
      "verify-revision",
      payload.revision.revisionId,
      "--workspace",
      root,
      "--json"
    ]);
    const verification = JSON.parse(verified.stdout) as {
      passed: boolean;
      sourceSnapshotFile: { status: string };
      snapshotVerification?: { passed: boolean; addedSinceSnapshot: unknown[] };
    };
    const human = await runCli(["workspace", "revision", root, "--title", "Human checkpoint", "--reason", "exercise printer"]);

    expect(written.exitCode).toBe(0);
    expect(payload.revision).toMatchObject({
      revisionId: expect.stringMatching(/^rev_[a-f0-9]{16}$/u),
      title: "CLI handoff checkpoint",
      sourceSnapshot: {
        snapshotId: expect.stringMatching(/^snap_[a-f0-9]{16}$/u),
        path: expect.stringContaining(".truth-harness/snapshots/"),
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/u)
      }
    });
    expect(payload.revision.artifactRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".truth-harness/receipts/fraction.json",
          role: "linked-artifact",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/u)
        })
      ])
    );
    expect(payload.path.replace(/\\/gu, "/")).toContain(".truth-harness/revisions/");
    expect(payload.snapshotPath.replace(/\\/gu, "/")).toContain(".truth-harness/snapshots/");
    expect(listPayload.revisions).toContainEqual(
      expect.objectContaining({
        revisionId: payload.revision.revisionId,
        title: "CLI handoff checkpoint"
      })
    );
    expect(shownPayload).toMatchObject({
      revisionId: payload.revision.revisionId,
      sourceSnapshot: {
        path: payload.revision.sourceSnapshot.path
      }
    });
    expect(verified.exitCode).toBe(0);
    expect(verification).toMatchObject({
      passed: true,
      sourceSnapshotFile: { status: "verified" },
      snapshotVerification: {
        passed: true,
        addedSinceSnapshot: []
      }
    });
    expect(human.stdout).toContain("Wrote workspace revision");
    expect(human.stdout).toContain("Trust boundary: revisions prove local artifact identity");
  });

  it("lists and reads saved report drafts from the workspace CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const markdown = "# CLI Report Draft\n\nEvery result is replayable.\n";
    const written = await writeReportDraft({
      rootPath: root,
      title: "CLI Report Draft",
      summary: "Saved for headless reviewer access.",
      receiptRunId: "run_cli_report_fixture",
      claimId: "claim_cli_report_fixture",
      trust: "exact-computed",
      bundleVerificationIds: ["cver_bbbbbbbbbbbbbbbb"],
      source: "test",
      actor: "agent",
      markdown,
      now: "2026-06-16T00:01:00.000Z"
    });

    const list = await runCli(["workspace", "reports", root, "--json"]);
    const listPayload = JSON.parse(list.stdout) as {
      schemaVersion: string;
      count: number;
      reports: Array<{ report: { reportId: string; title: string }; markdownVerified: boolean; markdownStatus: string }>;
    };
    const humanList = await runCli(["workspace", "reports", root]);
    const read = await runCli(["workspace", "report", written.report.reportId, root, "--json"]);
    const readPayload = JSON.parse(read.stdout) as {
      schemaVersion: string;
      report: { reportId: string; title: string; bundleVerificationIds: string[] };
      markdown: string;
      markdownVerified: boolean;
    };
    const markdownOnly = await runCli(["workspace", "report", written.report.reportId, root, "--markdown"]);

    expect(list.exitCode).toBe(0);
    expect(listPayload).toMatchObject({
      schemaVersion: "truth-harness.report-draft-list.v0",
      count: 1,
      reports: [
        {
          report: {
            reportId: written.report.reportId,
            title: "CLI Report Draft"
          },
          markdownVerified: true,
          markdownStatus: "verified"
        }
      ]
    });
    expect(humanList.stdout).toContain("Truth Harness saved report drafts");
    expect(humanList.stdout).toContain(written.report.reportId);
    expect(read.exitCode).toBe(0);
    expect(readPayload).toMatchObject({
      schemaVersion: "truth-harness.report-draft-read.v0",
      report: {
        reportId: written.report.reportId,
        title: "CLI Report Draft",
        bundleVerificationIds: ["cver_bbbbbbbbbbbbbbbb"]
      },
      markdown,
      markdownVerified: true
    });
    expect(markdownOnly.stdout.trim()).toBe(markdown.trim());
  });

  it("prioritizes linked validation gates in workspace run-next", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const savedRun = await writeEngineVerificationRun({
      rootPath: root,
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      cvc5Command: "cvc5-test",
      leanCommand: "lean-test",
      sageCommand: "sage-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      requirements: {
        maxima: true,
        z3: true,
        cvc5: true,
        lean: true,
        sage: true
      },
      runner: passingEngineRunner
    });
    const harness = await runCli([
      "research",
      "harness",
      "Prove or refute the reusable invariant for a deterministic robotics simulation kernel.",
      "--workspace",
      root,
      "--domain",
      "math",
      "--domain",
      "physics",
      "--domain",
      "code",
      "--json"
    ]);
    const harnessJson = JSON.parse(harness.stdout) as {
      session: { sessionId: string };
      validationPlan?: { plan: { planId: string } };
    };
    const runNext = await runCli([
      "workspace",
      "run-next",
      root,
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--json"
    ]);
    const plan = JSON.parse(runNext.stdout) as {
      item?: {
        kind: string;
        priority: string;
        sessionId?: string;
        validationPlanId?: string;
        validationGateKind?: string;
        command: string;
      };
      enginePlan?: {
        savedReviewerEvidence?: { status: string; runId?: string; coveredCapabilityIds: string[] };
        steps: Array<{ capabilityId: string; status: string; canRunNow: boolean; limitation: string }>;
      };
    };
    const leanStep = plan.enginePlan?.steps.find((step) => step.capabilityId === "lean-proof-checker");

    expect(runNext.exitCode).toBe(0);
    expect(plan.item).toMatchObject({
      kind: "validation-gate",
      priority: "critical",
      sessionId: harnessJson.session.sessionId,
      validationPlanId: harnessJson.validationPlan?.plan.planId,
      validationGateKind: "proof"
    });
    expect(plan.item?.command).toContain("truth-harness verify");
    expect(plan.enginePlan?.savedReviewerEvidence).toMatchObject({
      status: "available",
      runId: savedRun.record.runId,
      coveredCapabilityIds: expect.arrayContaining(["lean-proof-checker", "sage-cas"])
    });
    expect(leanStep).toMatchObject({
      status: "missing",
      canRunNow: false
    });
    expect(leanStep?.limitation).toContain(`Saved reviewer Docker evidence ${savedRun.record.runId} covers this capability`);
  });

  it("executes candidate validation evidence through workspace run-next CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const harness = await runCli([
      "research",
      "harness",
      "3 / 4 + 5 / 8",
      "--workspace",
      root,
      "--domain",
      "math",
      "--json"
    ]);
    const harnessJson = JSON.parse(harness.stdout) as {
      session: { sessionId: string };
      validationPlan?: { plan: { planId: string; gates: Array<{ gateId: string; kind: string }> } };
    };
    const proofGate = harnessJson.validationPlan?.plan.gates.find((gate) => gate.kind === "proof");
    if (!proofGate || !harnessJson.validationPlan) {
      throw new Error("Expected a CLI research harness validation proof gate.");
    }
    await mkdir(join(root, "proofs"), { recursive: true });
    await writeFile(join(root, "proofs", "candidate.lean"), "theorem candidate_fixture : True := by trivial\n", "utf8");
    const proofRunner: ProofBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
      }

      return { status: 0, stdout: "", stderr: "" };
    };
    const proof = await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "proofs/candidate.lean",
      scope: { statement: "3 / 4 + 5 / 8" },
      runner: proofRunner,
      now: new Date("2026-06-18T00:02:00.000Z")
    });
    const proofRef = relative(root, proof.jsonPath).replace(/\\/gu, "/");
    await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: harnessJson.session.sessionId,
      summary: "Accepted proof artifact is ready for validation gate attachment.",
      evidenceRefs: [{ kind: "proof", ref: proofRef, trust: "proved" }],
      nextChecks: ["Attach the proof artifact to the linked validation gate."],
      now: "2026-06-18T00:03:00.000Z"
    });
    const humanDryRun = await runCli([
      "workspace",
      "run-next",
      root,
      "--max-routes",
      "0",
      "--max-claims",
      "0"
    ]);

    const executed = await runCli([
      "workspace",
      "run-next",
      root,
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--execute-local",
      "--json"
    ]);
    const plan = JSON.parse(executed.stdout) as {
      status: string;
      item?: { command: string; validationGateId?: string };
      execution: {
        kind: string;
        evidenceRef?: string;
        result?: {
          validationGate?: {
            satisfied: boolean;
            gate: { gateId: string; status: string };
          };
        };
      };
    };

    expect(humanDryRun.exitCode).toBe(0);
    expect(humanDryRun.stdout).toContain("Why this action:");
    expect(humanDryRun.stdout).toContain(`Target: validation proof ${proofGate.gateId}`);
    expect(humanDryRun.stdout).toContain(`Candidate evidence: proof:${proofRef}`);
    expect(executed.exitCode).toBe(0);
    expect(plan.status).toBe("executed");
    expect(plan.item).toMatchObject({
      validationGateId: proofGate.gateId,
      command: `truth-harness validation attach ${harnessJson.validationPlan.plan.planId} ${proofGate.gateId} --evidence proof:${proofRef} --json`
    });
    expect(plan.execution).toMatchObject({
      kind: "validation-attach",
      evidenceRef: `proof:${proofRef}`,
      result: {
        validationGate: {
          satisfied: true,
          gate: {
            gateId: proofGate.gateId,
            status: "satisfied"
          }
        }
      }
    });
  });

  it("plans credibility reviewer actions through workspace run-next", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);

    const dryRun = await runCli([
      "workspace",
      "run-next",
      root,
      "--source",
      "credibility-actions",
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--max-sessions",
      "0",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--require-maxima",
      "--json"
    ]);
    const executed = await runCli([
      "workspace",
      "run-next",
      root,
      "--source",
      "credibility-actions",
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--max-sessions",
      "0",
      "--timeout-ms",
      "50",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--require-maxima",
      "--execute-local",
      "--json"
    ]);
    const dryPlan = JSON.parse(dryRun.stdout) as {
      item?: { kind: string; title: string; command: string };
      execution: { kind: string };
    };
    const executedPlan = JSON.parse(executed.stdout) as {
      status: string;
      execution: {
        kind: string;
        evidenceRef?: string;
        result: { schemaVersion: string; status: string };
      };
    };

    expect(dryRun.exitCode).toBe(0);
    expect(dryPlan.item).toMatchObject({
      kind: "credibility-action",
      title: "Close required Maxima symbolic cross-check gate",
      command: "truth-harness engines verify --write --require-maxima --timeout-ms 50 --maxima-command truth-harness-missing-maxima-command --smt-source docs/examples/constraints.smt2 --lean-source docs/examples/lean-fixture/TruthHarnessFixture/Trivial.lean"
    });
    expect(dryPlan.execution.kind).toBe("dry-run");
    expect(executed.exitCode).toBe(0);
    expect(executedPlan.status).toBe("executed");
    expect(executedPlan.execution.kind).toBe("engine-verify");
    expect(executedPlan.execution.evidenceRef).toContain("engine-run:.truth-harness/engine-runs/");
    expect(executedPlan.execution.result).toMatchObject({
      schemaVersion: "truth-harness.engine-run.v0",
      status: "failed"
    });
  });

  it("generates a synthetic workspace stress report from the CLI", async () => {
    const root = await tempRoot();
    const result = await runCli([
      "workspace",
      "stress",
      root,
      "--receipts",
      "10",
      "--claims",
      "5",
      "--routes",
      "2",
      "--json",
      "--fail-on-validation"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      localOnly: boolean;
      networkAccess: string;
      requested: { receipts: number; claims: number; routes: number };
      written: { receipts: number; claims: number; routes: number };
      validation: { passed: boolean; errors: number; checkedFiles: number };
      graph: { nodes: number; edges: number; missingRefs: number };
      claimGraph: { nodes: number; edges: number };
      sampleCommands: { validate: string; review: string; graph: string; snapshot: string };
    };
    const text = await runCli([
      "workspace",
      "stress",
      await tempRoot(),
      "--receipts",
      "4",
      "--claims",
      "2",
      "--routes",
      "1"
    ]);

    expect(result.exitCode).toBe(0);
    expect(json.schemaVersion).toBe("truth-harness.workspace-stress.v0");
    expect(json.localOnly).toBe(true);
    expect(json.networkAccess).toBe("none");
    expect(json.requested).toEqual({ receipts: 10, claims: 5, routes: 2 });
    expect(json.written.receipts).toBe(10);
    expect(json.written.claims).toBe(5);
    expect(json.written.routes).toBe(2);
    expect(json.validation.passed).toBe(true);
    expect(json.validation.errors).toBe(0);
    expect(json.validation.checkedFiles).toBeGreaterThanOrEqual(17);
    expect(json.graph.nodes).toBeGreaterThanOrEqual(17);
    expect(json.graph.missingRefs).toBe(0);
    expect(json.claimGraph.nodes).toBe(5);
    expect(json.claimGraph.edges).toBe(4);
    expect(json.sampleCommands.validate).toContain("truth-harness workspace validate");
    expect(json.sampleCommands.review).toContain("truth-harness workspace review");
    expect(json.sampleCommands.graph).toContain("truth-harness workspace graph");
    expect(json.sampleCommands.snapshot).toContain("truth-harness workspace snapshot");
    expect(text.exitCode).toBe(0);
    expect(text.stdout).toContain("Truth Harness workspace stress");
    expect(text.stdout).toContain("Validation: passed");
    expect(text.stdout).toContain("Stress boundary:");
  });

  it("runs the release audit from the CLI and can fail a blocked gate", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--name", "CLI Release Audit Lab"]);

    const result = await runCli([
      "workspace",
      "release-audit",
      root,
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--max-sessions",
      "0",
      "--timeout-ms",
      "50",
      "--require-maxima",
      "--maxima-command",
      "truth-harness-missing-maxima-command",
      "--json",
      "--fail-on-blocked"
    ]);
    const json = JSON.parse(result.stdout) as {
      schemaVersion: string;
      status: string;
      summary: { blockingFailures: number; catalogFresh: boolean; leanProofSafetyItems: number };
      frontierReadiness: {
        schemaVersion: string;
        status: string;
        frontierDiscoveryReadiness: string;
        canClaimWorldHardestProblems: boolean;
      };
      checks: Array<{ id: string; status: string; blocking: boolean }>;
      commands: { rebuildCatalog: string; engineVerify: string };
    };

    expect(result.exitCode).toBe(1);
    expect(json.schemaVersion).toBe("truth-harness.release-audit.v0");
    expect(json.status).toBe("blocked");
    expect(json.summary.leanProofSafetyItems).toBe(0);
    expect(json.frontierReadiness).toMatchObject({
      schemaVersion: "truth-harness.frontier-readiness.v0",
      status: "blocked",
      frontierDiscoveryReadiness: "not-ready",
      canClaimWorldHardestProblems: false
    });
    expect(json.summary.blockingFailures).toBeGreaterThan(0);
    expect(json.checks).toContainEqual(expect.objectContaining({ id: "engine-evidence", status: "fail", blocking: true }));
    expect(json.checks).toContainEqual(expect.objectContaining({ id: "lean-proof-safety", status: "pass", blocking: false }));
    expect(json.commands.rebuildCatalog).toContain("truth-harness catalog rebuild");
    expect(json.commands.engineVerify).toContain("--require-maxima");

    const human = await runCli([
      "workspace",
      "release-audit",
      root,
      "--max-routes",
      "0",
      "--max-claims",
      "0",
      "--max-sessions",
      "0",
      "--timeout-ms",
      "50"
    ]);

    expect(human.exitCode).toBe(0);
    expect(human.stdout).toContain("Truth Harness release audit");
    expect(human.stdout).toContain("Lean proof-safety blockers: 0");
  });

  it("writes and lists web UI review records from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--name", "CLI UI Review Lab"]);
    const layoutAuditPath = join(root, ".truth-harness", "findings", "ui-layout-audit.json");
    await writeFile(
      layoutAuditPath,
      JSON.stringify({
        schemaVersion: "truth-harness.web-ui-layout-audit.v0",
        generatedAt: "2026-06-19T00:00:00.000Z",
        viewport: { width: 1365, height: 768 },
        status: "passed",
        summary: {
          surfaces: 9,
          passed: 9,
          warnings: 0,
          failures: 0
        },
        surfaces: []
      })
    );

    const written = await runCli([
      "workspace",
      "ui-review",
      root,
      "--write",
      "--json",
      "--target-url",
      "http://127.0.0.1:4180/",
      "--viewport",
      "1365x768",
      "--pass",
      "No visible clipping in the launch workspace",
      "--pass",
      "Composer and readiness chips do not hide the inspected content",
      "--screenshot",
      ".truth-harness/findings/ui-review.png",
      "--layout-audit",
      ".truth-harness/findings/ui-layout-audit.json"
    ]);
    const json = JSON.parse(written.stdout) as {
      review: {
        schemaVersion: string;
        reviewId: string;
        status: string;
        viewport: { width: number; height: number };
        layoutAudit?: { status: string; surfaces: { total: number; passed: number } };
        artifacts: { layoutAudit?: string };
      };
      written: boolean;
      result: { jsonPath: string };
    };
    const listed = await runCli(["workspace", "ui-reviews", root, "--json"]);
    const listJson = JSON.parse(listed.stdout) as {
      total: number;
      reviews: Array<{ reviewId: string; status: string; layoutAudit?: string; layoutAuditStatus?: string }>;
    };

    expect(written.exitCode).toBe(0);
    expect(json.written).toBe(true);
    expect(json.review.schemaVersion).toBe("truth-harness.web-ui-review.v0");
    expect(json.review.status).toBe("passed");
    expect(json.review.viewport).toEqual({ width: 1365, height: 768 });
    expect(json.review.layoutAudit).toMatchObject({
      status: "passed",
      surfaces: {
        total: 9,
        passed: 9
      }
    });
    expect(json.review.artifacts.layoutAudit).toBe(".truth-harness/findings/ui-layout-audit.json");
    expect(json.result.jsonPath).toContain(".truth-harness");
    expect(listed.exitCode).toBe(0);
    expect(listJson.total).toBe(1);
    expect(listJson.reviews[0]).toMatchObject({
      reviewId: json.review.reviewId,
      status: "passed",
      layoutAudit: ".truth-harness/findings/ui-layout-audit.json",
      layoutAuditStatus: "passed"
    });
  });

  it("writes, lists, compares, and gates benchmark artifacts", async () => {
    const root = await tempRoot();
    const passingSuite = join(root, "passing-suite.json");
    const failingSuite = join(root, "failing-suite.json");
    await writeSuite(passingSuite, {
      id: "cli-passing",
      title: "CLI Passing",
      description: "Passing benchmark suite for CLI gate coverage.",
      tasks: [
        {
          id: "exact-two-plus-two",
          prompt: "compute 2 + 2",
          expectTrust: "exact-computed",
          expectSummaryIncludes: "4"
        }
      ]
    });
    await writeSuite(failingSuite, {
      id: "cli-passing",
      title: "CLI Passing",
      description: "Failing benchmark suite for CLI gate coverage.",
      tasks: [
        {
          id: "exact-two-plus-two",
          prompt: "compute 2 + 2",
          expectTrust: "refuted"
        }
      ]
    });

    await runCli(["workspace", "init", root, "--json"]);
    const passing = await runCli(["bench", "run", passingSuite, "--workspace", root, "--write", "--json", "--fail-on-failures"]);
    const failing = await runCli(["bench", "run", failingSuite, "--workspace", root, "--write", "--json", "--fail-on-failures"]);
    const passingJson = JSON.parse(passing.stdout) as {
      run: { failed: number };
      result: { jsonPath: string; record: { command?: string; replay: { command?: string } } };
    };
    const failingJson = JSON.parse(failing.stdout) as {
      run: { failed: number };
      result: { jsonPath: string; record: { command?: string; replay: { command?: string } } };
    };
    const listBeforeCompare = JSON.parse((await runCli(["bench", "list", root, "--json"])).stdout) as { total: number };
    const comparison = await runCli([
      "bench",
      "compare",
      passingJson.result.jsonPath,
      failingJson.result.jsonPath,
      "--workspace",
      root,
      "--write",
      "--json",
      "--fail-on-regression"
    ]);
    const comparisonJson = JSON.parse(comparison.stdout) as {
      comparison: { verdict: string; summary: { regressions: number } };
      result: { jsonPath: string };
    };
    const listAfterCompare = JSON.parse((await runCli(["bench", "list", root, "--json"])).stdout) as { total: number };

    expect(passing.exitCode).toBe(0);
    expect(passingJson.run.failed).toBe(0);
    expect(passingJson.result.record.command).toBe(
      `truth-harness bench run ${passingSuite} --write --workspace ${root} --fail-on-failures`
    );
    expect(passingJson.result.record.replay.command).toBe(passingJson.result.record.command);
    expect(failing.exitCode).toBe(1);
    expect(failingJson.run.failed).toBe(1);
    expect(listBeforeCompare.total).toBe(2);
    expect(comparison.exitCode).toBe(1);
    expect(comparisonJson.comparison.verdict).toBe("regressed");
    expect(comparisonJson.comparison.summary.regressions).toBe(1);
    expect(comparisonJson.result.jsonPath).toContain(".truth-harness");
    expect(listAfterCompare.total).toBe(3);
  });

  it("writes, lists, and shows claim ledger records", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const receiptsDir = join(root, ".truth-harness", "receipts");
    await mkdir(receiptsDir, { recursive: true });
    await writeFile(
      join(receiptsDir, "base-fraction.json"),
      `${JSON.stringify(createReceipt("compute 3 / 4"), null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(receiptsDir, "fraction-sum.json"),
      `${JSON.stringify(createReceipt("compute 3 / 4 + 5 / 8"), null, 2)}\n`,
      "utf8"
    );

    const base = await runCli([
      "claim",
      "add",
      "3 / 4 is exactly 3 / 4",
      "--workspace",
      root,
      "--domain",
      "math",
      "--trust",
      "exact-computed",
      "--tag",
      "fractions",
      "--evidence",
      "receipt:.truth-harness/receipts/base-fraction.json",
      "--json"
    ]);
    const baseJson = JSON.parse(base.stdout) as { claim: { claimId: string; trust: string } };
    const derived = await runCli([
      "claim",
      "add",
      "3 / 4 + 5 / 8 equals 11 / 8",
      "--workspace",
      root,
      "--domain",
      "math",
      "--trust",
      "exact-computed",
      "--depends-on",
      baseJson.claim.claimId,
      "--evidence",
      `claim:${baseJson.claim.claimId}`,
      "--evidence",
      "receipt:.truth-harness/receipts/fraction-sum.json",
      "--json"
    ]);
    const derivedJson = JSON.parse(derived.stdout) as {
      claim: { claimId: string; dependsOn: string[]; finalization: { readyForNarrowClaim: boolean } };
    };
    const list = JSON.parse((await runCli(["claim", "list", root, "--json"])).stdout) as {
      total: number;
      graph: { edges: Array<{ from: string; to: string; kind: string }> };
    };
    const shown = JSON.parse(
      (await runCli(["claim", "show", derivedJson.claim.claimId, "--workspace", root, "--json"])).stdout
    ) as { claimId: string; dependsOn: string[] };
    const review = JSON.parse(
      (await runCli(["claim", "review", derivedJson.claim.claimId, "--workspace", root, "--json"])).stdout
    ) as { claimId: string; reviewStatus: string; nextActions: unknown[]; markdown: string };
    const reviewText = await runCli(["claim", "review", derivedJson.claim.claimId, "--workspace", root]);

    expect(base.exitCode).toBe(0);
    expect(baseJson.claim.trust).toBe("exact-computed");
    expect(derived.exitCode).toBe(0);
    expect(derivedJson.claim.dependsOn).toEqual([baseJson.claim.claimId]);
    expect(derivedJson.claim.finalization.readyForNarrowClaim).toBe(true);
    expect(list.total).toBe(2);
    expect(list.graph.edges).toContainEqual({
      from: baseJson.claim.claimId,
      to: derivedJson.claim.claimId,
      kind: "depends-on"
    });
    expect(shown.claimId).toBe(derivedJson.claim.claimId);
    expect(review.claimId).toBe(derivedJson.claim.claimId);
    expect(review.reviewStatus).toBe("ready");
    expect(review.nextActions).toEqual([]);
    expect(review.markdown).toContain("## Agent Next Actions");
    expect(reviewText.exitCode).toBe(0);
    expect(reviewText.stdout).toContain("Claim review");
    expect(reviewText.stdout).toContain("Status: ready");
  });

  it("starts, checkpoints, lists, and shows research sessions", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);

    const start = await runCli([
      "research",
      "start",
      "Investigate a reusable exact arithmetic proof route.",
      "--workspace",
      root,
      "--domain",
      "math",
      "--task",
      "Create a verifier route",
      "--json"
    ]);
    const started = JSON.parse(start.stdout) as {
      session: { sessionId: string; schemaVersion: string; tasks: Array<{ taskId: string; status: string }> };
    };
    const checkpoint = await runCli([
      "research",
      "checkpoint",
      started.session.sessionId,
      "Recorded the next verification step for the session.",
      "--workspace",
      root,
      "--next-check",
      "Attach a workspace review handoff before delegating.",
      "--json"
    ]);
    const taskUpdate = JSON.parse(
      (
        await runCli([
          "research",
          "task",
          started.session.sessionId,
          started.session.tasks[0]?.taskId ?? "",
          "--workspace",
          root,
          "--status",
          "blocked",
          "--next-check",
          "Attach a workspace review handoff before delegating.",
          "--json"
        ])
      ).stdout
    ) as { task: { taskId: string; status: string; nextChecks: string[] } };
    const shown = JSON.parse(
      (await runCli(["research", "show", started.session.sessionId, "--workspace", root, "--json"])).stdout
    ) as { sessionId: string; checkpoints: unknown[] };
    const list = JSON.parse((await runCli(["research", "list", root, "--json"])).stdout) as { total: number };
    const humanShow = await runCli(["research", "show", started.session.sessionId, "--workspace", root]);
    const handoff = JSON.parse(
      (
        await runCli([
          "workspace",
          "review",
          root,
          "--max-routes",
          "0",
          "--max-claims",
          "0",
          "--max-sessions",
          "1",
          "--json"
        ])
      ).stdout
    ) as {
      summary: { sessions: number; sessionTasks: number; sessionNextChecks: number };
      items: Array<{ kind: string; sessionId?: string; command: string }>;
    };

    expect(start.exitCode).toBe(0);
    expect(started.session.schemaVersion).toBe("truth-harness.research-session.v0");
    expect(started.session.sessionId).toMatch(/^session_[a-f0-9]{16}$/u);
    expect(started.session.tasks).toHaveLength(1);
    expect(checkpoint.exitCode).toBe(0);
    expect(taskUpdate.task.status).toBe("blocked");
    expect(taskUpdate.task.nextChecks).toContain("Attach a workspace review handoff before delegating.");
    expect(shown.sessionId).toBe(started.session.sessionId);
    expect(shown.checkpoints).toHaveLength(1);
    expect(list.total).toBe(1);
    expect(humanShow.stdout).toContain(`Truth Harness research session ${started.session.sessionId}`);
    expect(humanShow.stdout).toContain("Recent checkpoints:");
    expect(handoff.summary.sessions).toBe(1);
    expect(handoff.summary.sessionTasks).toBe(1);
    expect(handoff.summary.sessionNextChecks).toBe(1);
    expect(handoff.items).toContainEqual(
      expect.objectContaining({
        kind: "session-task",
        sessionId: started.session.sessionId,
        command: expect.stringContaining("truth-harness research show")
      })
    );
  });

  it("starts a hard-problem research harness from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);

    const result = await runCli([
      "research",
      "harness",
      "Investigate deterministic math and physics verification for AI-generated robotics simulation code.",
      "--workspace",
      root,
      "--domain",
      "math",
      "--domain",
      "physics",
      "--domain",
      "code",
      "--task",
      "Pick the first falsifiable benchmark.",
      "--json"
    ]);
    const json = JSON.parse(result.stdout) as {
      session: {
        sessionId: string;
        schemaVersion: string;
        tasks: Array<{ title: string }>;
        budgets: { maxUnverifiedFinalClaims: number };
      };
      validationPlan?: {
        plan: {
          schemaVersion: string;
          evidenceRefs: Array<{ kind: string; ref: string }>;
        };
      };
      markdown: string;
    };
    const taskTitles = json.session.tasks.map((task) => task.title);
    const list = JSON.parse((await runCli(["research", "list", root, "--json"])).stdout) as { total: number };
    const validationList = JSON.parse((await runCli(["validation", "list", root, "--json"])).stdout) as { total: number };

    expect(result.exitCode).toBe(0);
    expect(json.session.schemaVersion).toBe("truth-harness.research-session.v0");
    expect(json.validationPlan?.plan.schemaVersion).toBe("truth-harness.validation-plan.v0");
    expect(json.validationPlan?.plan.evidenceRefs).toContainEqual(
      expect.objectContaining({ kind: "session", ref: json.session.sessionId })
    );
    expect(taskTitles).toContain(
      "Run `truth-harness engines readiness` and record which trust labels this machine can responsibly support."
    );
    expect(taskTitles).toContain(
      "Never label a result `proved` unless an accepted proof checker verifies the concrete proof artifact."
    );
    expect(taskTitles).toContain("Pick the first falsifiable benchmark.");
    expect(json.session.budgets.maxUnverifiedFinalClaims).toBe(0);
    expect(json.markdown).toContain("truth-harness engines readiness");
    expect(list.total).toBe(1);
    expect(validationList.total).toBe(1);
  });

  it("writes an initial run-next handoff when starting a hard-problem harness", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);

    const result = await runCli([
      "research",
      "harness",
      "Investigate a reusable exact arithmetic lemma before broadening the simulation claim.",
      "--workspace",
      root,
      "--domain",
      "math",
      "--claim",
      "3 / 4 + 5 / 8",
      "--validation-claim",
      "3 / 4 + 5 / 8",
      "--plan-next",
      "--json"
    ]);
    const json = JSON.parse(result.stdout) as {
      session: { sessionId: string };
      validationPlan?: {
        plan: {
          planId: string;
          gates: Array<{ gateId: string; kind: string; status: string }>;
        };
      };
      runNext?: {
        plan: {
          planId: string;
          status: string;
          item?: {
            kind: string;
            validationPlanId?: string;
            validationGateKind?: string;
            sessionId?: string;
            command?: string;
          };
          sourceSnapshot?: { snapshotId: string };
        };
        jsonPath: string;
        markdownPath: string;
      };
    };
    const listed = JSON.parse((await runCli(["workspace", "run-nexts", root, "--json"])).stdout) as {
      total: number;
      plans: Array<{ planId: string }>;
    };

    expect(result.exitCode).toBe(0);
    expect(json.validationPlan?.plan.planId).toMatch(/^plan_[a-f0-9]{16}$/u);
    expect(json.runNext?.plan).toMatchObject({
      status: "planned",
      item: {
        kind: "validation-gate",
        validationPlanId: json.validationPlan?.plan.planId,
        validationGateKind: "proof",
        sessionId: json.session.sessionId,
        command: expect.stringContaining("truth-harness verify")
      }
    });
    expect(json.runNext?.plan.sourceSnapshot?.snapshotId).toMatch(/^snap_[a-f0-9]{16}$/u);
    expect(json.runNext?.jsonPath).toContain(".truth-harness");
    expect(json.runNext?.markdownPath).toContain(".truth-harness");
    expect(existsSync(json.runNext?.jsonPath ?? "")).toBe(true);
    expect(existsSync(json.runNext?.markdownPath ?? "")).toBe(true);
    expect(listed.total).toBe(1);
    expect(listed.plans[0]?.planId).toBe(json.runNext?.plan.planId);
  });

  it("seeds mathlib theorem-family validation gates from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    await cp(
      join(process.cwd(), "docs", "examples", "lean-mathlib-template"),
      join(root, "docs", "examples", "lean-mathlib-template"),
      { recursive: true }
    );

    const result = await runCli([
      "validation",
      "mathlib-plan",
      "docs/examples/lean-mathlib-template",
      "--workspace",
      root,
      "--json"
    ]);
    const json = JSON.parse(result.stdout) as {
      session: { sessionId: string; evidenceRefs: Array<{ kind: string; ref: string }> };
      familyCount: number;
      declarationCount: number;
      validationPlans: Array<{
        familyId: string;
        declarationName: string;
        validationPlan: { plan: { planId: string; gates: Array<{ kind: string }> } };
      }>;
    };
    const runNext = JSON.parse((await runCli(["workspace", "run-next", root, "--json"])).stdout) as {
      item?: { kind: string; command?: string; validationGateKind?: string };
    };

    expect(result.exitCode).toBe(0);
    expect(json.familyCount).toBe(5);
    expect(json.declarationCount).toBe(5);
    expect(json.validationPlans[0]).toMatchObject({
      familyId: "finite-set-cardinality",
      declarationName: "finset_card_singleton_template"
    });
    expect(json.validationPlans.every((target) => target.validationPlan.plan.gates.some((gate) => gate.kind === "proof"))).toBe(true);
    expect(json.session.evidenceRefs).toContainEqual(
      expect.objectContaining({ kind: "validation", ref: json.validationPlans[0]?.validationPlan.plan.planId })
    );
    expect(runNext.item).toMatchObject({
      kind: "validation-gate",
      validationGateKind: "proof",
      command: expect.stringContaining("truth-harness proof check")
    });
    expect(runNext.item?.command).toContain("--project docs/examples/lean-mathlib-template");
    expect(
      json.validationPlans.some((target) => runNext.item?.command?.includes(`--declaration ${target.declarationName}`))
    ).toBe(true);
  });
  it("attaches verifier route evidence to validation gates from the CLI", async () => {
    const root = await tempRoot();
    await runCli(["workspace", "init", root, "--json"]);
    const planResult = await runCli([
      "validation",
      "plan",
      "3 / 4 + 5 / 8",
      "--workspace",
      root,
      "--domain",
      "math",
      "--json"
    ]);
    const planJson = JSON.parse(planResult.stdout) as {
      plan: {
        planId: string;
        gates: Array<{ gateId: string; kind: string; status: string }>;
      };
    };
    const proofGate = planJson.plan.gates.find((gate) => gate.kind === "proof");
    if (!proofGate) {
      throw new Error("Expected validation plan to include a proof gate.");
    }
    const route = await runCli([
      "verify",
      "3 / 4 + 5 / 8",
      "--workspace",
      root,
      "--write",
      "--json"
    ]);
    const routeJson = JSON.parse(route.stdout) as {
      route: { routeId: string; finalTrust: string };
    };
    const attach = await runCli([
      "validation",
      "attach",
      planJson.plan.planId,
      proofGate.gateId,
      "--workspace",
      root,
      "--evidence",
      `route:${routeJson.route.routeId}`,
      "--json"
    ]);
    const attached = JSON.parse(attach.stdout) as {
      satisfied: boolean;
      blocked: boolean;
      gate: { status: string; evidenceRefs: Array<{ kind: string; ref: string; trust?: string }> };
      message: string;
    };
    const human = await runCli([
      "validation",
      "attach",
      planJson.plan.planId,
      proofGate.gateId,
      "--workspace",
      root,
      "--evidence",
      `route:${routeJson.route.routeId}`
    ]);

    expect(routeJson.route.finalTrust).toBe("exact-computed");
    expect(attached).toMatchObject({
      satisfied: true,
      blocked: false,
      gate: {
        status: "satisfied",
        evidenceRefs: [expect.objectContaining({ kind: "route", ref: routeJson.route.routeId, trust: "exact-computed" })]
      }
    });
    expect(attached.message).toContain("satisfied");
    expect(human.stdout).toContain("Gate status: satisfied");
  });
});

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const previousExitCode = process.exitCode;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((...values) => {
    stdout.push(values.join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...values) => {
    stderr.push(values.join(" "));
  });

  try {
    process.exitCode = undefined;
    await program.parseAsync(["node", "truth-harness", ...args], { from: "node" });
    return {
      exitCode: Number(process.exitCode ?? 0),
      stdout: stdout.join("\n"),
      stderr: stderr.join("\n")
    };
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

async function writeSuite(path: string, suite: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(suite, null, 2)}\n`, "utf8");
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-cli-"));
  roots.push(root);
  return root;
}

const passingEngineRunner: EngineVerificationCommandRunner = (command, args) => {
  if (command === "maxima-test" && args[0] === "--version") {
    return { status: 0, stdout: "Maxima 5.47.0\n", stderr: "" };
  }
  if (command === "maxima-test") {
    return { status: 0, stdout: "TRUTH_HARNESS_MAXIMA_STATUS:passed:0\n", stderr: "" };
  }
  if (command === "z3-test" && args[0] === "-version") {
    return { status: 0, stdout: "Z3 version 4.13.0\n", stderr: "" };
  }
  if (command === "z3-test") {
    return { status: 0, stdout: "sat\n", stderr: "" };
  }
  if (command === "cvc5-test" && args[0] === "--version") {
    return { status: 0, stdout: "This is cvc5 version 1.1.2\n", stderr: "" };
  }
  if (command === "cvc5-test") {
    return { status: 0, stdout: "sat\n", stderr: "" };
  }
  if (command === "lean-test" && args[0] === "--version") {
    return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
  }
  if (command === "lean-test") {
    return { status: 0, stdout: "", stderr: "" };
  }
  if (command === "sage-test" && args[0] === "--version") {
    return { status: 0, stdout: "SageMath version 10.6\n", stderr: "" };
  }
  if (command === "sage-test") {
    return { status: 0, stdout: "TRUTH_HARNESS_SAGE_STATUS:passed:0\n", stderr: "" };
  }

  return {
    status: null,
    stdout: "",
    stderr: "",
    error: { name: "Error", message: `unexpected command ${command} ${args.join(" ")}` }
  };
};
