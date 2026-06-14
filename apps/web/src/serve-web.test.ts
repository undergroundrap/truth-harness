import { createServer, request as httpRequest } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = resolve(".");
const tsxCli = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");
const webServerScript = resolve(repoRoot, "tools/serve-web.mjs");

let runningServer: ChildProcessWithoutNullStreams | undefined;
let tempProjectRoot: string | undefined;

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
});

describe("local web route ledger API", () => {
  it("persists verifier routes and reads them through local-only API endpoints", async () => {
    tempProjectRoot = await mkdtemp(join(tmpdir(), "truth-harness-web-api-"));
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
    expect(statusPayload.capabilities).toContain("research-map");
    expect(statusPayload.safety.webServer).toMatchObject({
      localHostGuard: true,
      sameOriginWritesOnly: true,
      securityHeaders: true,
      maxJsonBodyBytes: 16 * 1024,
      apiErrorFormat: "json"
    });
    expect(statusPayload.dockerVerifier).toMatchObject({
      schemaVersion: "truth-harness.docker-verifier-guidance.v0",
      localOnly: true,
      externalCalls: false,
      commands: {
        proof: "npm run docker:proof",
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
        command: expect.stringContaining("truth-harness claim add"),
        acceptanceCriteria: expect.arrayContaining([
          "Record a narrow claim that cites this route as evidence."
        ]),
        evidenceSlots: expect.arrayContaining([
          expect.objectContaining({
            slotId: "claim-ledger-record",
            suggestedCommand: expect.stringContaining("truth-harness claim add")
          })
        ]),
        agentPacket: expect.stringContaining("# Truth Harness Workspace Action")
      })
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

    const mapReadResponse = await fetch(`${baseUrl}/api/research-map`);
    expect(mapReadResponse.status).toBe(200);
    const mapReadPayload = await mapReadResponse.json();
    expectLocalApiSuccess(mapReadResponse, mapReadPayload);
    expect(mapReadPayload.localOnly).toBe(true);
    expect(mapReadPayload.externalCalls).toEqual([]);
    expect(mapReadPayload.map.snapshots).toHaveLength(1);
    expect(mapReadPayload.map.snapshots[0].snapshotId).toBe(mapPayload.snapshot.snapshotId);

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
});

describe("local web safety guard", () => {
  it("sets browser safety headers and rejects non-local or cross-origin API writes", async () => {
    tempProjectRoot = await mkdtemp(join(tmpdir(), "truth-harness-web-safety-"));
    const port = await getFreePort();
    runningServer = await startWebServer(port, tempProjectRoot);
    const baseUrl = `http://127.0.0.1:${port}`;

    const indexResponse = await fetch(`${baseUrl}/`);
    expect(indexResponse.status).toBe(200);
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
      body: JSON.stringify({ problem: "x".repeat(17_000) })
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
