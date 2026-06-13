import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeBenchmarkComparisonRecord, writeBenchmarkRunRecord } from "./benchmark-run.js";
import { writeSymbolicCasCheckRecord, type CasBackendCommandRunner } from "./cas-backend.js";
import { writeClaimChart } from "./claim-chart.js";
import { writeCodeRun } from "./code-run.js";
import { createExternalDisclosureLogEntry } from "./disclosure-log.js";
import { writeEvidenceAudit } from "./evidence-audit.js";
import { createExperimentLogEntry } from "./experiment-log.js";
import { writeExpertReview } from "./expert-review.js";
import { createInventionLogEntry } from "./invention-log.js";
import { ingestLocalCorpus } from "./local-corpus.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { writeLiteratureRecord } from "./literature-record.js";
import { writeModelContext } from "./model-context.js";
import { writeNotebookRun } from "./notebook-run.js";
import { createReceipt } from "./receipt.js";
import { writeResearchSession } from "./research-session.js";
import { createSimulationLogEntry } from "./simulation-log.js";
import { writeSmtCheckRecord, type SmtBackendCommandRunner } from "./smt-backend.js";
import { writeValidationPlan } from "./validation-plan.js";
import { sealVaultFile } from "./vault.js";
import { validateWorkspaceArtifacts } from "./workspace-validation.js";
import { writeWorkspaceSnapshot } from "./workspace-snapshot.js";
import { writeVerifierRoute } from "./verifier-route.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace artifact validation", () => {
  it("passes valid local receipt artifacts", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-10T00:00:00.000Z" });
    await writeReceipt(root, "valid.json", createReceipt("compute 3 / 4 + 5 / 8"));

    const validation = await validateWorkspaceArtifacts({
      rootPath: root,
      now: "2026-06-10T01:00:00.000Z"
    });

    expect(validation.schemaVersion).toBe("truth-harness.workspace-validation.v0");
    expect(validation.passed).toBe(true);
    expect(validation.summary.checkedFiles).toBe(2);
    expect(validation.summary.validFiles).toBe(2);
    expect(validation.summary.errors).toBe(0);
    expect(validation.summary.byTrust["exact-computed"]).toBe(1);
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "manifest",
        valid: true,
        path: ".truth-harness/project.json"
      })
    );
    expect(validation.artifacts).toContainEqual(expect.objectContaining({
      kind: "receipts",
      valid: true,
      path: ".truth-harness/receipts/valid.json",
      trust: "exact-computed"
    }));
  });

  it("fails legacy receipt artifacts before agents can rely on stale JSON", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const legacyReceipt = { ...createReceipt("compute 2 + 2") } as Record<string, unknown>;
    delete legacyReceipt.evidenceProfile;
    await writeReceipt(root, "legacy.json", legacyReceipt);

    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(validation.passed).toBe(false);
    expect(validation.summary.invalidFiles).toBe(1);
    expect(validation.issues[0]).toMatchObject({
      severity: "error",
      code: "invalid-receipt-schema",
      path: ".truth-harness/receipts/legacy.json"
    });
    expect(validation.issues[0]?.message).toContain("$.evidenceProfile");
    expect(validation.artifacts.find((artifact) => artifact.path.endsWith("legacy.json"))?.valid).toBe(false);
  });

  it("fails forged proved receipts without accepted proof-checker metadata", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const receipt = { ...createReceipt("compute 2 + 2"), trust: "proved" as const };
    await writeReceipt(root, "forged-proved.json", receipt);

    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(validation.passed).toBe(false);
    expect(validation.summary.checkedFiles).toBe(2);
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "proved-without-proof-checker",
        path: ".truth-harness/receipts/forged-proved.json"
      })
    );
    expect(validation.artifacts.find((artifact) => artifact.path.endsWith("forged-proved.json"))?.issueCodes).toContain(
      "proved-without-proof-checker"
    );
  });

  it("fails workspace manifests that are not local-first by default", async () => {
    const root = await tempRoot();
    const initialized = await initLocalWorkspace(root);
    await writeFile(
      initialized.manifestPath,
      `${JSON.stringify(
        {
          ...initialized.manifest,
          privacy: {
            ...initialized.manifest.privacy,
            mode: "external-calls",
            localFirst: false,
            networkAccess: "required",
            externalDisclosures: [
              {
                service: "Hosted Model",
                purpose: "Tampered default policy",
                dataClasses: ["project data"],
                userInitiated: false
              }
            ]
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(validation.passed).toBe(false);
    expect(validation.summary.byKind.manifest).toBe(1);
    expect(validation.artifacts.find((artifact) => artifact.kind === "manifest")).toMatchObject({
      valid: false,
      path: ".truth-harness/project.json",
      issueCodes: expect.arrayContaining(["invalid-artifact-schema"])
    });
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "invalid-artifact-schema",
        path: ".truth-harness/project.json",
        message: expect.stringContaining("$.privacy.mode must equal \"local-only\"")
      })
    );
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "invalid-artifact-schema",
        path: ".truth-harness/project.json",
        message: expect.stringContaining("$.privacy.localFirst must equal true")
      })
    );
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "invalid-artifact-schema",
        path: ".truth-harness/project.json",
        message: expect.stringContaining("$.privacy.networkAccess must equal \"none\"")
      })
    );
  });

  it("advises repair when manifests are missing newer default directories", async () => {
    const root = await tempRoot();
    const initialized = await initLocalWorkspace(root);
    const legacyDirectories = { ...initialized.manifest.directories } as Partial<typeof initialized.manifest.directories>;
    delete legacyDirectories["code-runs"];
    await writeFile(
      initialized.manifestPath,
      `${JSON.stringify({ ...initialized.manifest, directories: legacyDirectories }, null, 2)}\n`,
      "utf8"
    );

    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(validation.passed).toBe(false);
    expect(validation.warnings[0]).toContain("truth-harness workspace repair");
    expect(validation.warnings[0]).toContain("code-runs");
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        code: "invalid-artifact-schema",
        path: ".truth-harness/project.json"
      })
    );
  });

  it("checks top-level schema and ids for non-receipt workspace records", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const simulation = await createSimulationLogEntry({
      rootPath: root,
      title: "Toy simulation",
      question: "Can a toy local model produce a bounded output?",
      kind: "physics",
      engine: "local test runner",
      modelName: "toy-model",
      metrics: [{ name: "score", value: "1" }],
      assumptions: ["Unit-test-only assumptions."],
      uncertainty: ["No calibrated uncertainty model."],
      limitations: ["No real-world validation."],
      nextChecks: ["Attach a notebook-run record."]
    });
    await writeWorkspaceJson(root, "notebook-runs", "bad-run.json", {
      title: "Missing schema and id"
    });

    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(validation.passed).toBe(false);
    expect(validation.summary.checkedFiles).toBe(3);
    expect(validation.summary.byKind.simulations).toBe(1);
    expect(validation.summary.byKind["notebook-runs"]).toBe(1);
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "simulations",
        valid: true,
        schemaVersion: "truth-harness.simulation.v0",
        artifactId: simulation.entry.simulationId
      })
    );
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "missing-schema-version",
        path: ".truth-harness/notebook-runs/bad-run.json"
      })
    );
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "missing-artifact-id",
        path: ".truth-harness/notebook-runs/bad-run.json"
      })
    );
  });

  it("passes a golden workspace generated by the artifact writer APIs", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, {
      displayName: "Golden Validation Lab",
      now: "2026-06-10T00:00:00.000Z"
    });
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(
      join(root, "docs", "source-notes.md"),
      "# Source Notes\n\nToy pathway notes for local source citation and review.\n",
      "utf8"
    );
    await writeFile(join(root, "private-note.txt"), "local-only private note\n", "utf8");
    await writeFile(
      join(root, "golden-constraints.smt2"),
      "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      "utf8"
    );
    await ingestLocalCorpus({
      rootPath: root,
      paths: ["docs/source-notes.md"],
      now: "2026-06-10T00:05:00.000Z"
    });
    await writeReceipt(root, "exact.json", createReceipt("compute 3 / 4 + 5 / 8"));
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      now: new Date("2026-06-10T00:06:00.000Z"),
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      timeoutMs: 50
    });
    const simulation = await createSimulationLogEntry({
      rootPath: root,
      title: "Golden toy simulation",
      question: "Can a toy local model produce a bounded output?",
      kind: "physics",
      stage: "computed",
      engine: "local test runner",
      modelName: "toy-model",
      metrics: [{ name: "score", value: "1" }],
      assumptions: ["Unit-test-only assumptions."],
      uncertainty: ["No calibrated uncertainty model."],
      limitations: ["No real-world validation."],
      nextChecks: ["Independent replay."],
      now: "2026-06-10T00:10:00.000Z"
    });
    const experiment = await createExperimentLogEntry({
      rootPath: root,
      title: "Golden toy experiment",
      question: "Did a toy protocol record an observation?",
      kind: "bench",
      stage: "completed",
      protocolRefs: ["docs/source-notes.md"],
      dataRefs: ["artifacts/toy-data.csv"],
      analysisRefs: ["notebooks/toy-analysis.ipynb"],
      observations: ["A toy observation was recorded."],
      measurements: [{ name: "marker_delta", value: "0.1", unit: "a.u." }],
      outcomeSummary: "Toy protocol evidence only.",
      limitations: ["Not replicated."],
      nextChecks: ["Independent review."],
      now: "2026-06-10T00:15:00.000Z"
    });
    const literature = await writeLiteratureRecord({
      rootPath: root,
      title: "Golden source note",
      kind: "note",
      status: "annotated",
      localRefs: ["docs/source-notes.md"],
      corpusRefs: ["source:docs/source-notes.md#chunk_1"],
      summary: "A local source note for golden validation.",
      keyClaims: ["The note describes toy pathway context."],
      limitations: ["Local note only."],
      nextChecks: ["Check entailment manually."],
      now: "2026-06-10T00:20:00.000Z"
    });
    const notebook = await writeNotebookRun({
      rootPath: root,
      title: "Golden notebook provenance",
      purpose: "Record a local toy analysis command without executing it.",
      kind: "script",
      status: "completed",
      runner: "node",
      command: "node scripts/toy-analysis.js",
      codeRefs: ["scripts/toy-analysis.js"],
      outputRefs: ["artifacts/toy-output.json"],
      runtime: "node",
      runtimeVersion: "22",
      dependencies: ["typescript"],
      metrics: [{ name: "checked_cases", value: "2" }],
      observations: ["Metadata-only provenance was recorded."],
      limitations: ["The workbench did not execute this run."],
      nextChecks: ["Replay independently."],
      now: "2026-06-10T00:25:00.000Z"
    });
    const codeRun = await writeCodeRun({
      rootPath: root,
      title: "Golden code execution",
      purpose: "Execute a tiny local command and capture process evidence.",
      command: process.execPath,
      args: ["-e", "console.log('golden-code-run')"],
      codeRefs: ["inline:node-eval"],
      inputRefs: ["prompt:golden-code-run"],
      outputRefs: ["stdout"],
      policy: {
        allowedExecutables: [process.execPath]
      },
      now: "2026-06-10T00:25:30.000Z"
    });
    const benchmarkReceipt = createReceipt("compute 2 + 2");
    const benchmark = await writeBenchmarkRunRecord({
      rootPath: root,
      run: {
        suiteId: "golden-regression",
        title: "Golden Regression",
        startedAt: "2026-06-10T00:26:00.000Z",
        completedAt: "2026-06-10T00:26:01.000Z",
        total: 1,
        passed: 1,
        failed: 0,
        trustAccuracy: 1,
        results: [
          {
            task: {
              id: "exact-two-plus-two",
              prompt: benchmarkReceipt.problem,
              expectTrust: benchmarkReceipt.trust,
              expectSummaryIncludes: "4"
            },
            receipt: benchmarkReceipt,
            passed: true,
            failures: []
          }
        ]
      },
      suiteDescription: "Golden one-case benchmark run for workspace validation.",
      suitePath: "packages/benchmarks/suites/golden-regression.json",
      runnerName: "vitest",
      runnerAdapter: "local-receipt-engine",
      command: "truth-harness bench run packages/benchmarks/suites/golden-regression.json",
      workingDirectory: root,
      now: "2026-06-10T00:27:00.000Z"
    });
    const benchmarkComparison = await writeBenchmarkComparisonRecord({
      rootPath: root,
      baseline: benchmark.record,
      current: benchmark.record,
      baselineRef: benchmark.jsonPath,
      currentRef: benchmark.jsonPath,
      now: "2026-06-10T00:28:00.000Z"
    });
    const smtRunner: SmtBackendCommandRunner = (_command, args) => {
      if (args[0] === "-version") {
        return {
          status: 0,
          stdout: "Z3 version 4.13.0\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "sat\n",
        stderr: ""
      };
    };
    const smt = await writeSmtCheckRecord({
      rootPath: root,
      sourcePath: "golden-constraints.smt2",
      queryName: "golden_positive_integer_model",
      runner: smtRunner,
      now: new Date("2026-06-10T00:29:00.000Z")
    });
    const casRunner: CasBackendCommandRunner = (_command, args) => {
      if (args[0] === "--version") {
        return {
          status: 0,
          stdout: "Maxima 5.47.0\n",
          stderr: ""
        };
      }

      return {
        status: 0,
        stdout: "TRUTH_HARNESS_MAXIMA_STATUS:passed:0\n",
        stderr: ""
      };
    };
    const cas = await writeSymbolicCasCheckRecord({
      rootPath: root,
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      },
      result: "1",
      maximaCommand: "maxima-test",
      runner: casRunner,
      now: new Date("2026-06-10T00:29:30.000Z")
    });
    const review = await writeExpertReview({
      rootPath: root,
      subject: "Golden simulation evidence",
      question: "Is the toy simulation scoped correctly?",
      kind: "domain-expert",
      status: "completed",
      reviewerRole: "unit-test reviewer",
      conflictDisclosure: "none",
      evidenceRefs: [{ kind: "simulation", ref: simulation.entry.simulationId }],
      findings: ["The simulation is scoped as toy evidence."],
      limitations: ["Not a real domain review."],
      recommendations: ["Keep claims narrow."],
      requiredNextChecks: ["Replay independently."],
      outcomeStatus: "supported-with-limitations",
      outcomeSummary: "Supported only as a toy validation fixture.",
      now: "2026-06-10T00:30:00.000Z"
    });
    const disclosure = await createExternalDisclosureLogEntry({
      rootPath: root,
      service: "OpenAI",
      model: "frontier-reasoning-model",
      purpose: "Ask a hosted model to critique a selected proof sketch.",
      dataClasses: ["selected proof sketch"],
      contextSummary: "Only a selected local source note is disclosed.",
      selectedContextRefs: ["source:docs/source-notes.md#chunk_1"],
      approvalRef: "prompt:explicit-user-request",
      status: "sent",
      now: "2026-06-10T00:35:00.000Z"
    });
    const modelContext = await writeModelContext({
      rootPath: root,
      purpose: "Ask a hosted model to critique a selected proof sketch.",
      service: "OpenAI",
      model: "frontier-reasoning-model",
      dataClasses: ["selected proof sketch"],
      selectedContextRefs: ["source:docs/source-notes.md#chunk_1"],
      sections: [
        {
          title: "Selected source note",
          content: "Toy pathway notes for local source citation and review.",
          sourceRefs: ["source:docs/source-notes.md#chunk_1"]
        }
      ],
      approvalRef: "prompt:explicit-user-request",
      disclosureRef: disclosure.entry.disclosureId,
      disclosureStatus: "sent",
      redactions: ["No secrets or personal data included."],
      now: "2026-06-10T00:40:00.000Z"
    });
    const invention = await createInventionLogEntry({
      rootPath: root,
      title: "Golden toy hypothesis",
      problem: "Keep discovery records schema-valid without making strong claims.",
      hypothesis: "A toy local workflow can generate linked evidence records.",
      validationStage: "computational-hypothesis",
      evidenceRefs: [
        { kind: "simulation", ref: simulation.entry.simulationId },
        { kind: "experiment", ref: experiment.entry.experimentId },
        { kind: "literature", ref: literature.record.recordId },
        { kind: "notebook-run", ref: notebook.record.runRecordId },
        { kind: "code-run", ref: codeRun.record.runId },
        { kind: "benchmark", ref: benchmark.record.benchmarkRunId },
        { kind: "review", ref: review.review.reviewId },
        { kind: "disclosure", ref: disclosure.entry.disclosureId }
      ],
      noveltyNotes: ["No novelty conclusion."],
      priorArtNotes: ["Prior art not searched."],
      risks: ["Toy fixture only."],
      nextChecks: ["Run workspace validation."],
      now: "2026-06-10T00:45:00.000Z"
    });
    const claimChart = await writeClaimChart({
      rootPath: root,
      entryId: invention.entry.entryId,
      title: "Golden toy claim chart",
      elements: [
        {
          text: "A local workflow with linked evidence records.",
          supportRefs: [{ kind: "simulation", ref: simulation.entry.simulationId }],
          priorArtRefs: ["source:docs/source-notes.md#chunk_1"],
          notes: ["Human legal review required."]
        }
      ],
      reductionToPracticeRefs: [`simulation:${simulation.entry.simulationId}`],
      now: "2026-06-10T00:50:00.000Z"
    });
    const auditInput = {
      rootPath: root,
      title: "Golden toy validation",
      claim: "The golden toy workflow has local computational evidence only.",
      evidenceRefs: [{ kind: "simulation" as const, ref: simulation.entry.simulationId }],
      now: "2026-06-10T00:55:00.000Z"
    };
    const audit = await writeEvidenceAudit(auditInput);
    const validationPlan = await writeValidationPlan({
      ...auditInput,
      domains: ["simulation"],
      objective: "Define gates before making any stronger discovery claim."
    });
    const session = await writeResearchSession({
      rootPath: root,
      title: "Golden validation session",
      objective: "Validate generated workspace artifacts against schemas and local refs.",
      domains: ["math", "code"],
      evidenceRefs: [
        { kind: "simulation", ref: simulation.entry.simulationId },
        { kind: "validation", ref: validationPlan.plan.planId },
        { kind: "model-context", ref: modelContext.packet.packetId }
      ],
      tasks: ["Validate generated artifacts."],
      now: "2026-06-10T01:00:00.000Z"
    });
    const previousVaultKey = process.env.TRUTH_HARNESS_TEST_VAULT_KEY;
    process.env.TRUTH_HARNESS_TEST_VAULT_KEY = "local-test-secret-123";
    try {
      await sealVaultFile({
        rootPath: root,
        sourcePath: "private-note.txt",
        label: "Golden private note",
        keyEnv: "TRUTH_HARNESS_TEST_VAULT_KEY",
        now: "2026-06-10T01:05:00.000Z"
      });
    } finally {
      if (previousVaultKey === undefined) {
        delete process.env.TRUTH_HARNESS_TEST_VAULT_KEY;
      } else {
        process.env.TRUTH_HARNESS_TEST_VAULT_KEY = previousVaultKey;
      }
    }
    const snapshot = await writeWorkspaceSnapshot({
      rootPath: root,
      now: "2026-06-10T01:10:00.000Z"
    });

    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(audit.audit.auditId).toBe(validationPlan.plan.audit.auditId);
    expect(cas.record.trust).toBe("cross-checked");
    expect(validation.passed).toBe(true);
    expect(validation.summary.errors).toBe(0);
    expect(validation.summary.byKind.manifest).toBe(1);
    expect(validation.summary.byKind.indexes).toBe(1);
    expect(validation.summary.byKind.routes).toBe(1);
    expect(validation.summary.byKind.simulations).toBe(1);
    expect(validation.summary.byKind.experiments).toBe(1);
    expect(validation.summary.byKind.literature).toBe(1);
    expect(validation.summary.byKind["notebook-runs"]).toBe(1);
    expect(validation.summary.byKind["code-runs"]).toBe(1);
    expect(validation.summary.byKind.benchmarks).toBe(2);
    expect(validation.summary.byKind.cas).toBe(1);
    expect(validation.summary.byKind.smt).toBe(1);
    expect(validation.summary.byKind.reviews).toBe(1);
    expect(validation.summary.byKind.disclosures).toBe(1);
    expect(validation.summary.byKind["model-contexts"]).toBe(1);
    expect(validation.summary.byKind.inventions).toBe(1);
    expect(validation.summary.byKind.patents).toBe(1);
    expect(validation.summary.byKind.audits).toBe(1);
    expect(validation.summary.byKind.validation).toBe(1);
    expect(validation.summary.byKind.sessions).toBe(1);
    expect(validation.summary.byKind.vault).toBe(1);
    expect(validation.summary.byKind.snapshots).toBe(1);
    expect(validation.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ artifactId: claimChart.chart.chartId, valid: true }),
        expect.objectContaining({ artifactId: benchmark.record.benchmarkRunId, valid: true }),
        expect.objectContaining({ artifactId: benchmarkComparison.record.comparisonId, valid: true }),
        expect.objectContaining({ artifactId: route.route.routeId, valid: true }),
        expect.objectContaining({ artifactId: smt.record.checkId, valid: true }),
        expect.objectContaining({ artifactId: session.session.sessionId, valid: true }),
        expect.objectContaining({ artifactId: snapshot.snapshot.snapshotId, valid: true })
      ])
    );
  });

  it("fails non-receipt workspace records that violate their JSON Schema contract", async () => {
    const root = await tempRoot();
    const workspace = await initLocalWorkspace(root);
    await writeWorkspaceJson(root, "simulations", "bad-simulation.json", {
      schemaVersion: "truth-harness.simulation.v0",
      simulationId: "sim_1234567890abcdef",
      projectId: workspace.manifest.projectId,
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "not-a-date",
      kind: "telepathy",
      stage: "computed",
      validationBoundary: {
        simulationIsNotReality: false
      }
    });

    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(validation.passed).toBe(false);
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "invalid-artifact-schema",
        path: ".truth-harness/simulations/bad-simulation.json",
        message: expect.stringContaining("$.title is required")
      })
    );
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "invalid-artifact-schema",
        path: ".truth-harness/simulations/bad-simulation.json",
        message: expect.stringContaining("$.updatedAt must be a valid date-time string")
      })
    );
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "invalid-artifact-schema",
        path: ".truth-harness/simulations/bad-simulation.json",
        message: expect.stringContaining("$.validationBoundary.simulationIsNotReality must equal true")
      })
    );
    expect(validation.artifacts.find((artifact) => artifact.artifactId === "sim_1234567890abcdef")).toMatchObject({
      kind: "simulations",
      valid: false,
      artifactId: "sim_1234567890abcdef",
      issueCodes: expect.arrayContaining(["invalid-artifact-schema"])
    });
  });

  it("fails workspace records with dangling local evidence refs", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const simulation = await createSimulationLogEntry({
      rootPath: root,
      title: "Resolvable simulation",
      question: "Can a valid simulation id be resolved?",
      kind: "physics",
      engine: "local test runner",
      modelName: "toy-model",
      metrics: [{ name: "score", value: "1" }],
      assumptions: ["Unit-test-only assumptions."],
      uncertainty: ["No calibrated uncertainty model."],
      limitations: ["No real-world validation."],
      nextChecks: ["Independent reproduction."]
    });
    const invention = await createInventionLogEntry({
      rootPath: root,
      hypothesis: "A workspace validator should catch missing local evidence references.",
      evidenceRefs: [
        { kind: "simulation", ref: simulation.entry.simulationId },
        { kind: "review", ref: "review_missing123456" },
        { kind: "source", ref: "notes.md#chunk_1" }
      ]
    });

    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(validation.passed).toBe(false);
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "unresolved-evidence-ref",
        path: expect.stringContaining(invention.entry.entryId)
      })
    );
    expect(validation.issues.find((issue) => issue.code === "unresolved-evidence-ref")?.message).toContain(
      "review:review_missing123456"
    );
    expect(validation.issues.some((issue) => issue.message.includes("source:notes.md#chunk_1"))).toBe(false);
    expect(validation.artifacts.find((artifact) => artifact.artifactId === invention.entry.entryId)?.valid).toBe(false);
  });

  it("allows external model preflight packets before context is sent", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    await writeModelContext({
      rootPath: root,
      purpose: "Ask a hosted model to critique one selected proof sketch before any context is sent.",
      service: "OpenAI",
      model: "frontier-reasoning-model",
      dataClasses: ["selected proof sketch"],
      selectedContextRefs: ["source:proof-sketch.md#main"],
      sections: [
        {
          title: "Selected proof sketch",
          content: "Only local preflight metadata is being prepared in this test.",
          sourceRefs: ["source:proof-sketch.md#main"]
        }
      ],
      redactions: ["No secrets or personal data included."],
      now: "2026-06-10T02:00:00.000Z"
    });

    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(validation.passed).toBe(true);
    expect(validation.summary.checkedFiles).toBe(2);
    expect(validation.artifacts).toContainEqual(
      expect.objectContaining({
        kind: "model-contexts",
        valid: true,
        schemaVersion: "truth-harness.model-context.v0"
      })
    );
  });

  it("fails sent external model packets without approval and disclosure linkage", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const context = await writeModelContext({
      rootPath: root,
      purpose: "Send selected context to a hosted model without recording the required authorization.",
      service: "OpenAI",
      model: "frontier-reasoning-model",
      dataClasses: ["selected proof sketch"],
      selectedContextRefs: ["source:proof-sketch.md#main"],
      sections: [
        {
          title: "Selected proof sketch",
          content: "This packet is marked sent but lacks approval and disclosure references.",
          sourceRefs: ["source:proof-sketch.md#main"]
        }
      ],
      disclosureStatus: "sent",
      redactions: ["No secrets or personal data included."],
      now: "2026-06-10T03:00:00.000Z"
    });

    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(validation.passed).toBe(false);
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "external-model-context-sent-without-approval",
        path: expect.stringContaining(context.packet.packetId)
      })
    );
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "external-model-context-sent-without-disclosure",
        path: expect.stringContaining(context.packet.packetId)
      })
    );
    expect(validation.artifacts.find((artifact) => artifact.artifactId === context.packet.packetId)?.valid).toBe(false);
  });

  it("fails sent disclosure logs without human approval and selected context", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const disclosure = await createExternalDisclosureLogEntry({
      rootPath: root,
      service: "External Lab API",
      purpose: "Send selected research context to an external service.",
      dataClasses: ["patient health notes"],
      contextSummary: "This intentionally omits selected context refs and human approval for validation.",
      userInitiated: false,
      status: "sent",
      now: "2026-06-10T04:00:00.000Z"
    });

    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(validation.passed).toBe(false);
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "sent-disclosure-without-approval",
        path: expect.stringContaining(disclosure.entry.disclosureId)
      })
    );
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "sent-disclosure-not-user-initiated",
        path: expect.stringContaining(disclosure.entry.disclosureId)
      })
    );
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "sent-disclosure-without-selected-context",
        path: expect.stringContaining(disclosure.entry.disclosureId)
      })
    );
    expect(validation.artifacts.find((artifact) => artifact.artifactId === disclosure.entry.disclosureId)?.valid).toBe(false);
  });

  it("passes sent external model packets linked to approved disclosure logs", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root);
    const disclosure = await createExternalDisclosureLogEntry({
      rootPath: root,
      service: "OpenAI",
      model: "frontier-reasoning-model",
      purpose: "Ask a hosted model to critique a selected proof sketch.",
      dataClasses: ["selected proof sketch"],
      contextSummary: "Only the selected proof sketch section is sent.",
      selectedContextRefs: ["source:proof-sketch.md#main"],
      userInitiated: true,
      approvalRef: "prompt:explicit-user-request",
      status: "sent",
      now: "2026-06-10T05:00:00.000Z"
    });
    const context = await writeModelContext({
      rootPath: root,
      purpose: "Ask a hosted model to critique a selected proof sketch.",
      service: "OpenAI",
      model: "frontier-reasoning-model",
      dataClasses: ["selected proof sketch"],
      selectedContextRefs: ["source:proof-sketch.md#main"],
      sections: [
        {
          title: "Selected proof sketch",
          content: "Only this proof sketch is approved for external critique.",
          sourceRefs: ["source:proof-sketch.md#main"]
        }
      ],
      approvalRef: "prompt:explicit-user-request",
      disclosureRef: disclosure.entry.disclosureId,
      disclosureStatus: "sent",
      redactions: ["No secrets or personal data included."],
      now: "2026-06-10T05:01:00.000Z"
    });

    const validation = await validateWorkspaceArtifacts({ rootPath: root });

    expect(validation.passed).toBe(true);
    expect(validation.summary.checkedFiles).toBe(3);
    expect(validation.artifacts.find((artifact) => artifact.artifactId === disclosure.entry.disclosureId)?.valid).toBe(true);
    expect(validation.artifacts.find((artifact) => artifact.artifactId === context.packet.packetId)?.valid).toBe(true);
  });
});

async function writeReceipt(root: string, name: string, value: unknown): Promise<void> {
  await writeWorkspaceJson(root, "receipts", name, value);
}

async function writeWorkspaceJson(root: string, directory: string, name: string, value: unknown): Promise<void> {
  const targetDir = join(root, ".truth-harness", directory);
  await mkdir(targetDir, { recursive: true });
  await writeFile(join(targetDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-validation-"));
  roots.push(root);
  return root;
}
