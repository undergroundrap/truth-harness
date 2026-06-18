import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createReceipt } from "./receipt.js";
import { writeClaimChart } from "./claim-chart.js";
import { createExternalDisclosureLogEntry } from "./disclosure-log.js";
import { listWorkspaceEvents } from "./event-log.js";
import { createExperimentLogEntry } from "./experiment-log.js";
import { writeEvidenceAuditReport } from "./evidence-audit.js";
import { writeExpertReview } from "./expert-review.js";
import { createInventionLogEntry } from "./invention-log.js";
import { initLocalWorkspace } from "./local-workspace.js";
import { writeModelContext } from "./model-context.js";
import {
  addResearchSessionCheckpoint,
  updateResearchSessionTask,
  writeResearchSession
} from "./research-session.js";
import { createSimulationLogEntry } from "./simulation-log.js";
import {
  markWorkspaceCatalogStale,
  rebuildWorkspaceCatalog,
  refreshWorkspaceCatalogArtifact,
  getWorkspaceCatalogStatus,
  searchWorkspaceCatalog,
  upsertWorkspaceCatalogArtifact
} from "./workspace-catalog.js";
import { sealVaultFile } from "./vault.js";
import { writeValidationPlan } from "./validation-plan.js";
import { writeSymbolicCasCheckRecord, type CasBackendCommandRunner } from "./cas-backend.js";
import { writeClaimLedgerRecord } from "./claim-ledger.js";
import { writeLeanProofCheckRecord, type ProofBackendCommandRunner } from "./proof-backend.js";
import { writeSmtCheckRecord, type SmtBackendCommandRunner } from "./smt-backend.js";
import { writeVerifierRoute } from "./verifier-route.js";
import { writeVisualArtifact } from "./visual-artifact.js";
import { writeWorkspaceReview } from "./workspace-review.js";
import { writeWorkspaceSnapshot } from "./workspace-snapshot.js";

const roots: string[] = [];
const originalVaultKey = process.env.TRUTH_HARNESS_CATALOG_TEST_KEY;

afterEach(async () => {
  if (originalVaultKey === undefined) {
    delete process.env.TRUTH_HARNESS_CATALOG_TEST_KEY;
  } else {
    process.env.TRUTH_HARNESS_CATALOG_TEST_KEY = originalVaultKey;
  }
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("workspace catalog", () => {
  it("rebuilds a local SQLite index from canonical JSON and searches claims and routes", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Catalog Lab", now: "2026-06-14T00:00:00.000Z" });
    await writeReceipt(root, "fraction.json", createReceipt("compute 3 / 4 + 5 / 8"));
    const claim = await writeClaimLedgerRecord({
      rootPath: root,
      title: "Reusable fraction sum",
      statement: "3 / 4 + 5 / 8 equals 11 / 8.",
      domain: "math",
      tags: ["fractions", "exact-arithmetic"],
      evidenceRefs: [{ kind: "receipt", ref: ".truth-harness/receipts/fraction.json" }],
      now: "2026-06-14T00:00:02.000Z"
    });
    const route = await writeVerifierRoute({
      rootPath: root,
      problem: "compute 3 / 4 + 5 / 8",
      timeoutMs: 50,
      maximaCommand: "truth-harness-missing-maxima-command",
      leanCommand: "truth-harness-missing-lean-command",
      z3Command: "truth-harness-missing-z3-command",
      now: new Date("2026-06-14T00:00:03.000Z")
    });

    const rebuild = await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:04.000Z" });
    const status = await getWorkspaceCatalogStatus(root);
    const claimSearch = await searchWorkspaceCatalog({
      rootPath: root,
      query: "fractions",
      kind: "claims",
      trust: "exact-computed",
      tag: "fractions"
    });
    const routeSearch = await searchWorkspaceCatalog({
      rootPath: root,
      kind: "routes",
      limit: 5
    });

    expect(rebuild.schemaVersion).toBe("truth-harness.catalog-rebuild.v0");
    expect(rebuild.validation.passed).toBe(true);
    expect(rebuild.artifactCount).toBeGreaterThanOrEqual(4);
    expect(rebuild.claimCount).toBe(1);
    expect(rebuild.routeCount).toBe(1);
    expect(status).toMatchObject({
      exists: true,
      readable: true,
      stale: false,
      artifactCount: rebuild.artifactCount,
      claimCount: 1,
      routeCount: 1
    });
    const checkedStatus = await getWorkspaceCatalogStatus(root, { checkFiles: true });
    expect(checkedStatus).toMatchObject({
      exists: true,
      readable: true,
      stale: false,
      freshness: {
        checked: true,
        stale: false,
        indexedArtifacts: rebuild.artifactCount,
        workspaceArtifacts: rebuild.artifactCount,
        changedArtifacts: 0,
        missingArtifacts: 0,
        newArtifacts: 0
      }
    });
    expect(claimSearch.results).toContainEqual(
      expect.objectContaining({
        path: normalizePath(claim.jsonPath, root),
        kind: "claims",
        artifactId: claim.claim.claimId,
        trust: "exact-computed",
        domain: "math",
        tags: expect.arrayContaining(["#fractions"])
      })
    );
    expect(routeSearch.results).toContainEqual(
      expect.objectContaining({
        path: normalizePath(route.jsonPath, root),
        kind: "routes",
        artifactId: route.route.routeId,
        trust: "exact-computed"
      })
    );
    expect(claimSearch.warnings.join("\n")).toContain("do not upgrade trust labels");
  });

  it("reports missing and corrupt catalogs as rebuildable cache failures", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const missing = await getWorkspaceCatalogStatus(root);

    expect(missing.exists).toBe(false);
    expect(missing.readable).toBe(false);
    expect(missing.stale).toBe(true);

    await mkdir(join(root, ".truth-harness", "indexes"), { recursive: true });
    await writeFile(join(root, ".truth-harness", "indexes", "catalog.db"), "not a sqlite database", "utf8");
    const corrupt = await getWorkspaceCatalogStatus(root);

    expect(corrupt.exists).toBe(true);
    expect(corrupt.readable).toBe(false);
    expect(corrupt.stale).toBe(true);
    expect(corrupt.warnings.join("\n")).toContain("Rebuild required");
  });

  it("keeps readable catalogs current when Truth Harness writers add JSON after rebuild", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    await writeReceipt(root, "fraction.json", createReceipt("compute 3 / 4 + 5 / 8"));
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:01.000Z" });

    const fastStatus = await getWorkspaceCatalogStatus(root);
    const freshStatus = await getWorkspaceCatalogStatus(root, { checkFiles: true });
    const claim = await writeClaimLedgerRecord({
      rootPath: root,
      statement: "A new claim should be indexed incrementally.",
      domain: "math",
      tags: ["freshness"],
      now: "2026-06-14T00:00:02.000Z"
    });

    const updatedStatus = await getWorkspaceCatalogStatus(root);
    const checkedStatus = await getWorkspaceCatalogStatus(root, { checkFiles: true });
    const searchAfterWrite = await searchWorkspaceCatalog({ rootPath: root, query: "freshness" });
    const eventsAfterWrite = await listWorkspaceEvents(root);

    expect(fastStatus.freshness.checked).toBe(false);
    expect(freshStatus.stale).toBe(false);
    expect(updatedStatus).toMatchObject({
      readable: true,
      stale: false,
      invalidatedAt: undefined,
      artifactCount: fastStatus.artifactCount + 1,
      claimCount: fastStatus.claimCount + 1
    });
    expect(checkedStatus.freshness).toMatchObject({
      checked: true,
      stale: false,
      changedArtifacts: 0,
      missingArtifacts: 0,
      newArtifacts: 0
    });
    expect(searchAfterWrite.results).toContainEqual(
      expect.objectContaining({
        path: normalizePath(claim.jsonPath, root),
        kind: "claims",
        artifactId: claim.claim.claimId
      })
    );
    expect(eventsAfterWrite.events).toContainEqual(
      expect.objectContaining({
        action: "artifact-written",
        path: normalizePath(claim.jsonPath, root),
        kind: "claims",
        artifactId: claim.claim.claimId,
        artifact: expect.objectContaining({
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          byteLength: expect.any(Number)
        })
      })
    );
  });

  it("detects out-of-band JSON changes with an explicit freshness check", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    await writeReceipt(root, "fraction.json", createReceipt("compute 3 / 4 + 5 / 8"));
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:01.000Z" });

    await writeReceipt(root, "out-of-band.json", createReceipt("compute 2 + 2"));
    const fastStatus = await getWorkspaceCatalogStatus(root);
    const staleStatus = await getWorkspaceCatalogStatus(root, { checkFiles: true });

    expect(fastStatus.stale).toBe(false);
    expect(staleStatus.readable).toBe(true);
    expect(staleStatus.stale).toBe(true);
    expect(staleStatus.freshness).toMatchObject({
      checked: true,
      changedArtifacts: 0,
      missingArtifacts: 0,
      newArtifacts: 1
    });
    expect(staleStatus.freshness.examples.join("\n")).toContain("new:.truth-harness/receipts/out-of-band.json");
  });

  it("ignores exported credibility-bundle payload copies during freshness checks", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    await writeReceipt(root, "fraction.json", createReceipt("compute 3 / 4 + 5 / 8"));
    const rebuild = await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:01.000Z" });

    const bundledReceiptDir = join(
      root,
      ".truth-harness",
      "findings",
      "2026-06-14-cbun_test-credibility-bundle",
      "artifacts",
      ".truth-harness",
      "receipts"
    );
    await mkdir(bundledReceiptDir, { recursive: true });
    await writeFile(join(bundledReceiptDir, "copied-receipt.json"), `${JSON.stringify(createReceipt("compute 2 + 2"), null, 2)}\n`, "utf8");

    const status = await getWorkspaceCatalogStatus(root, { checkFiles: true });

    expect(status).toMatchObject({
      readable: true,
      stale: false,
      artifactCount: rebuild.artifactCount,
      freshness: {
        checked: true,
        stale: false,
        workspaceArtifacts: rebuild.artifactCount,
        changedArtifacts: 0,
        missingArtifacts: 0,
        newArtifacts: 0
      }
    });
  });

  it("can incrementally upsert a single canonical artifact without a full rebuild", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    await writeReceipt(root, "fraction.json", createReceipt("compute 3 / 4 + 5 / 8"));
    const rebuild = await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:01.000Z" });
    await writeReceipt(root, "incremental.json", createReceipt("compute 2 + 2"));
    await markWorkspaceCatalogStale({
      rootPath: root,
      reason: "receipt artifact written",
      path: ".truth-harness/receipts/incremental.json",
      kind: "receipts",
      now: "2026-06-14T00:00:02.000Z"
    });

    const upsert = await upsertWorkspaceCatalogArtifact({
      rootPath: root,
      path: ".truth-harness/receipts/incremental.json",
      kind: "receipts",
      now: "2026-06-14T00:00:03.000Z"
    });
    const status = await getWorkspaceCatalogStatus(root, { checkFiles: true });
    const search = await searchWorkspaceCatalog({ rootPath: root, query: "2" });

    expect(upsert).toMatchObject({
      schemaVersion: "truth-harness.catalog-upsert.v0",
      exists: true,
      updated: true,
      stale: false,
      path: ".truth-harness/receipts/incremental.json",
      kind: "receipts"
    });
    expect(status).toMatchObject({
      stale: false,
      artifactCount: rebuild.artifactCount + 1
    });
    expect(search.results).toContainEqual(
      expect.objectContaining({
        path: ".truth-harness/receipts/incremental.json",
        kind: "receipts",
        trust: "exact-computed"
      })
    );
  });

  it("keeps readable catalogs current when verifier artifact writers add JSON after rebuild", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Verifier Catalog Lab", now: "2026-06-14T00:00:00.000Z" });
    await writeFile(join(root, "trivial.lean"), "example : True := by trivial\n", "utf8");
    await writeFile(
      join(root, "constraints.smt2"),
      "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n(get-model)\n",
      "utf8"
    );
    const rebuild = await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:01.000Z" });
    const casRunner: CasBackendCommandRunner = (_command, args) =>
      args[0] === "--version"
        ? { status: 0, stdout: "Maxima 5.47.0\n", stderr: "" }
        : { status: 0, stdout: "TRUTH_HARNESS_MAXIMA_STATUS:passed:0\n", stderr: "" };
    const smtRunner: SmtBackendCommandRunner = (_command, args) =>
      args[0] === "-version"
        ? { status: 0, stdout: "Z3 version 4.13.0\n", stderr: "" }
        : { status: 0, stdout: "sat\n(\n  (define-fun x () Int\n    1)\n)\n", stderr: "" };
    const proofRunner: ProofBackendCommandRunner = (_command, args) =>
      args[0] === "--version" ? { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" } : { status: 0, stdout: "", stderr: "" };

    const visual = await writeVisualArtifact({
      rootPath: root,
      title: "Catalog visual probe",
      kind: "lineage-graph",
      renderer: { engine: "mermaid" },
      payload: {
        format: "graph-json",
        rendererSource: {
          language: "mermaid",
          content: "graph LR\n  claim --> proof\n"
        },
        content: {
          nodes: [{ id: "claim" }, { id: "proof" }],
          edges: [{ source: "claim", target: "proof" }]
        }
      },
      now: "2026-06-14T00:00:02.000Z"
    });
    const cas = await writeSymbolicCasCheckRecord({
      rootPath: root,
      prompt: {
        operation: "simplify",
        expression: "sin(x)^2 + cos(x)^2",
        variable: "x"
      },
      result: "1",
      runner: casRunner,
      now: new Date("2026-06-14T00:00:03.000Z")
    });
    const smt = await writeSmtCheckRecord({
      rootPath: root,
      sourcePath: "constraints.smt2",
      queryName: "positive_integer_model",
      runner: smtRunner,
      now: new Date("2026-06-14T00:00:04.000Z")
    });
    const proof = await writeLeanProofCheckRecord({
      rootPath: root,
      sourcePath: "trivial.lean",
      declarationName: "trivial_true",
      runner: proofRunner,
      now: new Date("2026-06-14T00:00:05.000Z")
    });
    const review = await writeWorkspaceReview({
      rootPath: root,
      now: "2026-06-14T00:00:06.000Z"
    });

    const status = await getWorkspaceCatalogStatus(root, { checkFiles: true });
    const visualSearch = await searchWorkspaceCatalog({ rootPath: root, kind: "visuals" });
    const casSearch = await searchWorkspaceCatalog({ rootPath: root, kind: "cas" });
    const smtSearch = await searchWorkspaceCatalog({ rootPath: root, kind: "smt" });
    const proofSearch = await searchWorkspaceCatalog({ rootPath: root, kind: "proofs" });
    const reviewSearch = await searchWorkspaceCatalog({ rootPath: root, kind: "findings" });

    expect(status).toMatchObject({
      readable: true,
      stale: false,
      artifactCount: rebuild.artifactCount + 5,
      freshness: {
        checked: true,
        stale: false,
        changedArtifacts: 0,
        missingArtifacts: 0,
        newArtifacts: 0
      }
    });
    expect(visualSearch.results).toContainEqual(
      expect.objectContaining({
        path: normalizePath(visual.jsonPath, root),
        kind: "visuals",
        artifactId: visual.visual.visualId
      })
    );
    expect(casSearch.results).toContainEqual(
      expect.objectContaining({
        path: normalizePath(cas.jsonPath, root),
        kind: "cas",
        artifactId: cas.record.checkId,
        trust: "cross-checked"
      })
    );
    expect(smtSearch.results).toContainEqual(
      expect.objectContaining({
        path: normalizePath(smt.jsonPath, root),
        kind: "smt",
        artifactId: smt.record.checkId,
        trust: "smt-checked"
      })
    );
    expect(proofSearch.results).toContainEqual(
      expect.objectContaining({
        path: normalizePath(proof.jsonPath, root),
        kind: "proofs",
        artifactId: proof.record.checkId,
        trust: "proved"
      })
    );
    expect(reviewSearch.results).toContainEqual(
      expect.objectContaining({
        path: normalizePath(review.jsonPath, root),
        kind: "findings",
        artifactId: review.review.reviewId
      })
    );
  });

  it("keeps readable catalogs current when research artifact writers add JSON after rebuild", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { displayName: "Research Catalog Lab", now: "2026-06-14T00:00:00.000Z" });
    const rebuild = await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:01.000Z" });

    const disclosure = await createExternalDisclosureLogEntry({
      rootPath: root,
      service: "local-model",
      purpose: "Document local model context handling.",
      dataClasses: ["notes"],
      contextSummary: "Only synthetic test data.",
      now: "2026-06-14T00:00:02.000Z"
    });
    const invention = await createInventionLogEntry({
      rootPath: root,
      title: "Catalog refresh invariant",
      problem: "Agent loops need fresh local indexes.",
      hypothesis: "Durable research writers can keep the catalog searchable without a full rebuild.",
      now: "2026-06-14T00:00:03.000Z"
    });
    const chart = await writeClaimChart({
      rootPath: root,
      entryId: invention.entry.entryId,
      elements: [
        {
          text: "Catalog refresh helper is invoked by research artifact writers.",
          supportRefs: [{ kind: "other", ref: "unit-test" }]
        }
      ],
      now: "2026-06-14T00:00:04.000Z"
    });
    const simulation = await createSimulationLogEntry({
      rootPath: root,
      question: "Does catalog refresh stay current after simulation logs?",
      engine: "unit-test",
      modelName: "catalog-model",
      now: "2026-06-14T00:00:05.000Z"
    });
    const experiment = await createExperimentLogEntry({
      rootPath: root,
      question: "Does writer coverage stay searchable?",
      observations: ["No stale catalog after write."],
      now: "2026-06-14T00:00:06.000Z"
    });
    const audit = await writeEvidenceAuditReport({
      rootPath: root,
      claim: "Catalog writer coverage is searchable after writes.",
      now: "2026-06-14T00:00:07.000Z"
    });
    const expert = await writeExpertReview({
      rootPath: root,
      subject: "Catalog writer coverage",
      reviewerRole: "unit-test reviewer",
      now: "2026-06-14T00:00:08.000Z"
    });
    const modelContext = await writeModelContext({
      rootPath: root,
      purpose: "Prepare a bounded local packet.",
      service: "local-model",
      target: "local-model",
      selectedContextRefs: ["receipt:test"],
      sections: [{ title: "Scope", content: "Synthetic local test context.", sourceRefs: ["receipt:test"] }],
      now: "2026-06-14T00:00:09.000Z"
    });
    const validation = await writeValidationPlan({
      rootPath: root,
      claim: "Catalog writer coverage should not go stale.",
      now: "2026-06-14T00:00:10.000Z"
    });
    const session = await writeResearchSession({
      rootPath: root,
      objective: "Track catalog freshness work.",
      domains: ["code"],
      tasks: ["Attach evidence"],
      now: "2026-06-14T00:00:11.000Z"
    });
    await addResearchSessionCheckpoint({
      rootPath: root,
      sessionRef: session.session.sessionId,
      summary: "Writers attached.",
      now: "2026-06-14T00:00:12.000Z"
    });
    const updatedSession = await updateResearchSessionTask({
      rootPath: root,
      sessionRef: session.session.sessionId,
      taskRef: "Attach evidence",
      status: "blocked",
      nextChecks: ["Attach evidence ref before done."],
      now: "2026-06-14T00:00:13.000Z"
    });
    await writeFile(join(root, "private-source.json"), "{\"secret\":\"catalog-test\"}\n", "utf8");
    process.env.TRUTH_HARNESS_CATALOG_TEST_KEY = "catalog-test-passphrase";
    const vault = await sealVaultFile({
      rootPath: root,
      sourcePath: "private-source.json",
      label: "Catalog test sealed note",
      keyEnv: "TRUTH_HARNESS_CATALOG_TEST_KEY",
      now: "2026-06-14T00:00:14.000Z"
    });
    const snapshot = await writeWorkspaceSnapshot({
      rootPath: root,
      now: "2026-06-14T00:00:15.000Z"
    });

    const status = await getWorkspaceCatalogStatus(root, { checkFiles: true });

    expect(status).toMatchObject({
      readable: true,
      stale: false,
      artifactCount: rebuild.artifactCount + 12,
      freshness: {
        checked: true,
        stale: false,
        changedArtifacts: 0,
        missingArtifacts: 0,
        newArtifacts: 0
      }
    });
    await expectCatalogHit(root, "disclosures", disclosure.path, disclosure.entry.disclosureId);
    await expectCatalogHit(root, "inventions", invention.path, invention.entry.entryId);
    await expectCatalogHit(root, "patents", chart.jsonPath, chart.chart.chartId);
    await expectCatalogHit(root, "simulations", simulation.path, simulation.entry.simulationId);
    await expectCatalogHit(root, "experiments", experiment.path, experiment.entry.experimentId);
    await expectCatalogHit(root, "audits", audit.jsonPath, audit.audit.auditId);
    await expectCatalogHit(root, "reviews", expert.jsonPath, expert.review.reviewId);
    await expectCatalogHit(root, "model-contexts", modelContext.jsonPath, modelContext.packet.packetId);
    await expectCatalogHit(root, "validation", validation.jsonPath, validation.plan.planId);
    await expectCatalogHit(root, "sessions", updatedSession.jsonPath, updatedSession.session.sessionId);
    await expectCatalogHit(root, "vault", vault.path, vault.entry.vaultId);
    await expectCatalogHit(root, "snapshots", snapshot.path, snapshot.snapshot.snapshotId);
  });

  it("marks an existing catalog stale without creating a canonical artifact", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    await writeReceipt(root, "fraction.json", createReceipt("compute 3 / 4 + 5 / 8"));
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:01.000Z" });

    const mark = await markWorkspaceCatalogStale({
      rootPath: root,
      reason: "external agent wrote a receipt",
      path: ".truth-harness/receipts/fraction.json",
      kind: "receipts",
      now: "2026-06-14T00:00:02.000Z"
    });
    const status = await getWorkspaceCatalogStatus(root);

    expect(mark).toMatchObject({
      schemaVersion: "truth-harness.catalog-stale.v0",
      exists: true,
      marked: true,
      staleAt: "2026-06-14T00:00:02.000Z"
    });
    expect(status).toMatchObject({
      readable: true,
      stale: true,
      invalidatedAt: "2026-06-14T00:00:02.000Z",
      invalidation: {
        reason: "external agent wrote a receipt",
        path: ".truth-harness/receipts/fraction.json",
        kind: "receipts"
      }
    });
    await expect(searchWorkspaceCatalog({ rootPath: root, query: "fraction" })).rejects.toThrow("stale");
  });

  it("serializes concurrent catalog refreshes from multiple artifact writers", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:01.000Z" });

    await Promise.all(
      Array.from({ length: 8 }, async (_, index) => {
        const fileName = `concurrent-${index + 1}.json`;
        const receipt = createReceipt(`compute ${index + 1} / 2 + 1 / 2`);
        await writeReceipt(root, fileName, receipt);
        return refreshWorkspaceCatalogArtifact({
          rootPath: root,
          path: `.truth-harness/receipts/${fileName}`,
          kind: "receipts",
          now: `2026-06-14T00:00:${String(index + 2).padStart(2, "0")}.000Z`
        });
      })
    );

    const status = await getWorkspaceCatalogStatus(root, { checkFiles: true });
    const search = await searchWorkspaceCatalog({ rootPath: root, kind: "receipts", limit: 20 });

    expect(status.stale).toBe(false);
    expect(search.results.filter((result) => result.path.includes("concurrent-"))).toHaveLength(8);
  });

  it("does not index vault plaintext and escapes hostile-looking FTS queries", async () => {
    const root = await tempRoot();
    await initLocalWorkspace(root, { now: "2026-06-14T00:00:00.000Z" });
    const secretPath = join(root, "private-source.json");
    await writeFile(secretPath, "{\"private\":\"secret-molecule-candidate\"}\n", "utf8");
    process.env.TRUTH_HARNESS_CATALOG_TEST_KEY = "catalog-test-passphrase";
    await sealVaultFile({
      rootPath: root,
      sourcePath: "private-source.json",
      label: "Private sealed research note",
      keyEnv: "TRUTH_HARNESS_CATALOG_TEST_KEY",
      now: "2026-06-14T00:00:01.000Z"
    });
    await writeClaimLedgerRecord({
      rootPath: root,
      statement: "Catalog FTS escaping should not execute user syntax.",
      domain: "security",
      tags: ["fts-safety"],
      now: "2026-06-14T00:00:02.000Z"
    });

    await rebuildWorkspaceCatalog({ rootPath: root, now: "2026-06-14T00:00:03.000Z" });
    const secretSearch = await searchWorkspaceCatalog({ rootPath: root, query: "secret-molecule-candidate" });
    const escapedSearch = await searchWorkspaceCatalog({
      rootPath: root,
      query: "\"fts-safety\" claim:route (x/y)",
      tag: "#fts-safety"
    });

    expect(secretSearch.results).toHaveLength(0);
    expect(escapedSearch.results).toHaveLength(0);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "truth-harness-catalog-"));
  roots.push(root);
  return root;
}

async function writeReceipt(root: string, name: string, receipt: unknown): Promise<void> {
  const receiptsDir = join(root, ".truth-harness", "receipts");
  await mkdir(receiptsDir, { recursive: true });
  await writeFile(join(receiptsDir, name), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

function normalizePath(path: string, root: string): string {
  return path.slice(root.length + 1).replace(/\\/g, "/");
}

async function expectCatalogHit(root: string, kind: string, path: string, artifactId: string): Promise<void> {
  const search = await searchWorkspaceCatalog({ rootPath: root, kind, limit: 50 });
  expect(search.results).toContainEqual(
    expect.objectContaining({
      path: normalizePath(path, root),
      kind,
      artifactId
    })
  );
}
