import { createServer, request as httpRequest } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createReceipt,
  initLocalWorkspace,
  verifierRouteStatementBoundaryHash,
  writeCredibilityBundle,
  writeClaimLedgerRecord,
  writeResearchSession,
  type EngineVerificationCommandRunner
} from "../../../packages/core/src/index.js";

const repoRoot = resolve(".");
const tsxCli = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");
const webServerScript = resolve(repoRoot, "tools/serve-web.mjs");

let runningServer: ChildProcessWithoutNullStreams | undefined;
let tempProjectRoot: string | undefined;
const originalGraphvizDot = process.env.TRUTH_HARNESS_GRAPHVIZ_DOT;

afterEach(async () => {
  if (runningServer) {
    const server = runningServer;
    runningServer = undefined;
    server.kill();
    await new Promise<void>((resolveClose) => {
      server.once("close", () => resolveClose());
      setTimeout(resolveClose, 1_500);
    });
  }

  if (tempProjectRoot) {
    await rm(tempProjectRoot, { recursive: true, force: true });
    tempProjectRoot = undefined;
  }

  if (originalGraphvizDot === undefined) {
    delete process.env.TRUTH_HARNESS_GRAPHVIZ_DOT;
  } else {
    process.env.TRUTH_HARNESS_GRAPHVIZ_DOT = originalGraphvizDot;
  }
});

describe("local web route ledger API", () => {
  it("persists verifier routes and reads them through local-only API endpoints", async () => {
    tempProjectRoot = await mkdtemp(join(tmpdir(), "truth-harness-web-api-"));
    process.env.TRUTH_HARNESS_GRAPHVIZ_DOT = "truth-harness-missing-graphviz-dot";
    const port = await getFreePort();
    runningServer = await startWebServer(port, tempProjectRoot);
    const baseUrl = `http://127.0.0.1:${port}`;

    const statusResponse = await fetch(`${baseUrl}/api/status`);
    expect(statusResponse.status).toBe(200);
    const statusPayload = await statusResponse.json();
    expectLocalApiSuccess(statusResponse, statusPayload);
    expect(statusPayload.localOnly).toBe(true);
    expect(statusPayload.externalCalls).toBe(false);
    expect(statusPayload.capabilities).toContain("docker-verifier-guidance");
    expect(statusPayload.capabilities).toContain("web-runtime-identity");
    expect(statusPayload.capabilities).toContain("report-draft-save");
    expect(statusPayload.capabilities).toContain("research-session-list");
    expect(statusPayload.capabilities).toContain("research-harness-start");
    expect(statusPayload.capabilities).toContain("hard-math-seed");
    expect(statusPayload.capabilities).toContain("research-map");
    expect(statusPayload.capabilities).toContain("visual-artifacts");
    expect(statusPayload.capabilities).toContain("workspace-artifact-preview");
    expect(statusPayload.capabilities).toContain("catalog-search");
    expect(statusPayload.capabilities).toContain("workspace-events");
    expect(statusPayload.capabilities).toContain("workspace-run-next-dry-run");
    expect(statusPayload.capabilities).toContain("workspace-run-next-save");
    expect(statusPayload.capabilities).toContain("workspace-run-next-list");
    expect(statusPayload.capabilities).toContain("workspace-run-next-show");
    expect(statusPayload.capabilities).toContain("workspace-pilot-loop-dry-run");
    expect(statusPayload.capabilities).toContain("workspace-maintenance");
    expect(statusPayload.capabilities).toContain("engine-evidence-verification");
    expect(statusPayload.capabilities).toContain("engine-readiness-report");
    expect(statusPayload.capabilities).toContain("engine-evidence-runs");
    expect(statusPayload.capabilities).toContain("credibility-pack");
    expect(statusPayload.capabilities).toContain("credibility-bundle-latest");
    expect(statusPayload.capabilities).toContain("credibility-bundle-files");
    expect(statusPayload.capabilities).toContain("credibility-bundle-archive");
    expect(statusPayload.capabilities).toContain("credibility-bundle-archive-sha256");
    expect(statusPayload.capabilities).toContain("credibility-bundle-verify");
    expect(statusPayload.capabilities).toContain("credibility-bundle-verification-history");
    expect(statusPayload.capabilities).toContain("credibility-bundle-verification-files");
    expect(statusPayload.capabilities).toContain("release-audit");
    expect(statusPayload.safety.webServer).toMatchObject({
      localHostGuard: true,
      sameOriginWritesOnly: true,
      securityHeaders: true,
      maxJsonBodyBytes: 128 * 1024,
      apiErrorFormat: "json"
    });
    expect(statusPayload.runtime).toMatchObject({
      schemaVersion: "truth-harness.web-runtime.v0",
      runtimeKind: process.platform === "win32" ? "windows-host" : "local-host",
      projectRoot: tempProjectRoot?.replace(/\\/gu, "/"),
      localOnly: true
    });
    expect(statusPayload.runtime.staleHint).toContain("local host repository runtime");
    expect(statusPayload.dockerVerifier).toMatchObject({
      schemaVersion: "truth-harness.docker-verifier-guidance.v0",
      localOnly: true,
      externalCalls: false,
      commands: {
        professor: "npm run docker:professor",
        engines: "npm run docker:engines",
        proof: "npm run docker:proof",
        allEngines: "npm run docker:all-engines",
        professorAll: "npm run docker:professor:all",
        verify: "npm run docker:verify"
      },
      runtimeBoundary: {
        service: "truth-harness",
        composeNetworkMode: "none",
        autoRunsDocker: false,
        buildMayDownloadDependencies: true,
        repositoryBindMount: true
      }
    });
    expect(typeof statusPayload.dockerVerifier.recommended).toBe("boolean");
    expect(statusPayload.dockerVerifier.notes).toContain("The web UI never runs Docker automatically; it only exposes copyable commands.");
    expect(statusPayload.dockerVerifier.notes).toContain(
      "npm run docker:professor writes Maxima/Z3/cvc5/Lean engine evidence, adversarial benchmark evidence, math credibility ladder evidence, professor math challenge evidence, exact/symbolic/SMT hard-math closure evidence, a credibility pack, and a verified portable reviewer bundle inside the no-network compose service."
    );
    expect(statusPayload.dockerVerifier.notes).toContain(
      "npm run docker:all-engines is the heavy strict gate for Maxima, Z3, cvc5, Lean, and SageMath when a reviewer explicitly wants every adapter fixture."
    );
    expect(statusPayload.dockerVerifier.notes).toContain(
      "npm run docker:professor:all writes the strict all-engine professor packet, closure reports, and portable reviewer bundle from the no-network all-engine service."
    );
    expect(statusPayload.engineVerification).toMatchObject({
      schemaVersion: "truth-harness.engine-verification.v0",
      localOnly: true,
      networkAccess: "none",
      docker: {
        professorCommand: "npm run docker:professor",
        coreCommand: "npm run docker:engines",
        allEnginesCommand: "npm run docker:all-engines",
        verifyImageCommand: "npm run docker:verify",
        networkPolicy: "compose-core-no-network"
      },
      trustBoundary: {
        statusProbeIsNotEvidence: true,
        concreteChecksCanMintEvidence: true
      }
    });
    expect(Array.isArray(statusPayload.engineVerification.cases)).toBe(true);
    expect(statusPayload.engineReadiness).toMatchObject({
      schemaVersion: "truth-harness.engine-readiness.v0",
      localOnly: true,
      networkAccess: "none",
      trustBoundary: {
        readinessDoesNotMintEvidence: true,
        professorReadyRequiresConcreteEngineRuns: true
      }
    });
    expect(Array.isArray(statusPayload.engineReadiness.gates)).toBe(true);

    const reportMarkdown = "# Saved Report\n\nEvery result is replayable.\n";
    const reportSaveResponse = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Saved Report",
        summary: "Report draft generated by the web Report tab.",
        receiptRunId: "run_report_fixture",
        claimId: "claim_report_fixture",
        trust: "exact-computed",
        bundleVerificationIds: ["cver_aaaaaaaaaaaaaaaa", "not-a-cver"],
        markdown: reportMarkdown
      })
    });
    expect(reportSaveResponse.status).toBe(200);
    const reportSavePayload = await reportSaveResponse.json();
    expectLocalApiSuccess(reportSaveResponse, reportSavePayload);
    const reportMarkdownSha256 = createHash("sha256").update(reportMarkdown).digest("hex");
    expect(reportSavePayload).toMatchObject({
      schemaVersion: "truth-harness.web-report-draft-write-response.v0",
      localOnly: true,
      externalCalls: [],
      report: {
        schemaVersion: "truth-harness.report-draft.v0",
        reportId: expect.stringMatching(/^report_[a-f0-9]{16}$/u),
        localOnly: true,
        networkAccess: "none",
        source: "web-report-tab",
        title: "Saved Report",
        receiptRunId: "run_report_fixture",
        claimId: "claim_report_fixture",
        trust: "exact-computed",
        bundleVerificationIds: ["cver_aaaaaaaaaaaaaaaa"],
        markdownSha256: reportMarkdownSha256,
        markdownByteLength: Buffer.byteLength(reportMarkdown)
      },
      paths: {
        relativeJson: expect.stringContaining("report-draft.json"),
        relativeMarkdown: expect.stringContaining("report-draft.md")
      },
      activity: [
        expect.objectContaining({
          actor: "local-api",
          action: "saved-report-draft"
        })
      ]
    });
    expect(existsSync(reportSavePayload.paths.json)).toBe(true);
    expect(existsSync(reportSavePayload.paths.markdown)).toBe(true);
    const savedReportJson = JSON.parse(await readFile(reportSavePayload.paths.json, "utf8"));
    expect(savedReportJson.reportId).toBe(reportSavePayload.report.reportId);
    expect(savedReportJson.paths).toEqual(reportSavePayload.report.paths);
    const savedReportMarkdown = await readFile(reportSavePayload.paths.markdown, "utf8");
    expect(savedReportMarkdown).toBe(reportMarkdown);

    const reportListResponse = await fetch(`${baseUrl}/api/reports?limit=5`);
    expect(reportListResponse.status).toBe(200);
    const reportListPayload = await reportListResponse.json();
    expectLocalApiSuccess(reportListResponse, reportListPayload);
    expect(reportListPayload).toMatchObject({
      schemaVersion: "truth-harness.web-report-draft-list-response.v0",
      localOnly: true,
      externalCalls: [],
      count: expect.any(Number)
    });
    expect(reportListPayload.reports[0]).toMatchObject({
      report: {
        reportId: reportSavePayload.report.reportId,
        title: "Saved Report",
        receiptRunId: "run_report_fixture"
      },
      markdownVerified: true,
      markdownStatus: "verified",
      markdownSha256: reportMarkdownSha256,
      paths: {
        relativeJson: expect.stringContaining("report-draft.json"),
        relativeMarkdown: expect.stringContaining("report-draft.md")
      }
    });

    const reportReadResponse = await fetch(`${baseUrl}/api/reports/${reportSavePayload.report.reportId}`);
    expect(reportReadResponse.status).toBe(200);
    const reportReadPayload = await reportReadResponse.json();
    expectLocalApiSuccess(reportReadResponse, reportReadPayload);
    expect(reportReadPayload).toMatchObject({
      schemaVersion: "truth-harness.web-report-draft-read-response.v0",
      localOnly: true,
      externalCalls: [],
      report: {
        reportId: reportSavePayload.report.reportId,
        title: "Saved Report"
      },
      markdown: reportMarkdown,
      markdownVerified: true,
      markdownSha256: reportMarkdownSha256
    });

    const invalidReportReadResponse = await fetch(`${baseUrl}/api/reports/not-a-report`);
    expect(invalidReportReadResponse.status).toBe(400);

    const invalidReportSaveResponse = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ markdown: "" })
    });
    expect(invalidReportSaveResponse.status).toBe(400);
    const invalidReportSavePayload = await invalidReportSaveResponse.json();
    expect(invalidReportSavePayload).toMatchObject({
      schemaVersion: "truth-harness.web-error.v0",
      localOnly: true,
      externalCalls: [],
      status: 400,
      error: "Report markdown is required."
    });

    const engineRunsBeforeResponse = await fetch(`${baseUrl}/api/engine-runs`);
    expect(engineRunsBeforeResponse.status).toBe(200);
    const engineRunsBeforePayload = await engineRunsBeforeResponse.json();
    expectLocalApiSuccess(engineRunsBeforeResponse, engineRunsBeforePayload);
    expect(engineRunsBeforePayload.runs).toEqual([]);

    const engineRunWriteResponse = await fetch(`${baseUrl}/api/engine-runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ timeoutMs: 50 })
    });
    expect(engineRunWriteResponse.status).toBe(200);
    const engineRunWritePayload = await engineRunWriteResponse.json();
    expectLocalApiSuccess(engineRunWriteResponse, engineRunWritePayload);
    expect(engineRunWritePayload.run.schemaVersion).toBe("truth-harness.engine-run.v0");
    expect(engineRunWritePayload.run.localOnly).toBe(true);
    expect(engineRunWritePayload.run.networkAccess).toBe("none");
    expect(engineRunWritePayload.run.report.schemaVersion).toBe("truth-harness.engine-verification.v0");
    expect(engineRunWritePayload.paths.json).toContain(".truth-harness");
    expect(existsSync(engineRunWritePayload.paths.json)).toBe(true);
    expect(existsSync(engineRunWritePayload.paths.markdown)).toBe(true);
    expect(engineRunWritePayload.runs).toContainEqual(
      expect.objectContaining({
        runId: engineRunWritePayload.run.runId,
        status: engineRunWritePayload.run.status
      })
    );

    const strictEngineRunWriteResponse = await fetch(`${baseUrl}/api/engine-runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ timeoutMs: 50, requireAllEngines: true })
    });
    expect(strictEngineRunWriteResponse.status).toBe(200);
    const strictEngineRunWritePayload = await strictEngineRunWriteResponse.json();
    expectLocalApiSuccess(strictEngineRunWriteResponse, strictEngineRunWritePayload);
    expect(strictEngineRunWritePayload.mode).toBe("all-engines");
    expect(strictEngineRunWritePayload.run.replay).toContain("--require-all-engines");
    expect(strictEngineRunWritePayload.run.report.requiredTotal).toBe(5);
    expect(strictEngineRunWritePayload.runs).toContainEqual(
      expect.objectContaining({
        runId: strictEngineRunWritePayload.run.runId,
        requiredTotal: 5
      })
    );

    const credibilityResponse = await fetch(`${baseUrl}/api/credibility-pack?requireAllEngines=true&timeoutMs=50`);
    expect(credibilityResponse.status).toBe(200);
    const credibilityPayload = await credibilityResponse.json();
    expectLocalApiSuccess(credibilityResponse, credibilityPayload);
    expect(credibilityPayload).toMatchObject({
      schemaVersion: "truth-harness.web-credibility-pack-response.v0",
      localOnly: true,
      externalCalls: [],
      mode: "all-engines"
    });
    expect(credibilityPayload.pack).toMatchObject({
      schemaVersion: "truth-harness.credibility-pack.v0",
      localOnly: true,
      networkAccess: "none",
      title: "Truth Harness Professor Credibility Pack"
    });
    expect(credibilityPayload.pack.summary.requiredEngineGates).toMatch(/\/5$/u);
    expect(credibilityPayload.pack.reviewerActionPlan).toMatchObject({
      totalActions: expect.any(Number),
      criticalActions: expect.any(Number),
      highActions: expect.any(Number),
      actions: expect.any(Array)
    });
    expect(credibilityPayload.pack.reviewerActionPlan.actions).toContainEqual(
      expect.objectContaining({
        category: expect.stringMatching(/^(engine|workspace-review|validation)$/u),
        command: expect.stringContaining("truth-harness")
      })
    );
    expect(credibilityPayload.pack.engineRunLedger.latestStrictReviewerRun).toMatchObject({
      runId: strictEngineRunWritePayload.run.runId,
      requiredTotal: 5
    });
    expect(credibilityPayload.pack.reviewerCommands.verifyEngines).toContain("--write --require-all-engines");
    expect(credibilityPayload.pack.reviewerCommands.reproducePack).toContain("--require-all-engines");
    expect(credibilityPayload.pack.reviewerCommands.dockerLeanRepairGate).toBe("npm run docker:proof-repair");

    const releaseAuditResponse = await fetch(
      `${baseUrl}/api/release-audit?requireAllEngines=true&requireSavedStrictEngineRun=true&requireSandbox=true&timeoutMs=50`
    );
    expect(releaseAuditResponse.status).toBe(200);
    const releaseAuditPayload = await releaseAuditResponse.json();
    expectLocalApiSuccess(releaseAuditResponse, releaseAuditPayload);
    expect(releaseAuditPayload).toMatchObject({
      schemaVersion: "truth-harness.web-release-audit-response.v0",
      localOnly: true,
      externalCalls: [],
      mode: "public-review"
    });
    expect(releaseAuditPayload.audit).toMatchObject({
      schemaVersion: "truth-harness.release-audit.v0",
      localOnly: true,
      networkAccess: "none",
      mode: "public-review"
    });
    expect(releaseAuditPayload.audit.commands.releaseAudit).toContain("--require-all-engines");
    expect(releaseAuditPayload.audit.commands.dockerProfessorAll).toBe("npm run docker:professor:all");
    expect(releaseAuditPayload.audit.checks).toContainEqual(
      expect.objectContaining({
        id: "engine-evidence",
        blocking: true
      })
    );
    const sandboxCheck = releaseAuditPayload.audit.checks.find((check: { id?: string }) => check.id === "code-run-sandbox");
    expect(sandboxCheck).toBeDefined();
    expect(sandboxCheck).toEqual(
      expect.objectContaining({
        id: "code-run-sandbox"
      })
    );
    expect(sandboxCheck?.blocking).toBe(sandboxCheck?.status === "pass" ? false : true);

    const compactReleaseAuditResponse = await fetch(
      `${baseUrl}/api/release-audit?compact=true&requireAllEngines=true&requireSavedStrictEngineRun=true&requireSandbox=true&timeoutMs=50`
    );
    expect(compactReleaseAuditResponse.status).toBe(200);
    const compactReleaseAuditPayload = await compactReleaseAuditResponse.json();
    expectLocalApiSuccess(compactReleaseAuditResponse, compactReleaseAuditPayload);
    expect(compactReleaseAuditPayload).toMatchObject({
      schemaVersion: "truth-harness.web-release-audit-response.v0",
      compact: true,
      mode: "public-review"
    });
    expect(compactReleaseAuditPayload.audit).toMatchObject({
      schemaVersion: "truth-harness.release-audit.v0",
      status: expect.any(String),
      commands: expect.objectContaining({
        releaseAudit: expect.stringContaining("--require-all-engines")
      }),
      credibilityPack: expect.objectContaining({
        summary: expect.any(Object),
        reviewerCommands: expect.any(Object)
      })
    });
    expect(compactReleaseAuditPayload.audit.checks).toContainEqual(
      expect.objectContaining({
        id: "engine-evidence",
        blocking: true
      })
    );
    expect(compactReleaseAuditPayload.audit.credibilityPack.reviewerActionPlan).toBeUndefined();

    const credibilityWriteResponse = await fetch(`${baseUrl}/api/credibility-pack`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ timeoutMs: 50, requireAllEngines: true })
    });
    expect(credibilityWriteResponse.status).toBe(200);
    const credibilityWritePayload = await credibilityWriteResponse.json();
    expectLocalApiSuccess(credibilityWriteResponse, credibilityWritePayload);
    expect(credibilityWritePayload).toMatchObject({
      schemaVersion: "truth-harness.web-credibility-pack-write-response.v0",
      localOnly: true,
      externalCalls: [],
      mode: "all-engines"
    });
    expect(credibilityWritePayload.pack.schemaVersion).toBe("truth-harness.credibility-pack.v0");
    expect(credibilityWritePayload.pack.reviewerActionPlan.actions.length).toBeGreaterThan(0);
    expect(credibilityWritePayload.pack.reviewerCommands.verifyEngines).toContain("--write --require-all-engines");
    expect(credibilityWritePayload.pack.reviewerCommands.dockerLeanRepairGate).toBe("npm run docker:proof-repair");
    expect(credibilityWritePayload.paths.json).toContain(".truth-harness");
    expect(credibilityWritePayload.paths.markdown).toContain(".truth-harness");
    expect(existsSync(credibilityWritePayload.paths.json)).toBe(true);
    expect(existsSync(credibilityWritePayload.paths.markdown)).toBe(true);
    expect(credibilityWritePayload.activity).toContainEqual(
      expect.objectContaining({
        actor: "local-api",
        action: "wrote-credibility-pack"
      })
    );

    const emptyBundleResponse = await fetch(`${baseUrl}/api/credibility-bundle/latest`);
    expect(emptyBundleResponse.status).toBe(200);
    const emptyBundlePayload = await emptyBundleResponse.json();
    expectLocalApiSuccess(emptyBundleResponse, emptyBundlePayload);
    expect(emptyBundlePayload).toMatchObject({
      schemaVersion: "truth-harness.web-credibility-bundle-latest-response.v0",
      localOnly: true,
      externalCalls: [],
      latest: false
    });

    const bundle = await writeCredibilityBundle({
      rootPath: tempProjectRoot,
      now: "2026-06-17T00:00:00.000Z",
      engineRequirements: { maxima: true, z3: true, lean: true },
      maximaCommand: "maxima-test",
      z3Command: "z3-test",
      leanCommand: "lean-test",
      sageCommand: "sage-test",
      smtSourcePath: "constraints.smt2",
      smtSourceText: "(set-logic QF_LIA)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)\n",
      leanSourcePath: "Proof.lean",
      leanSourceText: "theorem smoke : True := by\n  trivial\n",
      runner: passingEngineRunner
    });
    const bundleResponse = await fetch(`${baseUrl}/api/credibility-bundle/latest`);
    expect(bundleResponse.status).toBe(200);
    const bundlePayload = await bundleResponse.json();
    expectLocalApiSuccess(bundleResponse, bundlePayload);
    expect(bundlePayload).toMatchObject({
      schemaVersion: "truth-harness.web-credibility-bundle-latest-response.v0",
      localOnly: true,
      externalCalls: [],
      latest: true,
      bundleRef: expect.stringContaining("-credibility-bundle"),
      manifest: {
        schemaVersion: "truth-harness.credibility-bundle.v0",
        bundleId: bundle.manifest.bundleId,
        packId: bundle.manifest.packId,
        bundleDigest: {
          algorithm: "sha256",
          scope: "truth-harness.credibility-bundle-manifest-digest.v0",
          value: expect.stringMatching(/^[a-f0-9]{64}$/u)
        }
      },
      verification: {
        schemaVersion: "truth-harness.credibility-bundle-verification.v0",
        bundleId: bundle.manifest.bundleId,
        passed: true,
        sourceMatchesWorkspace: true,
        manifestDigestStatus: "verified",
        manifestDigestExpected: bundle.manifest.bundleDigest?.value,
        manifestDigestActual: bundle.manifest.bundleDigest?.value
      }
    });
    expect(bundlePayload.command).toContain("workspace verify-credibility-bundle");
    expect(bundlePayload.paths.relativeBundle).toContain(bundle.manifest.bundleId);

    const bundleVerifyResponse = await fetch(`${baseUrl}/api/credibility-bundle/latest/verify`);
    expect(bundleVerifyResponse.status).toBe(200);
    const bundleVerifyPayload = await bundleVerifyResponse.json();
    expectLocalApiSuccess(bundleVerifyResponse, bundleVerifyPayload);
    expect(bundleVerifyPayload).toMatchObject({
      schemaVersion: "truth-harness.web-credibility-bundle-verify-response.v0",
      localOnly: true,
      externalCalls: [],
      latest: true,
      bundleRef: expect.stringContaining("-credibility-bundle"),
      verification: {
        schemaVersion: "truth-harness.credibility-bundle-verification.v0",
        verificationId: expect.stringMatching(/^cver_[a-f0-9]{16}$/u),
        bundleId: bundle.manifest.bundleId,
        passed: true,
        sourceMatchesWorkspace: true,
        manifestDigestStatus: "verified",
        manifestDigestExpected: bundle.manifest.bundleDigest?.value,
        manifestDigestActual: bundle.manifest.bundleDigest?.value
      },
      verificationPaths: {
        json: expect.stringContaining(".truth-harness"),
        markdown: expect.stringContaining(".truth-harness")
      }
    });
    expect(bundleVerifyPayload.verifiedAt).toEqual(expect.any(String));
    expect(bundleVerifyPayload.command).toContain("workspace verify-credibility-bundle");
    expect(existsSync(bundleVerifyPayload.verificationPaths.json)).toBe(true);
    expect(existsSync(bundleVerifyPayload.verificationPaths.markdown)).toBe(true);

    const bundleVerificationHistoryResponse = await fetch(`${baseUrl}/api/credibility-bundle/verifications?limit=4`);
    expect(bundleVerificationHistoryResponse.status).toBe(200);
    const bundleVerificationHistoryPayload = await bundleVerificationHistoryResponse.json();
    expectLocalApiSuccess(bundleVerificationHistoryResponse, bundleVerificationHistoryPayload);
    expect(bundleVerificationHistoryPayload).toMatchObject({
      schemaVersion: "truth-harness.web-credibility-bundle-verification-history-response.v0",
      localOnly: true,
      externalCalls: [],
      count: expect.any(Number),
      verifications: [
        expect.objectContaining({
          verification: expect.objectContaining({
            schemaVersion: "truth-harness.credibility-bundle-verification.v0",
            verificationId: bundleVerifyPayload.verification.verificationId,
            bundleId: bundle.manifest.bundleId,
            manifestDigestStatus: "verified"
          }),
          paths: expect.objectContaining({
            relativeJson: expect.stringContaining("credibility-bundle-verification.json")
          })
        })
      ]
    });

    const verificationId = bundleVerifyPayload.verification.verificationId;
    const verificationJsonResponse = await fetch(
      `${baseUrl}/api/credibility-bundle/verifications/file?id=${verificationId}&kind=json`
    );
    expect(verificationJsonResponse.status).toBe(200);
    expect(verificationJsonResponse.headers.get("content-type")).toContain("application/json");
    expect(verificationJsonResponse.headers.get("content-disposition")).toContain(`${verificationId}-credibility-bundle-verification.json`);
    const verificationJsonPayload = await verificationJsonResponse.json();
    expect(verificationJsonPayload).toMatchObject({
      schemaVersion: "truth-harness.credibility-bundle-verification.v0",
      verificationId,
      bundleId: bundle.manifest.bundleId,
      manifestDigestStatus: "verified"
    });

    const verificationMarkdownResponse = await fetch(
      `${baseUrl}/api/credibility-bundle/verifications/file?id=${verificationId}&kind=markdown`
    );
    expect(verificationMarkdownResponse.status).toBe(200);
    expect(verificationMarkdownResponse.headers.get("content-type")).toContain("text/markdown");
    expect(verificationMarkdownResponse.headers.get("content-disposition")).toContain(`${verificationId}-credibility-bundle-verification.md`);
    const verificationMarkdown = await verificationMarkdownResponse.text();
    expect(verificationMarkdown).toContain(verificationId);
    expect(verificationMarkdown).toContain(bundle.manifest.bundleId);

    const invalidVerificationFileResponse = await fetch(
      `${baseUrl}/api/credibility-bundle/verifications/file?id=manifest.json&kind=json`
    );
    expect(invalidVerificationFileResponse.status).toBe(400);
    const invalidVerificationFilePayload = await invalidVerificationFileResponse.json();
    expect(invalidVerificationFilePayload).toMatchObject({
      schemaVersion: "truth-harness.web-error.v0",
      localOnly: true,
      externalCalls: [],
      status: 400,
      error: "Credibility bundle verification id is required."
    });

    const bundleReadmeResponse = await fetch(`${baseUrl}/api/credibility-bundle/latest/file?kind=readme`);
    expect(bundleReadmeResponse.status).toBe(200);
    expect(bundleReadmeResponse.headers.get("content-type")).toContain("text/markdown");
    expect(bundleReadmeResponse.headers.get("content-disposition")).toContain(`${bundle.manifest.bundleId}-README.md`);
    const bundleReadmeText = await bundleReadmeResponse.text();
    expect(bundleReadmeText).toContain("Truth Harness Portable Reviewer Bundle");
    expect(bundleReadmeText).toContain(bundle.manifest.bundleId);

    const bundleManifestResponse = await fetch(`${baseUrl}/api/credibility-bundle/latest/file?kind=manifest`);
    expect(bundleManifestResponse.status).toBe(200);
    expect(bundleManifestResponse.headers.get("content-type")).toContain("application/json");
    const bundleManifestPayload = await bundleManifestResponse.json();
    expect(bundleManifestPayload).toMatchObject({
      schemaVersion: "truth-harness.credibility-bundle.v0",
      bundleId: bundle.manifest.bundleId,
      bundleDigest: {
        value: bundle.manifest.bundleDigest?.value
      }
    });

    const bundleArchiveResponse = await fetch(`${baseUrl}/api/credibility-bundle/latest/archive`);
    expect(bundleArchiveResponse.status).toBe(200);
    expect(bundleArchiveResponse.headers.get("content-type")).toBe("application/gzip");
    expect(bundleArchiveResponse.headers.get("content-disposition")).toContain(`${bundle.manifest.bundleId}-credibility-bundle.tar.gz`);
    expect(bundleArchiveResponse.headers.get("x-truth-harness-bundle-id")).toBe(bundle.manifest.bundleId);
    const bundleArchiveBytes = Buffer.from(await bundleArchiveResponse.arrayBuffer());
    const bundleArchiveSha256 = createHash("sha256").update(bundleArchiveBytes).digest("hex");
    expect(bundleArchiveResponse.headers.get("x-truth-harness-archive-sha256")).toBe(bundleArchiveSha256);
    expect([...bundleArchiveBytes.slice(0, 2)]).toEqual([0x1f, 0x8b]);
    const bundleArchiveNames = listTarEntryNames(gunzipSync(bundleArchiveBytes));
    expect(bundleArchiveNames).toContain(`${bundle.manifest.bundlePath.split(/[\\/]/u).at(-1)}/manifest.json`);
    expect(bundleArchiveNames).toContain(`${bundle.manifest.bundlePath.split(/[\\/]/u).at(-1)}/credibility-pack.md`);
    expect(bundleArchiveNames.some((entry) => entry.endsWith("/README.md"))).toBe(true);

    const bundleArchiveMetadataResponse = await fetch(`${baseUrl}/api/credibility-bundle/latest/archive-metadata`);
    expect(bundleArchiveMetadataResponse.status).toBe(200);
    const bundleArchiveMetadata = await bundleArchiveMetadataResponse.json();
    expect(bundleArchiveMetadata).toMatchObject({
      schemaVersion: "truth-harness.web-credibility-bundle-archive-metadata-response.v0",
      localOnly: true,
      externalCalls: [],
      archive: {
        bundleId: bundle.manifest.bundleId,
        byteLength: bundleArchiveBytes.length,
        sha256: bundleArchiveSha256,
        archiveUrl: "/api/credibility-bundle/latest/archive",
        checksumUrl: "/api/credibility-bundle/latest/archive.sha256"
      }
    });

    const bundleArchiveChecksumResponse = await fetch(`${baseUrl}/api/credibility-bundle/latest/archive.sha256`);
    expect(bundleArchiveChecksumResponse.status).toBe(200);
    expect(bundleArchiveChecksumResponse.headers.get("content-type")).toContain("text/plain");
    expect(bundleArchiveChecksumResponse.headers.get("content-disposition")).toContain(".tar.gz.sha256");
    const bundleArchiveChecksum = await bundleArchiveChecksumResponse.text();
    expect(bundleArchiveChecksum).toBe(`${bundleArchiveSha256}  truth-harness-${bundle.manifest.bundleId}-credibility-bundle.tar.gz\n`);

    const invalidBundleFileResponse = await fetch(`${baseUrl}/api/credibility-bundle/latest/file?kind=zip`);
    expect(invalidBundleFileResponse.status).toBe(400);
    const invalidBundleFilePayload = await invalidBundleFileResponse.json();
    expect(invalidBundleFilePayload).toMatchObject({
      schemaVersion: "truth-harness.web-error.v0",
      localOnly: true,
      externalCalls: [],
      status: 400,
      error: "Unsupported credibility bundle file kind."
    });

    const receiptResponse = await fetch(`${baseUrl}/api/receipt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ problem: "compute 3 / 4 + 5 / 8" })
    });
    expect(receiptResponse.status).toBe(200);
    const receiptPayload = await receiptResponse.json();
    expectLocalApiSuccess(receiptResponse, receiptPayload);
    expect(receiptPayload.localOnly).toBe(true);
    expect(receiptPayload.externalCalls).toEqual([]);
    expect(receiptPayload.route.routeId).toMatch(/^route_[a-f0-9]{16}$/u);
    expect(receiptPayload.route.proofObligations).toContainEqual(
      expect.objectContaining({
        kind: "formal-proof",
        sourceCapabilityId: "accepted-proof-checker"
      })
    );
    expect(receiptPayload.routePaths.json).toContain(".truth-harness");
    expect(existsSync(receiptPayload.routePaths.json)).toBe(true);
    expect(existsSync(receiptPayload.routePaths.markdown)).toBe(true);
    expect(receiptPayload.receiptPaths.ref).toMatch(/^\.truth-harness\/receipts\/\d{4}-\d{2}-\d{2}-run_[a-f0-9]+\.json$/u);
    expect(receiptPayload.receiptPaths.json).toContain(".truth-harness");
    expect(existsSync(receiptPayload.receiptPaths.json)).toBe(true);

    const receiptClaimResponse = await fetch(`${baseUrl}/api/claims`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        statement: "3 / 4 + 5 / 8 = 11/8",
        domain: "math",
        trust: "exact-computed",
        evidenceRefs: [
          {
            kind: "receipt",
            ref: receiptPayload.receiptPaths.ref
          }
        ]
      })
    });
    expect(receiptClaimResponse.status).toBe(200);
    const receiptClaimPayload = await receiptClaimResponse.json();
    expectLocalApiSuccess(receiptClaimResponse, receiptClaimPayload);
    expect(receiptClaimPayload.claim.trust).toBe("exact-computed");
    expect(receiptClaimPayload.claim.evidenceRefs).toContainEqual(
      expect.objectContaining({
        kind: "receipt",
        ref: receiptPayload.receiptPaths.ref,
        trust: "exact-computed"
      })
    );

    const listResponse = await fetch(`${baseUrl}/api/routes`);
    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json();
    expectLocalApiSuccess(listResponse, listPayload);
    expect(listPayload.localOnly).toBe(true);
    expect(listPayload.externalCalls).toEqual([]);
    expect(listPayload.routes).toHaveLength(1);
    expect(listPayload.routes[0]).toMatchObject({
      routeId: receiptPayload.route.routeId,
      finalTrust: "exact-computed",
      status: "verified",
      evidenceKind: "exact-arithmetic",
      proofObligations: receiptPayload.route.proofObligations.length,
      openProofObligations: receiptPayload.route.proofObligations.filter((obligation: { status: string }) => obligation.status === "open").length,
      satisfiedProofObligations: 0,
      notRequiredProofObligations: receiptPayload.route.proofObligations.filter((obligation: { status: string }) => obligation.status === "not-required").length,
      criticalOpenProofObligations: receiptPayload.route.proofObligations.filter((obligation: { status: string; severity: string }) =>
        obligation.status === "open" && obligation.severity === "critical"
      ).length,
      readyForNarrowClaim: true,
      strongestRouteTrust: "exact-computed",
      blockingObligations: 0
    });
    expect(listPayload.routes[0].readinessSummary).toContain("Ready only as a narrow exact-computed claim");
    expect(listPayload.routes[0].routePaths.json).toBe(receiptPayload.routePaths.json);

    const catalogStatusBeforeResponse = await fetch(`${baseUrl}/api/catalog/status`);
    expect(catalogStatusBeforeResponse.status).toBe(200);
    const catalogStatusBeforePayload = await catalogStatusBeforeResponse.json();
    expectLocalApiSuccess(catalogStatusBeforeResponse, catalogStatusBeforePayload);
    expect(catalogStatusBeforePayload.catalog.exists).toBe(false);
    expect(catalogStatusBeforePayload.catalog.networkAccess).toBe("none");

    const catalogRebuildResponse = await fetch(`${baseUrl}/api/catalog/rebuild`, {
      method: "POST"
    });
    expect(catalogRebuildResponse.status).toBe(200);
    const catalogRebuildPayload = await catalogRebuildResponse.json();
    expectLocalApiSuccess(catalogRebuildResponse, catalogRebuildPayload);
    expect(catalogRebuildPayload.rebuild.schemaVersion).toBe("truth-harness.catalog-rebuild.v0");
    expect(catalogRebuildPayload.rebuild.localOnly).toBe(true);
    expect(catalogRebuildPayload.rebuild.networkAccess).toBe("none");
    expect(catalogRebuildPayload.rebuild.claimCount).toBe(1);
    expect(catalogRebuildPayload.rebuild.routeCount).toBe(1);
    expect(catalogRebuildPayload.catalog.exists).toBe(true);

    const catalogSearchResponse = await fetch(`${baseUrl}/api/catalog/search?kind=claims&trust=exact-computed&limit=5`);
    expect(catalogSearchResponse.status).toBe(200);
    const catalogSearchPayload = await catalogSearchResponse.json();
    expectLocalApiSuccess(catalogSearchResponse, catalogSearchPayload);
    expect(catalogSearchPayload.search.schemaVersion).toBe("truth-harness.catalog-search.v0");
    expect(catalogSearchPayload.search.localOnly).toBe(true);
    expect(catalogSearchPayload.search.networkAccess).toBe("none");
    expect(catalogSearchPayload.search.results).toContainEqual(
      expect.objectContaining({
        artifactId: receiptClaimPayload.claim.claimId,
        kind: "claims",
        trust: "exact-computed"
      })
    );
    const catalogRefSearchResponse = await fetch(
      `${baseUrl}/api/catalog/search?kind=claims&ref=${encodeURIComponent(receiptPayload.receiptPaths.ref)}`
    );
    expect(catalogRefSearchResponse.status).toBe(200);
    const catalogRefSearchPayload = await catalogRefSearchResponse.json();
    expectLocalApiSuccess(catalogRefSearchResponse, catalogRefSearchPayload);
    expect(catalogRefSearchPayload.search.filters.ref).toBe(receiptPayload.receiptPaths.ref);
    expect(catalogRefSearchPayload.search.results).toContainEqual(
      expect.objectContaining({
        artifactId: receiptClaimPayload.claim.claimId,
        kind: "claims"
      })
    );

    const eventLogResponse = await fetch(`${baseUrl}/api/events?limit=50`);
    expect(eventLogResponse.status).toBe(200);
    const eventLogPayload = await eventLogResponse.json();
    expectLocalApiSuccess(eventLogResponse, eventLogPayload);
    expect(eventLogPayload.localOnly).toBe(true);
    expect(eventLogPayload.externalCalls).toEqual([]);
    expect(eventLogPayload.eventLog).toMatchObject({
      schemaVersion: "truth-harness.event-list.v0",
      localOnly: true,
      networkAccess: "none"
    });
    expect(eventLogPayload.eventLog.total).toBeGreaterThanOrEqual(3);
    expect(eventLogPayload.eventLog.events).toContainEqual(
      expect.objectContaining({
        action: "artifact-written",
        kind: "receipts",
        artifactId: receiptPayload.receipt.runId,
        localOnly: true,
        networkAccess: "none"
      })
    );
    expect(eventLogPayload.eventLog.events).toContainEqual(
      expect.objectContaining({
        action: "artifact-written",
        kind: "claims",
        artifactId: receiptClaimPayload.claim.claimId,
        localOnly: true,
        networkAccess: "none"
      })
    );

    const reviewResponse = await fetch(`${baseUrl}/api/workspace-review`);
    expect(reviewResponse.status).toBe(200);
    const reviewPayload = await reviewResponse.json();
    expectLocalApiSuccess(reviewResponse, reviewPayload);
    expect(reviewPayload.localOnly).toBe(true);
    expect(reviewPayload.externalCalls).toEqual([]);
    expect(reviewPayload.review).toMatchObject({
      schemaVersion: "truth-harness.workspace-review.v0",
      localOnly: true,
      networkAccess: "none"
    });
    expect(reviewPayload.review.summary.routes).toBe(1);
    expect(reviewPayload.review.summary.readyRoutesWithoutClaims).toBe(1);
    expect(reviewPayload.review.items).toContainEqual(
      expect.objectContaining({
        kind: "route-ready-claim",
        routeId: receiptPayload.route.routeId,
        claimId: receiptClaimPayload.claim.claimId,
        command: expect.stringContaining(`truth-harness claim review ${receiptClaimPayload.claim.claimId}`),
        acceptanceCriteria: expect.arrayContaining([
          "Review the existing equivalent claim and link or supersede it with this ready route.",
          "Do not create a duplicate claim for the same scoped statement."
        ]),
        evidenceSlots: expect.arrayContaining([
          expect.objectContaining({
            slotId: "claim-ledger-record",
            suggestedCommand: expect.stringContaining(`truth-harness claim review ${receiptClaimPayload.claim.claimId}`)
          })
        ]),
        agentPacket: expect.stringContaining("# Truth Harness Workspace Action")
      })
    );

    const runNextResponse = await fetch(`${baseUrl}/api/workspace-run-next`);
    expect(runNextResponse.status).toBe(200);
    const runNextPayload = await runNextResponse.json();
    expectLocalApiSuccess(runNextResponse, runNextPayload);
    expect(runNextPayload).toMatchObject({
      schemaVersion: "truth-harness.web-workspace-run-next-response.v0",
      localOnly: true,
      externalCalls: []
    });
    expect(runNextPayload.plan).toMatchObject({
      schemaVersion: "truth-harness.workspace-run-next.v0",
      localOnly: true,
      networkAccess: "none",
      dryRun: true,
      status: "blocked"
    });
    expect(runNextPayload.plan.reviewId).toMatch(/^wrev_[a-f0-9]{16}$/u);
    expect(runNextPayload.plan.execution).toMatchObject({
      status: "blocked",
      kind: "no-open-item"
    });
    expect(runNextPayload.plan.warnings).toContain(
      "Run-next never executes shell strings. Only supported local Truth Harness actions can run."
    );
    expect(runNextPayload.plan.item).toBeUndefined();

    const forbiddenRunNextResponse = await fetch(`${baseUrl}/api/workspace-run-next?executeLocal=true`);
    expect(forbiddenRunNextResponse.status).toBe(400);
    const forbiddenRunNextPayload = await forbiddenRunNextResponse.json();
    expect(forbiddenRunNextPayload.requestId).toMatch(/^web_err_[0-9a-f-]{36}$/u);
    expect(forbiddenRunNextResponse.headers.get("x-truth-harness-request-id")).toBe(forbiddenRunNextPayload.requestId);
    expect(forbiddenRunNextPayload.schemaVersion).toBe("truth-harness.web-error.v0");
    expect(forbiddenRunNextPayload.localOnly).toBe(true);
    expect(forbiddenRunNextPayload.externalCalls).toEqual([]);
    expect(forbiddenRunNextPayload.error).toContain("dry-run only");

    const forbiddenRunNextWriteResponse = await fetch(`${baseUrl}/api/workspace-run-next`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        executeLocal: true
      })
    });
    expect(forbiddenRunNextWriteResponse.status).toBe(400);
    const forbiddenRunNextWritePayload = await forbiddenRunNextWriteResponse.json();
    expect(forbiddenRunNextWritePayload.schemaVersion).toBe("truth-harness.web-error.v0");
    expect(forbiddenRunNextWritePayload.localOnly).toBe(true);
    expect(forbiddenRunNextWritePayload.externalCalls).toEqual([]);
    expect(forbiddenRunNextWritePayload.error).toContain("dry-run only");

    const workspaceRunNextWriteResponse = await fetch(`${baseUrl}/api/workspace-run-next`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "workspace-review"
      })
    });
    expect(workspaceRunNextWriteResponse.status).toBe(200);
    const workspaceRunNextWritePayload = await workspaceRunNextWriteResponse.json();
    expectLocalApiSuccess(workspaceRunNextWriteResponse, workspaceRunNextWritePayload);
    expect(workspaceRunNextWritePayload).toMatchObject({
      schemaVersion: "truth-harness.web-workspace-run-next-write-response.v0",
      localOnly: true,
      externalCalls: [],
      source: "workspace-review",
      mode: "default",
      plan: {
        schemaVersion: "truth-harness.workspace-run-next.v0",
        localOnly: true,
        networkAccess: "none",
        dryRun: true,
        sourceRevision: {
          revisionId: expect.stringMatching(/^rev_[a-f0-9]{16}$/u),
          path: expect.stringContaining(".truth-harness/revisions/"),
          sourceSnapshotId: expect.stringMatching(/^snap_[a-f0-9]{16}$/u)
        },
        sourceSnapshot: {
          snapshotId: expect.stringMatching(/^snap_[a-f0-9]{16}$/u),
          path: expect.stringContaining(".truth-harness/snapshots/")
        }
      }
    });
    expect(workspaceRunNextWritePayload.paths.json).toContain(".truth-harness");
    expect(workspaceRunNextWritePayload.paths.markdown).toContain(".truth-harness");
    expect(existsSync(workspaceRunNextWritePayload.paths.json)).toBe(true);
    expect(existsSync(workspaceRunNextWritePayload.paths.markdown)).toBe(true);
    expect(workspaceRunNextWritePayload.activity).toContainEqual(
      expect.objectContaining({
        actor: "local-api",
        action: "wrote-workspace-run-next-plan"
      })
    );

    const workspaceRunNextShowResponse = await fetch(
      `${baseUrl}/api/workspace-run-nexts/${workspaceRunNextWritePayload.plan.planId}?verifySnapshot=true`
    );
    expect(workspaceRunNextShowResponse.status).toBe(200);
    const workspaceRunNextShowPayload = await workspaceRunNextShowResponse.json();
    expectLocalApiSuccess(workspaceRunNextShowResponse, workspaceRunNextShowPayload);
    expect(workspaceRunNextShowPayload.inspection).toMatchObject({
      plan: {
        planId: workspaceRunNextWritePayload.plan.planId,
        sourceRevision: {
          revisionId: workspaceRunNextWritePayload.plan.sourceRevision.revisionId
        }
      },
      sourceRevision: {
        sourceRevisionStatus: expect.stringMatching(/^(verified|drifted|missing|not-recorded)$/u)
      },
      sourceSnapshot: {
        sourceSnapshotStatus: expect.stringMatching(/^(verified|drifted|missing|not-recorded)$/u)
      },
      resumeDecision: {
        action: expect.any(String),
        nextCommand: expect.stringContaining("truth-harness")
      }
    });

    const pilotLoopResponse = await fetch(`${baseUrl}/api/workspace-pilot-loop?maxSteps=3`);
    expect(pilotLoopResponse.status).toBe(200);
    const pilotLoopPayload = await pilotLoopResponse.json();
    expectLocalApiSuccess(pilotLoopResponse, pilotLoopPayload);
    expect(pilotLoopPayload).toMatchObject({
      schemaVersion: "truth-harness.web-workspace-pilot-loop-response.v0",
      localOnly: true,
      externalCalls: [],
      source: "workspace-review",
      mode: "default",
      loop: {
        schemaVersion: "truth-harness.workspace-pilot-loop.v0",
        localOnly: true,
        networkAccess: "none",
        dryRun: true,
        maxSteps: 3,
        status: "stopped",
        stopReason: "dry-run"
      }
    });
    expect(pilotLoopPayload.loop.loopId).toMatch(/^wpl_[a-f0-9]{8}$/u);
    expect(pilotLoopPayload.loop.summary.plannedSteps).toBeGreaterThanOrEqual(1);
    expect(pilotLoopPayload.activity).toContainEqual(
      expect.objectContaining({
        actor: "local-api",
        action: "previewed-workspace-pilot-loop"
      })
    );

    const credibilityPilotLoopResponse = await fetch(
      `${baseUrl}/api/workspace-pilot-loop?source=credibility-actions&requireAllEngines=true&timeoutMs=50&maxSteps=2`
    );
    expect(credibilityPilotLoopResponse.status).toBe(200);
    const credibilityPilotLoopPayload = await credibilityPilotLoopResponse.json();
    expectLocalApiSuccess(credibilityPilotLoopResponse, credibilityPilotLoopPayload);
    expect(credibilityPilotLoopPayload).toMatchObject({
      schemaVersion: "truth-harness.web-workspace-pilot-loop-response.v0",
      localOnly: true,
      externalCalls: [],
      source: "credibility-actions",
      mode: "all-engines",
      loop: {
        schemaVersion: "truth-harness.workspace-pilot-loop.v0",
        localOnly: true,
        networkAccess: "none",
        dryRun: true,
        source: "credibility-actions",
        maxSteps: 2,
        status: "stopped",
        stopReason: "dry-run"
      }
    });
    expect(credibilityPilotLoopPayload.loop.summary.plannedSteps).toBeGreaterThanOrEqual(1);
    expect(credibilityPilotLoopPayload.loop.steps[0].item.kind).toBe("credibility-action");

    const forbiddenPilotLoopResponse = await fetch(`${baseUrl}/api/workspace-pilot-loop?executeLocal=true`);
    expect(forbiddenPilotLoopResponse.status).toBe(400);
    const forbiddenPilotLoopPayload = await forbiddenPilotLoopResponse.json();
    expect(forbiddenPilotLoopPayload.schemaVersion).toBe("truth-harness.web-error.v0");
    expect(forbiddenPilotLoopPayload.localOnly).toBe(true);
    expect(forbiddenPilotLoopPayload.externalCalls).toEqual([]);
    expect(forbiddenPilotLoopPayload.error).toContain("dry-run only");

    const credibilityRunNextResponse = await fetch(
      `${baseUrl}/api/workspace-run-next?source=credibility-actions&requireAllEngines=true&timeoutMs=50`
    );
    expect(credibilityRunNextResponse.status).toBe(200);
    const credibilityRunNextPayload = await credibilityRunNextResponse.json();
    expectLocalApiSuccess(credibilityRunNextResponse, credibilityRunNextPayload);
    expect(credibilityRunNextPayload).toMatchObject({
      schemaVersion: "truth-harness.web-workspace-run-next-response.v0",
      localOnly: true,
      externalCalls: [],
      source: "credibility-actions",
      mode: "all-engines"
    });
    expect(credibilityRunNextPayload.packSummary).toMatchObject({
      packId: expect.stringMatching(/^cred_[a-f0-9]{16}$/u),
      totalActions: expect.any(Number),
      criticalActions: expect.any(Number),
      highActions: expect.any(Number)
    });
    expect(credibilityRunNextPayload.plan).toMatchObject({
      schemaVersion: "truth-harness.workspace-run-next.v0",
      localOnly: true,
      networkAccess: "none",
      dryRun: true,
      status: "planned",
      item: {
        kind: "credibility-action",
        command: expect.stringContaining("truth-harness")
      },
      execution: {
        status: "planned",
        kind: "dry-run"
      }
    });
    expect(credibilityRunNextPayload.plan.reviewId).toContain("_actions");

    const credibilityRunNextWriteResponse = await fetch(`${baseUrl}/api/workspace-run-next`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "credibility-actions",
        requireAllEngines: true,
        timeoutMs: 50
      })
    });
    expect(credibilityRunNextWriteResponse.status).toBe(200);
    const credibilityRunNextWritePayload = await credibilityRunNextWriteResponse.json();
    expectLocalApiSuccess(credibilityRunNextWriteResponse, credibilityRunNextWritePayload);
    expect(credibilityRunNextWritePayload).toMatchObject({
      schemaVersion: "truth-harness.web-workspace-run-next-write-response.v0",
      localOnly: true,
      externalCalls: [],
      source: "credibility-actions",
      mode: "all-engines"
    });
    expect(credibilityRunNextWritePayload.plan).toMatchObject({
      schemaVersion: "truth-harness.workspace-run-next.v0",
      localOnly: true,
      networkAccess: "none",
      dryRun: true,
      item: {
        kind: "credibility-action"
      },
      execution: {
        kind: "dry-run"
      }
    });
    expect(credibilityRunNextWritePayload.paths.json).toContain(".truth-harness");
    expect(credibilityRunNextWritePayload.paths.markdown).toContain(".truth-harness");
    expect(existsSync(credibilityRunNextWritePayload.paths.json)).toBe(true);
    expect(existsSync(credibilityRunNextWritePayload.paths.markdown)).toBe(true);
    expect(credibilityRunNextWritePayload.activity).toContainEqual(
      expect.objectContaining({
        actor: "local-api",
        action: "wrote-workspace-run-next-plan"
      })
    );

    const runNextListResponse = await fetch(`${baseUrl}/api/workspace-run-nexts?limit=5`);
    expect(runNextListResponse.status).toBe(200);
    const runNextListPayload = await runNextListResponse.json();
    expectLocalApiSuccess(runNextListResponse, runNextListPayload);
    expect(runNextListPayload).toMatchObject({
      schemaVersion: "truth-harness.web-workspace-run-next-list-response.v0",
      localOnly: true,
      externalCalls: [],
      verifySnapshots: false,
      limit: 5
    });
    expect(runNextListPayload.total).toBeGreaterThanOrEqual(1);
    expect(runNextListPayload.plans.length).toBeLessThanOrEqual(5);
    expect(runNextListPayload.plans).toContainEqual(
      expect.objectContaining({
        planId: credibilityRunNextWritePayload.plan.planId,
        localOnly: true,
        networkAccess: "none",
        resumeDecision: expect.objectContaining({
          action: expect.any(String),
          nextCommand: expect.stringContaining("truth-harness")
        })
      })
    );

    const runNextShowResponse = await fetch(
      `${baseUrl}/api/workspace-run-nexts/${credibilityRunNextWritePayload.plan.planId}?verifySnapshot=true`
    );
    expect(runNextShowResponse.status).toBe(200);
    const runNextShowPayload = await runNextShowResponse.json();
    expectLocalApiSuccess(runNextShowResponse, runNextShowPayload);
    expect(runNextShowPayload).toMatchObject({
      schemaVersion: "truth-harness.web-workspace-run-next-show-response.v0",
      localOnly: true,
      externalCalls: [],
      verifySnapshot: true,
      inspection: {
        schemaVersion: "truth-harness.workspace-run-next-inspection.v0",
        plan: {
        planId: credibilityRunNextWritePayload.plan.planId,
        localOnly: true,
        networkAccess: "none",
        sourceRevision: expect.objectContaining({
          revisionId: expect.stringMatching(/^rev_[a-f0-9]{16}$/u),
          path: expect.stringContaining(".truth-harness/revisions/")
        })
      },
        resumeDecision: expect.objectContaining({
          safeToResume: expect.any(Boolean),
          nextCommand: expect.stringContaining("truth-harness")
        })
      }
    });
    expect(["verified", "drifted", "missing", "not-recorded"]).toContain(
      runNextShowPayload.inspection.sourceRevision?.sourceRevisionStatus
    );
    expect(["verified", "drifted", "missing", "not-recorded"]).toContain(
      runNextShowPayload.inspection.sourceSnapshot?.sourceSnapshotStatus
    );

    const graphResponse = await fetch(`${baseUrl}/api/workspace-graph`);
    expect(graphResponse.status).toBe(200);
    const graphPayload = await graphResponse.json();
    expectLocalApiSuccess(graphResponse, graphPayload);
    expect(graphPayload.localOnly).toBe(true);
    expect(graphPayload.externalCalls).toEqual([]);
    expect(graphPayload.graph).toMatchObject({
      schemaVersion: "truth-harness.workspace-graph.v0",
      localOnly: true,
      networkAccess: "none"
    });
    expect(graphPayload.graph.summary.nodes).toBeGreaterThan(0);
    expect(graphPayload.graph.summary.artifacts).toBeGreaterThan(0);
    expect(graphPayload.graph.nodes).toContainEqual(
      expect.objectContaining({
        kind: "routes",
        artifactId: receiptPayload.route.routeId,
        valid: true
      })
    );
    expect(Array.isArray(graphPayload.graph.edges)).toBe(true);
    expect(typeof graphPayload.graph.validation.passed).toBe("boolean");

    const readinessResponse = await fetch(`${baseUrl}/api/workspace-readiness`);
    expect(readinessResponse.status).toBe(200);
    const readinessPayload = await readinessResponse.json();
    expectLocalApiSuccess(readinessResponse, readinessPayload);
    expect(readinessPayload.localOnly).toBe(true);
    expect(readinessPayload.externalCalls).toEqual([]);
    expect(readinessPayload.readiness).toMatchObject({
      schemaVersion: "truth-harness.workspace-readiness.v0",
      localOnly: true,
      networkAccess: "none",
      status: "open-work"
    });
    expect(readinessPayload.readiness.summary.validation.passed).toBe(true);
    expect(readinessPayload.readiness.summary.graph.missingRefs).toBe(0);
    expect(readinessPayload.readiness.summary.review.totalItems).toBeGreaterThan(0);
    expect(readinessPayload.readiness.gates).toContainEqual(
      expect.objectContaining({
        id: "stress-fixture",
        status: "waiting",
        command: expect.stringContaining("truth-harness workspace stress")
      })
    );

    const maintenanceResponse = await fetch(`${baseUrl}/api/workspace-maintenance`);
    expect(maintenanceResponse.status).toBe(200);
    const maintenancePayload = await maintenanceResponse.json();
    expectLocalApiSuccess(maintenanceResponse, maintenancePayload);
    expect(maintenancePayload).toMatchObject({
      schemaVersion: "truth-harness.web-workspace-maintenance-response.v0",
      localOnly: true,
      externalCalls: []
    });
    expect(maintenancePayload.maintenance).toMatchObject({
      schemaVersion: "truth-harness.workspace-maintenance.v0",
      localOnly: true,
      networkAccess: "none"
    });
    expect(maintenancePayload.maintenance.artifactRepair.dryRun).toBe(true);
    expect(maintenancePayload.maintenance.scratchCleanup.dryRun).toBe(true);
    expect(maintenancePayload.maintenance.commands.archiveScratch).toContain("workspace archive");

    const repairPreviewResponse = await fetch(`${baseUrl}/api/workspace-maintenance/repair-artifacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ preview: true })
    });
    expect(repairPreviewResponse.status).toBe(200);
    const repairPreviewPayload = await repairPreviewResponse.json();
    expectLocalApiSuccess(repairPreviewResponse, repairPreviewPayload);
    expect(repairPreviewPayload.repair).toMatchObject({
      schemaVersion: "truth-harness.workspace-artifact-repair.v0",
      dryRun: true
    });

    const cleanPreviewResponse = await fetch(`${baseUrl}/api/workspace-maintenance/clean`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targets: ["scratch"] })
    });
    expect(cleanPreviewResponse.status).toBe(200);
    const cleanPreviewPayload = await cleanPreviewResponse.json();
    expectLocalApiSuccess(cleanPreviewResponse, cleanPreviewPayload);
    expect(cleanPreviewPayload.clean).toMatchObject({
      schemaVersion: "truth-harness.workspace-clean.v0",
      dryRun: true,
      resolvedDirectories: ["indexes", "validation", "snapshots"]
    });

    const archiveResponse = await fetch(`${baseUrl}/api/workspace-maintenance/archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targets: ["scratch"], reason: "test archive" })
    });
    expect(archiveResponse.status).toBe(200);
    const archivePayload = await archiveResponse.json();
    expectLocalApiSuccess(archiveResponse, archivePayload);
    expect(archivePayload).toMatchObject({
      schemaVersion: "truth-harness.web-workspace-archive-response.v0",
      localOnly: true,
      externalCalls: []
    });
    expect(archivePayload.archive).toMatchObject({
      schemaVersion: "truth-harness.workspace-archive.v0",
      targets: ["scratch"],
      resolvedDirectories: ["indexes", "validation", "snapshots"]
    });
    expect(archivePayload.activity[0].detail).toContain("no files deleted");

    const archiveListResponse = await fetch(`${baseUrl}/api/workspace-maintenance/archives`);
    expect(archiveListResponse.status).toBe(200);
    const archiveListPayload = await archiveListResponse.json();
    expectLocalApiSuccess(archiveListResponse, archiveListPayload);
    expect(archiveListPayload.archives).toMatchObject({
      schemaVersion: "truth-harness.workspace-archive-list.v0",
      total: 1
    });

    const restorePreviewResponse = await fetch(`${baseUrl}/api/workspace-maintenance/restore-archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ archiveRef: archivePayload.archive.archiveId, targets: ["scratch"] })
    });
    expect(restorePreviewResponse.status).toBe(200);
    const restorePreviewPayload = await restorePreviewResponse.json();
    expectLocalApiSuccess(restorePreviewResponse, restorePreviewPayload);
    expect(restorePreviewPayload.restore).toMatchObject({
      schemaVersion: "truth-harness.workspace-archive-restore.v0",
      dryRun: true,
      archiveId: archivePayload.archive.archiveId
    });
    expect(restorePreviewPayload.activity[0].detail).toContain("no files restored");

    const sessionWrite = await writeResearchSession({
      rootPath: tempProjectRoot,
      title: "Fraction verification thread",
      objective: "Track reusable exact fraction proof work from local receipts and route ledgers.",
      domains: ["math"],
      evidenceRefs: [
        {
          kind: "receipt",
          ref: receiptPayload.receiptPaths.ref,
          trust: receiptPayload.receipt.trust
        }
      ],
      tasks: ["Attach a Lean proof fixture", "Run an independent CAS check"],
      now: "2026-06-15T01:00:00.000Z"
    });
    const sessionsResponse = await fetch(`${baseUrl}/api/sessions`);
    expect(sessionsResponse.status).toBe(200);
    const sessionsPayload = await sessionsResponse.json();
    expectLocalApiSuccess(sessionsResponse, sessionsPayload);
    expect(sessionsPayload).toMatchObject({
      schemaVersion: "truth-harness.web-sessions-response.v0",
      localOnly: true,
      externalCalls: []
    });
    expect(sessionsPayload.sessions).toContainEqual(
      expect.objectContaining({
        sessionId: sessionWrite.session.sessionId,
        title: "Fraction verification thread",
        objective: "Track reusable exact fraction proof work from local receipts and route ledgers.",
        domains: ["math"],
        taskCount: 2,
        openTaskCount: 2,
        checkpointCount: 0,
        evidenceRefCount: 1,
        snapshotRefCount: 0,
        warningCount: expect.any(Number),
        privacy: expect.objectContaining({
          mode: "local-only"
        }),
        modelPolicy: expect.objectContaining({
          hostedModels: "optional-with-disclosure"
        })
      })
    );

    const harnessResponse = await fetch(`${baseUrl}/api/research-harness`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        objective: "Prove the common denominator route for 3/4 + 5/8 before using it as a reusable lemma.",
        domains: ["math"],
        claims: ["3 / 4 + 5 / 8"],
        validationClaim: "3 / 4 + 5 / 8 = 11 / 8",
        planNext: true
      })
    });
    expect(harnessResponse.status).toBe(200);
    const harnessPayload = await harnessResponse.json();
    expectLocalApiSuccess(harnessResponse, harnessPayload);
    expect(harnessPayload).toMatchObject({
      schemaVersion: "truth-harness.web-research-harness-response.v0",
      localOnly: true,
      externalCalls: [],
      networkAccess: "none",
      planNext: true,
      harness: {
        session: {
          schemaVersion: "truth-harness.research-session.v0",
          objective: "Prove the common denominator route for 3/4 + 5/8 before using it as a reusable lemma.",
          domains: ["math"]
        },
        validationPlan: {
          plan: {
            schemaVersion: "truth-harness.validation-plan.v0",
            claim: "3 / 4 + 5 / 8 = 11 / 8"
          }
        }
      },
      runNext: {
        plan: {
          schemaVersion: "truth-harness.workspace-run-next.v0",
          localOnly: true,
          networkAccess: "none",
          dryRun: true,
          item: {
            kind: expect.stringContaining("validation")
          },
          execution: {
            kind: "dry-run"
          }
        }
      }
    });
    expect(harnessPayload.runNext.jsonPath).toContain(".truth-harness");
    expect(existsSync(harnessPayload.runNext.jsonPath)).toBe(true);
    expect(harnessPayload.activity).toContainEqual(
      expect.objectContaining({
        actor: "local-api",
        action: "wrote-research-run-next-plan"
      })
    );

    const hardMathSeedResponse = await fetch(`${baseUrl}/api/workspace-seed/hard-math`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        preset: "professor-challenge",
        writeRunNextPlan: true
      })
    });
    expect(hardMathSeedResponse.status).toBe(200);
    const hardMathSeedPayload = await hardMathSeedResponse.json();
    expectLocalApiSuccess(hardMathSeedResponse, hardMathSeedPayload);
    expect(hardMathSeedPayload).toMatchObject({
      schemaVersion: "truth-harness.web-hard-math-seed-response.v0",
      localOnly: true,
      externalCalls: [],
      networkAccess: "none",
      seed: {
        schemaVersion: "truth-harness.hard-math-seed.v0",
        preset: "professor-challenge",
        localOnly: true,
        networkAccess: "none",
        runNext: {
          plan: {
            schemaVersion: "truth-harness.workspace-run-next.v0",
            localOnly: true,
            networkAccess: "none",
            dryRun: true,
            item: {
              kind: "validation-gate"
            }
          }
        }
      }
    });
    expect(hardMathSeedPayload.seed.cases.map((seedCase: { caseId: string }) => seedCase.caseId)).toEqual([
      "exact-fraction-lemma",
      "false-parity-trap",
      "symbolic-cas-closure-fixture",
      "smt-bounded-closure-fixture",
      "lean-trivial-proof-boundary"
    ]);
    expect(hardMathSeedPayload.seed.paths.json).toContain(".truth-harness/findings/");
    expect(existsSync(resolve(tempProjectRoot!, hardMathSeedPayload.seed.paths.json))).toBe(true);
    expect(existsSync(hardMathSeedPayload.seed.runNext.jsonPath)).toBe(true);
    expect(hardMathSeedPayload.activity).toContainEqual(
      expect.objectContaining({
        actor: "local-api",
        action: "seeded-hard-math-workspace"
      })
    );

    const latestHardMathSeedResponse = await fetch(
      `${baseUrl}/api/workspace-seed/hard-math/latest?preset=professor-challenge`
    );
    expect(latestHardMathSeedResponse.status).toBe(200);
    const latestHardMathSeedPayload = await latestHardMathSeedResponse.json();
    expectLocalApiSuccess(latestHardMathSeedResponse, latestHardMathSeedPayload);
    expect(latestHardMathSeedPayload).toMatchObject({
      schemaVersion: "truth-harness.web-hard-math-seed-latest-response.v0",
      localOnly: true,
      externalCalls: [],
      networkAccess: "none",
      preset: "professor-challenge",
      seed: {
        seedId: hardMathSeedPayload.seed.seedId,
        preset: "professor-challenge"
      }
    });

    const mapResponse = await fetch(`${baseUrl}/api/research-map`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        snapshot: {
          visualMode: "mind-map",
          kind: "mind map",
          title: "Exact fraction research map",
          caption: "Local map snapshot generated from the current receipt.",
          receiptRef: {
            runId: receiptPayload.receipt.runId,
            routeId: receiptPayload.route.routeId,
            title: receiptPayload.receipt.title,
            trust: receiptPayload.receipt.trust
          },
          facts: [["Trust", receiptPayload.receipt.trust]],
          dataColumns: ["node", "value", "source"],
          dataRows: [["current-claim", receiptPayload.receipt.title, "receipt.title"]],
          nodes: [
            { id: "current-claim", label: "Current claim", detail: receiptPayload.receipt.title, kind: "claim", tone: "good" },
            { id: "route", label: "Verifier route", detail: receiptPayload.route.routeId, kind: "route", tone: "accent" }
          ],
          edges: [
            { from: "current-claim", to: "route", kind: "has-route" }
          ],
          tags: ["math", "fractions"]
        }
      })
    });
    expect(mapResponse.status).toBe(200);
    const mapPayload = await mapResponse.json();
    expectLocalApiSuccess(mapResponse, mapPayload);
    expect(mapPayload.localOnly).toBe(true);
    expect(mapPayload.externalCalls).toEqual([]);
    expect(mapPayload.snapshot).toMatchObject({
      schemaVersion: "truth-harness.research-map-snapshot.v0",
      visualMode: "mind-map",
      kind: "mind map"
    });
    expect(mapPayload.snapshot.snapshotId).toMatch(/^map_[a-f0-9]{16}$/u);
    expect(mapPayload.snapshot.nodes).toHaveLength(2);
    expect(mapPayload.snapshot.edges).toHaveLength(1);
    expect(mapPayload.map).toMatchObject({
      schemaVersion: "truth-harness.research-map.v0",
      localOnly: true,
      networkAccess: "none",
      snapshotCount: 1
    });
    expect(mapPayload.paths.json).toContain(".truth-harness");
    expect(existsSync(mapPayload.paths.json)).toBe(true);

    const mapEventLogResponse = await fetch(`${baseUrl}/api/events?limit=50`);
    expect(mapEventLogResponse.status).toBe(200);
    const mapEventLogPayload = await mapEventLogResponse.json();
    expectLocalApiSuccess(mapEventLogResponse, mapEventLogPayload);
    expect(mapEventLogPayload.eventLog.events).toContainEqual(
      expect.objectContaining({
        action: "artifact-written",
        kind: "artifacts",
        artifactId: mapPayload.map.mapId,
        path: ".truth-harness/artifacts/research-map.json",
        localOnly: true,
        networkAccess: "none"
      })
    );

    const mapReadResponse = await fetch(`${baseUrl}/api/research-map`);
    expect(mapReadResponse.status).toBe(200);
    const mapReadPayload = await mapReadResponse.json();
    expectLocalApiSuccess(mapReadResponse, mapReadPayload);
    expect(mapReadPayload.localOnly).toBe(true);
    expect(mapReadPayload.externalCalls).toEqual([]);
    expect(mapReadPayload.map.snapshots).toHaveLength(1);
    expect(mapReadPayload.map.snapshots[0].snapshotId).toBe(mapPayload.snapshot.snapshotId);

    const visualResponse = await fetch(`${baseUrl}/api/visuals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Exact fraction concept map",
        kind: "concept-map",
        renderer: {
          engine: "truth-harness-native"
        },
        sourceRefs: [
          {
            kind: "receipt",
            ref: receiptPayload.receiptPaths.ref,
            label: "Exact arithmetic receipt"
          }
        ],
        replayCommand: "truth-harness visual list .",
        payload: {
          format: "svg",
          content: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 320 180\"><text x=\"20\" y=\"40\">3/4 + 5/8 = 11/8</text></svg>",
          width: 320,
          height: 180
        },
        data: {
          columns: ["node", "value"],
          rows: [["verified-output", "11/8"]]
        },
        tags: ["math", "visuals"]
      })
    });
    expect(visualResponse.status).toBe(200);
    const visualPayload = await visualResponse.json();
    expectLocalApiSuccess(visualResponse, visualPayload);
    expect(visualPayload.localOnly).toBe(true);
    expect(visualPayload.externalCalls).toEqual([]);
    expect(visualPayload.visual).toMatchObject({
      schemaVersion: "truth-harness.visual-artifact.v0",
      kind: "concept-map",
      renderer: {
        engine: "truth-harness-native"
      },
      trustBoundary: {
        visualIsEvidence: true,
        visualDoesNotUpgradeTrust: true,
        sourceArtifactsRemainAuthoritative: true
      }
    });
    expect(visualPayload.visual.visualId).toMatch(/^vis_[a-f0-9]{16}$/u);
    expect(visualPayload.visual.sourceRefs).toContainEqual(
      expect.objectContaining({
        kind: "receipt",
        ref: receiptPayload.receiptPaths.ref
      })
    );
    expect(visualPayload.paths.json).toContain(".truth-harness");
    expect(existsSync(visualPayload.paths.json)).toBe(true);
    expect(existsSync(visualPayload.paths.markdown)).toBe(true);
    expect(visualPayload.visuals).toContainEqual(
      expect.objectContaining({
        visualId: visualPayload.visual.visualId,
        kind: "concept-map"
      })
    );

    const graphAdapterResponse = await fetch(`${baseUrl}/api/visuals/graph`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        renderer: "mermaid",
        title: "Workspace graph adapter visual",
        maxNodes: 40
      })
    });
    expect(graphAdapterResponse.status).toBe(200);
    const graphAdapterPayload = await graphAdapterResponse.json();
    expectLocalApiSuccess(graphAdapterResponse, graphAdapterPayload);
    expect(graphAdapterPayload).toMatchObject({
      schemaVersion: "truth-harness.web-visual-graph-response.v0",
      localOnly: true,
      externalCalls: [],
      renderer: "mermaid"
    });
    expect(graphAdapterPayload.visual).toMatchObject({
      kind: "lineage-graph",
      renderer: {
        engine: "mermaid",
        adapter: "workspace-graph-adapter"
      },
      payload: {
        format: "graph-json"
      }
    });
    expect(graphAdapterPayload.visual.payload.rendererSource).toMatchObject({
      language: "mermaid",
      filename: "workspace-lineage.mmd"
    });

    const plotAdapterResponse = await fetch(`${baseUrl}/api/visuals/plot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        receiptPath: receiptPayload.receiptPaths.ref,
        renderer: "plotly",
        title: "Receipt plot adapter visual"
      })
    });
    expect(plotAdapterResponse.status).toBe(200);
    const plotAdapterPayload = await plotAdapterResponse.json();
    expectLocalApiSuccess(plotAdapterResponse, plotAdapterPayload);
    expect(plotAdapterPayload).toMatchObject({
      schemaVersion: "truth-harness.web-visual-plot-response.v0",
      localOnly: true,
      externalCalls: [],
      renderer: "plotly"
    });
    expect(plotAdapterPayload.visual).toMatchObject({
      kind: "plot",
      renderer: {
        engine: "plotly",
        adapter: "receipt-plot-adapter"
      },
      payload: {
        format: "plotly-json"
      }
    });
    expect(plotAdapterPayload.visual.payload.rendererSource).toMatchObject({
      language: "plotly-json",
      filename: "receipt-plot.plotly.json"
    });
    expect(plotAdapterPayload.visual.sourceRefs).toContainEqual(
      expect.objectContaining({
        kind: "receipt",
        ref: receiptPayload.receiptPaths.ref
      })
    );

    const canvasAdapterResponse = await fetch(`${baseUrl}/api/visuals/canvas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Research canvas adapter visual",
        maxNodes: 24
      })
    });
    expect(canvasAdapterResponse.status).toBe(200);
    const canvasAdapterPayload = await canvasAdapterResponse.json();
    expectLocalApiSuccess(canvasAdapterResponse, canvasAdapterPayload);
    expect(canvasAdapterPayload).toMatchObject({
      schemaVersion: "truth-harness.web-visual-canvas-response.v0",
      localOnly: true,
      externalCalls: [],
      renderer: "tldraw"
    });
    expect(canvasAdapterPayload.visual).toMatchObject({
      kind: "mind-map",
      renderer: {
        engine: "tldraw",
        adapter: "research-canvas-adapter"
      },
      payload: {
        format: "canvas-json"
      }
    });
    expect(canvasAdapterPayload.visual.payload.rendererSource).toMatchObject({
      language: "tldraw-json",
      filename: "research-canvas.tldraw.json"
    });

    const visualListResponse = await fetch(`${baseUrl}/api/visuals`);
    expect(visualListResponse.status).toBe(200);
    const visualListPayload = await visualListResponse.json();
    expectLocalApiSuccess(visualListResponse, visualListPayload);
    expect(visualListPayload.visuals).toContainEqual(
      expect.objectContaining({
        visualId: visualPayload.visual.visualId,
        renderer: "truth-harness-native"
      })
    );

    const visualReadResponse = await fetch(`${baseUrl}/api/visuals/${visualPayload.visual.visualId}`);
    expect(visualReadResponse.status).toBe(200);
    const visualReadPayload = await visualReadResponse.json();
    expectLocalApiSuccess(visualReadResponse, visualReadPayload);
    expect(visualReadPayload.visual.visualId).toBe(visualPayload.visual.visualId);

    const visualLinkedResponse = await fetch(`${baseUrl}/api/visuals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Rendered concept map",
        kind: "concept-map",
        renderer: {
          engine: "graphviz"
        },
        sourceRefs: [
          {
            kind: "visual",
            ref: visualPayload.visual.visualId,
            label: "Source visual artifact"
          }
        ],
        replayCommand: `truth-harness visual render ${visualPayload.visual.visualId} --engine graphviz`,
        payload: {
          format: "svg",
          content: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 120 80\"><text x=\"10\" y=\"40\">rendered</text></svg>",
          width: 120,
          height: 80
        },
        tags: ["visual-render"]
      })
    });
    expect(visualLinkedResponse.status).toBe(200);
    const visualLinkedPayload = await visualLinkedResponse.json();
    expectLocalApiSuccess(visualLinkedResponse, visualLinkedPayload);
    expect(visualLinkedPayload.visual.sourceRefs).toContainEqual(
      expect.objectContaining({
        kind: "visual",
        ref: visualPayload.visual.visualId
      })
    );

    const plotlyVisualResponse = await fetch(`${baseUrl}/api/visuals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Plotly source visual",
        kind: "plot",
        renderer: {
          engine: "plotly"
        },
        sourceRefs: [
          {
            kind: "receipt",
            ref: receiptPayload.receiptPaths.ref,
            label: "Exact arithmetic receipt"
          }
        ],
        replayCommand: "truth-harness visual plot .truth-harness/receipts/fraction.json --renderer plotly",
        payload: {
          format: "plotly-json",
          content: {
            data: [
              {
                type: "bar",
                orientation: "h",
                x: [0.75, 0.625, 1.375],
                y: ["3/4", "5/8", "11/8"],
                text: ["3/4", "5/8", "11/8"],
                marker: {
                  color: ["#b8ad92", "#b8ad92", "#70d6a1"]
                }
              }
            ],
            layout: {
              title: "3 / 4 + 5 / 8",
              xaxis: {
                title: "decimal value"
              }
            }
          },
          rendererSource: {
            language: "plotly-json",
            content: JSON.stringify({
              data: [{ type: "bar", x: [0.75, 0.625, 1.375], y: ["3/4", "5/8", "11/8"] }],
              layout: { title: "3 / 4 + 5 / 8" }
            }),
            filename: "fraction.plotly.json"
          }
        },
        tags: ["plotly", "renderer-source"]
      })
    });
    expect(plotlyVisualResponse.status).toBe(200);
    const plotlyVisualPayload = await plotlyVisualResponse.json();
    expectLocalApiSuccess(plotlyVisualResponse, plotlyVisualPayload);
    expect(plotlyVisualPayload.visual.payload.rendererSource).toMatchObject({
      language: "plotly-json",
      filename: "fraction.plotly.json"
    });

    const renderPlotlyResponse = await fetch(`${baseUrl}/api/visuals/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        visualRef: plotlyVisualPayload.visual.visualId,
        engine: "plotly"
      })
    });
    expect(renderPlotlyResponse.status).toBe(200);
    const renderPlotlyPayload = await renderPlotlyResponse.json();
    expectLocalApiSuccess(renderPlotlyResponse, renderPlotlyPayload);
    expect(renderPlotlyPayload.renderer).toBe("plotly");
    expect(renderPlotlyPayload.visual).toMatchObject({
      kind: "plot",
      renderer: {
        engine: "truth-harness-native",
        adapter: "plotly-json-svg-renderer"
      },
      payload: {
        format: "svg"
      }
    });
    expect(renderPlotlyPayload.visual.payload.content).toContain("<svg");
    expect(renderPlotlyPayload.visual.sourceRefs).toContainEqual(
      expect.objectContaining({
        kind: "visual",
        ref: expect.stringContaining(plotlyVisualPayload.visual.visualId)
      })
    );

    const graphvizVisualResponse = await fetch(`${baseUrl}/api/visuals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Graphviz source visual",
        kind: "lineage-graph",
        renderer: {
          engine: "graphviz"
        },
        sourceRefs: [
          {
            kind: "workspace-graph",
            ref: ".",
            label: "Workspace graph"
          }
        ],
        replayCommand: "truth-harness visual graph --renderer graphviz",
        payload: {
          format: "graph-json",
          content: {
            source: "digraph G { a -> b; }",
            nodes: ["a", "b"]
          },
          rendererSource: {
            language: "dot",
            content: "digraph G { a -> b; }",
            filename: "graphviz-source.dot"
          }
        },
        tags: ["graphviz", "renderer-source"]
      })
    });
    expect(graphvizVisualResponse.status).toBe(200);
    const graphvizVisualPayload = await graphvizVisualResponse.json();
    expectLocalApiSuccess(graphvizVisualResponse, graphvizVisualPayload);
    expect(graphvizVisualPayload.visual.payload.rendererSource).toMatchObject({
      language: "dot",
      filename: "graphviz-source.dot"
    });

    const renderVisualResponse = await fetch(`${baseUrl}/api/visuals/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        visualRef: graphvizVisualPayload.visual.visualId,
        timeoutMs: 50
      })
    });
    expect(renderVisualResponse.status).toBe(400);
    const renderVisualPayload = await renderVisualResponse.json();
    expect(renderVisualPayload.requestId).toMatch(/^web_err_[0-9a-f-]{36}$/u);
    expect(renderVisualResponse.headers.get("x-truth-harness-request-id")).toBe(renderVisualPayload.requestId);
    expect(renderVisualPayload).toMatchObject({
      schemaVersion: "truth-harness.web-error.v0",
      localOnly: true,
      externalCalls: [],
      method: "POST",
      path: "/api/visuals/render",
      status: 400
    });
    expect(renderVisualPayload.error).toContain("Graphviz renderer unavailable");

    const routeResponse = await fetch(`${baseUrl}/api/routes/${receiptPayload.route.routeId}`);
    expect(routeResponse.status).toBe(200);
    const routePayload = await routeResponse.json();
    expectLocalApiSuccess(routeResponse, routePayload);
    expect(routePayload.localOnly).toBe(true);
    expect(routePayload.externalCalls).toEqual([]);
    expect(routePayload.route.routeId).toBe(receiptPayload.route.routeId);
    expect(routePayload.route.receipt.runId).toBe(receiptPayload.receipt.runId);
    expect(routePayload.route.proofObligations[0].obligationId).toMatch(/^obl_[a-f0-9]{16}$/u);
    expect(routePayload.routePaths.markdown).toBe(receiptPayload.routePaths.markdown);

    const casResponse = await fetch(`${baseUrl}/api/cas/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        operation: "simplify",
        expression: "3 / 4 + 5 / 8",
        result: "11/8"
      })
    });
    expect(casResponse.status).toBe(200);
    const casPayload = await casResponse.json();
    expectLocalApiSuccess(casResponse, casPayload);
    expect(casPayload.localOnly).toBe(true);
    expect(casPayload.externalCalls).toEqual([]);
    expect(casPayload.record.schemaVersion).toBe("truth-harness.cas-check.v0");
    expect(casPayload.record.checkId).toMatch(/^cas_[a-f0-9]{16}$/u);
    expect(casPayload.record.networkAccess).toBe("none");
    expect(["cross-checked", "unverified"]).toContain(casPayload.record.trust);
    expect(existsSync(casPayload.paths.json)).toBe(true);
    expect(existsSync(casPayload.paths.markdown)).toBe(true);

    const casListResponse = await fetch(`${baseUrl}/api/cas`);
    expect(casListResponse.status).toBe(200);
    const casListPayload = await casListResponse.json();
    expectLocalApiSuccess(casListResponse, casListPayload);
    expect(casListPayload.localOnly).toBe(true);
    expect(casListPayload.externalCalls).toEqual([]);
    expect(casListPayload.checks).toContainEqual(
      expect.objectContaining({
        checkId: casPayload.record.checkId,
        path: expect.stringContaining(".truth-harness")
      })
    );

    const smtResponse = await fetch(`${baseUrl}/api/smt/solve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        queryName: "web-integer-window",
        variables: ["x"],
        constraints: ["x > 0", "x < 3"],
        includeModel: true
      })
    });
    expect(smtResponse.status).toBe(200);
    const smtPayload = await smtResponse.json();
    expectLocalApiSuccess(smtResponse, smtPayload);
    expect(smtPayload.localOnly).toBe(true);
    expect(smtPayload.externalCalls).toEqual([]);
    expect(smtPayload.problem.problemId).toMatch(/^smt_problem_[a-f0-9]{16}$/u);
    expect(smtPayload.sourceRef).toContain(".truth-harness/smt/sources/");
    expect(smtPayload.record.schemaVersion).toBe("truth-harness.smt-check.v0");
    expect(smtPayload.record.checkId).toMatch(/^smt_[a-f0-9]{16}$/u);
    expect(smtPayload.record.networkAccess).toBe("none");
    expect(["smt-checked", "unverified"]).toContain(smtPayload.record.trust);
    expect(existsSync(smtPayload.sourcePath)).toBe(true);
    expect(existsSync(smtPayload.paths.json)).toBe(true);
    expect(existsSync(smtPayload.paths.markdown)).toBe(true);

    const smtListResponse = await fetch(`${baseUrl}/api/smt`);
    expect(smtListResponse.status).toBe(200);
    const smtListPayload = await smtListResponse.json();
    expectLocalApiSuccess(smtListResponse, smtListPayload);
    expect(smtListPayload.localOnly).toBe(true);
    expect(smtListPayload.externalCalls).toEqual([]);
    expect(smtListPayload.checks).toContainEqual(
      expect.objectContaining({
        checkId: smtPayload.record.checkId,
        path: expect.stringContaining(".truth-harness")
      })
    );

    const smtRouteResponse = await fetch(`${baseUrl}/api/receipt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ problem: "solve integer constraints x > 0 and x < 3" })
    });
    expect(smtRouteResponse.status).toBe(200);
    const smtRoutePayload = await smtRouteResponse.json();
    expectLocalApiSuccess(smtRouteResponse, smtRoutePayload);
    const solverObligation = smtRoutePayload.route.proofObligations.find((obligation: { kind: string }) => obligation.kind === "solver-encoding");
    if (!solverObligation) {
      throw new Error("Expected a solver-encoding obligation for the SMT route.");
    }
    expect(solverObligation?.obligationId).toMatch(/^obl_[a-f0-9]{16}$/u);

    const smtSatisfaction = await fetch(`${baseUrl}/api/routes/${smtRoutePayload.route.routeId}/obligations/${solverObligation.obligationId}/satisfy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        evidenceRef: {
          kind: "smt",
          ref: smtListPayload.checks[0].path,
          trust: smtPayload.record.trust
        }
      })
    });
    const smtSatisfactionPayload = await smtSatisfaction.json();
    if (smtPayload.record.trust === "smt-checked") {
      expect(smtSatisfaction.status).toBe(200);
      expectLocalApiSuccess(smtSatisfaction, smtSatisfactionPayload);
      expect(smtSatisfactionPayload.obligation.status).toBe("satisfied");
      expect(smtSatisfactionPayload.obligation.satisfiedBy[0]).toMatchObject({
        kind: "smt",
        trust: "smt-checked"
      });
    } else {
      expect(smtSatisfaction.status).toBe(400);
      expect(smtSatisfactionPayload.error).toContain("solver-encoding obligations require");
    }

    const formalObligation = routePayload.route.proofObligations.find((obligation: { kind: string }) => obligation.kind === "formal-proof");
    if (!formalObligation) {
      throw new Error("Expected a formal-proof obligation for the arithmetic route.");
    }
    const proofRef = join(".truth-harness", "proofs", "web-manual-proof.json");
    await mkdir(join(tempProjectRoot, ".truth-harness", "proofs"), { recursive: true });
    await writeFile(
      join(tempProjectRoot, proofRef),
      `${JSON.stringify(
        {
          schemaVersion: "truth-harness.proof-check.v0",
          checkId: "proof_abcdef0123456789",
          createdAt: "2026-06-12T00:00:00.000Z",
          backend: {
            id: "lean",
            displayName: "Lean proof checker",
            adapter: "local-lean-subprocess",
            role: "proof-checker",
            acceptedProofChecker: true,
            command: "lean",
            args: ["web-proof.lean"],
            exitCode: 0
          },
          source: {
            path: "web-proof.lean",
            sha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
            byteLength: 16
          },
          scope: {
            routeId: routePayload.route.routeId,
            obligationId: formalObligation.obligationId,
            statement: formalObligation.statement,
            statementHash: verifierRouteStatementBoundaryHash(formalObligation.statement)
          },
          status: "accepted",
          trust: "proved",
          proofCheckerBacked: true,
          localOnly: true,
          networkAccess: "none",
          replay: "truth-harness proof check web-proof.lean --write --json",
          limitations: ["Test fixture for web route-satisfaction contract only."],
          warnings: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const proofSatisfaction = await fetch(`${baseUrl}/api/routes/${routePayload.route.routeId}/obligations/${formalObligation.obligationId}/satisfy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        evidenceRef: {
          kind: "proof",
          ref: proofRef
        }
      })
    });
    expect(proofSatisfaction.status).toBe(200);
    const proofSatisfactionPayload = await proofSatisfaction.json();
    expectLocalApiSuccess(proofSatisfaction, proofSatisfactionPayload);
    expect(proofSatisfactionPayload.obligation.status).toBe("satisfied");
    expect(proofSatisfactionPayload.route.proofObligations.find((obligation: { obligationId: string }) =>
      obligation.obligationId === formalObligation.obligationId
    )).toMatchObject({
      status: "satisfied"
    });
    const proofSatisfactionSummary = proofSatisfactionPayload.routes.find((route: { routeId: string }) =>
      route.routeId === routePayload.route.routeId
    );
    expect(proofSatisfactionSummary).toMatchObject({
      proofObligations: proofSatisfactionPayload.route.proofObligations.length,
      openProofObligations: proofSatisfactionPayload.route.proofObligations.filter((obligation: { status: string }) => obligation.status === "open").length,
      satisfiedProofObligations: proofSatisfactionPayload.route.proofObligations.filter((obligation: { status: string }) =>
        obligation.status === "satisfied"
      ).length,
      criticalOpenProofObligations: proofSatisfactionPayload.route.proofObligations.filter((obligation: { status: string; severity: string }) =>
        obligation.status === "open" && obligation.severity === "critical"
      ).length
    });
    const rejectedSatisfaction = await fetch(`${baseUrl}/api/routes/${routePayload.route.routeId}/obligations/${formalObligation.obligationId}/satisfy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        evidenceRef: {
          kind: "cas",
          ref: casListPayload.checks[0].path,
          trust: casPayload.record.trust
        }
      })
    });
    expect(rejectedSatisfaction.status).toBe(400);
    const rejectedPayload = await rejectedSatisfaction.json();
    expect(rejectedPayload.error).toContain("formal-proof obligations require");

    const claimResponse = await fetch(`${baseUrl}/api/claims`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Exact fraction sum",
        statement: "3 / 4 + 5 / 8 = 11/8",
        domain: "math",
        trust: "exact-computed",
        evidenceRefs: [
          {
            kind: "route",
            ref: receiptPayload.route.routeId
          }
        ]
      })
    });
    expect(claimResponse.status).toBe(200);
    const claimPayload = await claimResponse.json();
    expectLocalApiSuccess(claimResponse, claimPayload);
    const routeRef = claimPayload.claim.evidenceRefs.find((ref: { kind: string }) => ref.kind === "route");
    expect(routeRef).toMatchObject({
      kind: "route",
      ref: receiptPayload.route.routeId,
      trust: "proved"
    });
    expect(routeRef.summary).toContain("is ready for a narrow proved claim");
    expect(claimPayload.claim.finalization.readyForNarrowClaim).toBe(true);
  }, 30_000);

  it("serves claim-review packets with hash-backed local artifact refs", async () => {
    tempProjectRoot = await mkdtemp(join(tmpdir(), "truth-harness-web-claim-review-"));
    await initLocalWorkspace(tempProjectRoot, { now: "2026-06-20T00:00:00.000Z" });
    const receiptsDir = join(tempProjectRoot, ".truth-harness", "receipts");
    await mkdir(receiptsDir, { recursive: true });
    await writeFile(
      join(receiptsDir, "fraction-sum.json"),
      `${JSON.stringify(createReceipt("compute 3 / 4 + 5 / 8"), null, 2)}\n`,
      "utf8"
    );
    const claim = await writeClaimLedgerRecord({
      rootPath: tempProjectRoot,
      statement: "3 / 4 + 5 / 8 equals 11 / 8.",
      evidenceRefs: [{ kind: "receipt", ref: ".truth-harness/receipts/fraction-sum.json" }],
      now: "2026-06-20T00:01:00.000Z"
    });

    const port = await getFreePort();
    runningServer = await startWebServer(port, tempProjectRoot);
    const response = await fetch(`http://127.0.0.1:${port}/api/claims/${claim.claim.claimId}/review`);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expectLocalApiSuccess(response, payload);
    expect(payload).toMatchObject({
      schemaVersion: "truth-harness.web-claim-review-response.v0",
      localOnly: true,
      externalCalls: []
    });
    expect(payload.review.claimId).toBe(claim.claim.claimId);
    expect(payload.review.artifactRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "claim-record",
          sha256Scope: "file",
          citation: expect.stringContaining("sha256:")
        }),
        expect.objectContaining({
          role: "claim-evidence",
          path: ".truth-harness/receipts/fraction-sum.json",
          sha256Scope: "file",
          citation: expect.stringContaining(".truth-harness/receipts/fraction-sum.json sha256:")
        })
      ])
    );
  });

  it("previews only text artifacts inside the local .truth-harness workspace", async () => {
    tempProjectRoot = await mkdtemp(join(tmpdir(), "truth-harness-web-artifact-"));
    const port = await getFreePort();
    runningServer = await startWebServer(port, tempProjectRoot);
    const baseUrl = `http://127.0.0.1:${port}`;

    const artifactDirectory = join(tempProjectRoot, ".truth-harness", "release", "reports");
    await mkdir(artifactDirectory, { recursive: true });
    const artifactPath = join(artifactDirectory, "gate-result.json");
    const artifactBody = JSON.stringify({
      schemaVersion: "truth-harness.test-artifact.v0",
      trust: "exact-computed",
      replayCommand: "truth-harness replay .truth-harness/release/reports/gate-result.json"
    }, null, 2);
    await writeFile(artifactPath, artifactBody);
    const artifactSha256 = createHash("sha256").update(artifactBody).digest("hex");

    const response = await fetch(`${baseUrl}/api/workspace-artifact?path=${encodeURIComponent(".truth-harness/release/reports/gate-result.json")}`);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expectLocalApiSuccess(response, payload);
    expect(payload).toMatchObject({
      schemaVersion: "truth-harness.web-workspace-artifact-preview.v0",
      localOnly: true,
      externalCalls: [],
      artifact: {
        path: ".truth-harness/release/reports/gate-result.json",
        kind: "json",
        extension: ".json",
        sizeBytes: Buffer.byteLength(artifactBody),
        previewBytes: Buffer.byteLength(artifactBody),
        truncated: false,
        sha256: artifactSha256,
        sha256Scope: "file",
        parsed: {
          schemaVersion: "truth-harness.test-artifact.v0",
          trust: "exact-computed"
        }
      }
    });
    expect(payload.artifact.content).toContain("truth-harness.test-artifact.v0");
    expect(payload.artifact.previewSha256).toBeUndefined();

    const largeArtifactBody = `${"large artifact line\n".repeat(20_000)}final line\n`;
    const largeArtifactPath = join(artifactDirectory, "large.log");
    await writeFile(largeArtifactPath, largeArtifactBody);
    const largeResponse = await fetch(`${baseUrl}/api/workspace-artifact?path=${encodeURIComponent(".truth-harness/release/reports/large.log")}`);
    expect(largeResponse.status).toBe(200);
    const largePayload = await largeResponse.json();
    expectLocalApiSuccess(largeResponse, largePayload);
    expect(largePayload.artifact).toMatchObject({
      path: ".truth-harness/release/reports/large.log",
      kind: "text",
      extension: ".log",
      sizeBytes: Buffer.byteLength(largeArtifactBody),
      previewBytes: 256 * 1024,
      truncated: true,
      maxPreviewBytes: 256 * 1024,
      sha256: createHash("sha256").update(largeArtifactBody).digest("hex"),
      sha256Scope: "file",
      previewSha256: createHash("sha256").update(Buffer.from(largeArtifactBody).subarray(0, 256 * 1024)).digest("hex")
    });
    expect(largePayload.artifact.content).not.toContain("final line");

    const traversal = await requestText({
      port,
      path: `/api/workspace-artifact?path=${encodeURIComponent(".truth-harness/../package.json")}`,
      headers: {
        Host: `127.0.0.1:${port}`
      }
    });
    expectLocalApiError(traversal, 403, "Workspace artifact path escapes .truth-harness.", {
      method: "GET",
      path: "/api/workspace-artifact"
    });

    const absolutePath = await requestText({
      port,
      path: `/api/workspace-artifact?path=${encodeURIComponent(resolve(tempProjectRoot, ".truth-harness", "release", "reports", "gate-result.json"))}`,
      headers: {
        Host: `127.0.0.1:${port}`
      }
    });
    expectLocalApiError(absolutePath, 403, "Workspace artifact preview is limited to .truth-harness artifacts.", {
      method: "GET",
      path: "/api/workspace-artifact"
    });

    const nonArtifactPath = await requestText({
      port,
      path: `/api/workspace-artifact?path=${encodeURIComponent("package.json")}`,
      headers: {
        Host: `127.0.0.1:${port}`
      }
    });
    expectLocalApiError(nonArtifactPath, 403, "Workspace artifact preview is limited to .truth-harness artifacts.", {
      method: "GET",
      path: "/api/workspace-artifact"
    });

    const missingArtifact = await requestText({
      port,
      path: `/api/workspace-artifact?path=${encodeURIComponent(".truth-harness/release/reports/missing.json")}`,
      headers: {
        Host: `127.0.0.1:${port}`
      }
    });
    expectLocalApiError(missingArtifact, 404, "Workspace artifact preview path is not a file.", {
      method: "GET",
      path: "/api/workspace-artifact"
    });
  }, 30_000);
});

describe("local web safety guard", () => {
  it("sets browser safety headers and rejects non-local or cross-origin API writes", async () => {
    tempProjectRoot = await mkdtemp(join(tmpdir(), "truth-harness-web-safety-"));
    const port = await getFreePort();
    runningServer = await startWebServer(port, tempProjectRoot);
    const baseUrl = `http://127.0.0.1:${port}`;

    const indexResponse = await fetch(`${baseUrl}/`);
    expect(indexResponse.status).toBe(200);
    expect(indexResponse.headers.get("cache-control")).toBe("no-store");
    expect(indexResponse.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(indexResponse.headers.get("permissions-policy")).toContain("camera=()");
    expect(indexResponse.headers.get("x-frame-options")).toBe("DENY");

    const rejectedHost = await requestText({
      port,
      path: "/api/status",
      headers: {
        Host: "example.com"
      }
    });
    expectLocalApiError(rejectedHost, 403, "non-local API host rejected", {
      method: "GET",
      path: "/api/status"
    });

    const rejectedOrigin = await requestText({
      port,
      method: "POST",
      path: "/api/receipt",
      headers: {
        Host: `127.0.0.1:${port}`,
        Origin: "http://evil.example",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ problem: "compute 1 + 1" })
    });
    expectLocalApiError(rejectedOrigin, 403, "cross-origin API write rejected", {
      method: "POST",
      path: "/api/receipt"
    });

    const invalidJson = await requestText({
      port,
      method: "POST",
      path: "/api/receipt",
      headers: {
        Host: `127.0.0.1:${port}`,
        Origin: `http://127.0.0.1:${port}`,
        "Content-Type": "application/json"
      },
      body: "{"
    });
    expectLocalApiError(invalidJson, 400, "invalid JSON body", {
      method: "POST",
      path: "/api/receipt"
    });

    const oversizedJson = await requestText({
      port,
      method: "POST",
      path: "/api/receipt",
      headers: {
        Host: `127.0.0.1:${port}`,
        Origin: `http://127.0.0.1:${port}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ problem: "x".repeat(132_000) })
    });
    expectLocalApiError(oversizedJson, 413, "JSON body too large", {
      method: "POST",
      path: "/api/receipt"
    });

    const missingProblem = await requestText({
      port,
      method: "POST",
      path: "/api/receipt",
      headers: {
        Host: `127.0.0.1:${port}`,
        Origin: `http://127.0.0.1:${port}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    expectLocalApiError(missingProblem, 400, "problem is required", {
      method: "POST",
      path: "/api/receipt"
    });

    const unknownRoute = await requestText({
      port,
      path: "/api/nope",
      headers: {
        Host: `127.0.0.1:${port}`
      }
    });
    expectLocalApiError(unknownRoute, 404, "unknown API route", {
      method: "GET",
      path: "/api/nope"
    });

    const sameOriginWrite = await requestText({
      port,
      method: "POST",
      path: "/api/receipt",
      headers: {
        Host: `127.0.0.1:${port}`,
        Origin: `http://127.0.0.1:${port}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ problem: "compute 1 + 1" })
    });
    expect(sameOriginWrite.statusCode).toBe(200);
    expect(JSON.parse(sameOriginWrite.body)).toMatchObject({
      localOnly: true,
      externalCalls: []
    });
  }, 30_000);
});

async function getFreePort(): Promise<number> {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => rejectPort(new Error("Could not allocate a local test port.")));
        return;
      }
      const { port } = address;
      server.close(() => resolvePort(port));
    });
  });
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
  if (command === "lean-test" && args[0] === "--version") {
    return { status: 0, stdout: "Lean (version 4.12.0)\n", stderr: "" };
  }
  if (command === "lean-test") {
    return { status: 0, stdout: "", stderr: "" };
  }
  if (command === "sage-test") {
    return { status: 0, stdout: "SageMath version 10.6\n", stderr: "" };
  }

  return {
    status: null,
    stdout: "",
    stderr: "",
    error: { name: "Error", message: `unexpected command ${command} ${args.join(" ")}` }
  };
};

function listTarEntryNames(buffer: Buffer): string[] {
  const names: string[] = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }

    const name = tarHeaderText(header, 0, 100);
    const prefix = tarHeaderText(header, 345, 155);
    const sizeText = tarHeaderText(header, 124, 12).replace(/\0/gu, "").trim();
    const size = Number.parseInt(sizeText || "0", 8);
    names.push(prefix ? `${prefix}/${name}` : name);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return names;
}

function tarHeaderText(buffer: Buffer, offset: number, length: number): string {
  return buffer.subarray(offset, offset + length).toString("utf8").replace(/\0.*$/u, "");
}

async function startWebServer(port: number, projectRoot: string): Promise<ChildProcessWithoutNullStreams> {
  const server = spawn(process.execPath, [
    tsxCli,
    webServerScript,
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--project-root",
    projectRoot,
    "--web-root",
    resolve(repoRoot, "apps/web"),
    "--core-module",
    resolve(repoRoot, "packages/core/src/index.ts")
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NO_COLOR: "1"
    }
  });

  let stdout = "";
  let stderr = "";
  server.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  server.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  await waitForServerReady(server, () => stdout.includes(`http://127.0.0.1:${port}`), () => stdout + stderr);
  return server;
}

async function requestText(input: {
  port: number;
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolveRequest, rejectRequest) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port: input.port,
      method: input.method ?? "GET",
      path: input.path,
      headers: input.headers
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        resolveRequest({
          statusCode: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks).toString("utf8")
        });
      });
    });

    request.on("error", rejectRequest);
    if (input.body) {
      request.write(input.body);
    }
    request.end();
  });
}

function expectLocalApiError(
  response: { statusCode: number; headers: Record<string, string | string[] | undefined>; body: string },
  statusCode: number,
  error: string,
  request: { method: string; path: string }
): void {
  expect(response.statusCode).toBe(statusCode);
  expect(response.headers["cache-control"]).toBe("no-store");
  const payload = JSON.parse(response.body);
  expect(payload.requestId).toMatch(/^web_err_[0-9a-f-]{36}$/u);
  expect(response.headers["x-truth-harness-request-id"]).toBe(payload.requestId);
  expect(payload).toMatchObject({
    schemaVersion: "truth-harness.web-error.v0",
    requestId: payload.requestId,
    localOnly: true,
    externalCalls: [],
    method: request.method,
    path: request.path,
    status: statusCode,
    error
  });
  expect(typeof payload.createdAt).toBe("string");
  expect(Number.isNaN(Date.parse(payload.createdAt))).toBe(false);
}

function expectLocalApiSuccess(
  response: { headers: { get: (name: string) => string | null } },
  payload: { requestId?: unknown }
): void {
  expect(payload.requestId).toMatch(/^web_req_[0-9a-f-]{36}$/u);
  expect(response.headers.get("x-truth-harness-request-id")).toBe(payload.requestId);
}

async function waitForServerReady(
  server: ChildProcessWithoutNullStreams,
  isReady: () => boolean,
  output: () => string
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    if (isReady()) {
      return;
    }
    if (server.exitCode !== null) {
      throw new Error(`Web server exited before becoming ready.\n${output()}`);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`Timed out waiting for web server readiness.\n${output()}`);
}
