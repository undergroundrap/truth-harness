import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
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
    tempProjectRoot = await mkdtemp(join(tmpdir(), "theorem-web-api-"));
    const port = await getFreePort();
    runningServer = await startWebServer(port, tempProjectRoot);
    const baseUrl = `http://127.0.0.1:${port}`;

    const receiptResponse = await fetch(`${baseUrl}/api/receipt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ problem: "compute 3 / 4 + 5 / 8" })
    });
    expect(receiptResponse.status).toBe(200);
    const receiptPayload = await receiptResponse.json();
    expect(receiptPayload.localOnly).toBe(true);
    expect(receiptPayload.externalCalls).toEqual([]);
    expect(receiptPayload.route.routeId).toMatch(/^route_[a-f0-9]{16}$/u);
    expect(receiptPayload.route.proofObligations).toContainEqual(
      expect.objectContaining({
        kind: "formal-proof",
        sourceCapabilityId: "accepted-proof-checker"
      })
    );
    expect(receiptPayload.routePaths.json).toContain(".theorem-workbench");
    expect(existsSync(receiptPayload.routePaths.json)).toBe(true);
    expect(existsSync(receiptPayload.routePaths.markdown)).toBe(true);

    const listResponse = await fetch(`${baseUrl}/api/routes`);
    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json();
    expect(listPayload.localOnly).toBe(true);
    expect(listPayload.externalCalls).toEqual([]);
    expect(listPayload.routes).toHaveLength(1);
    expect(listPayload.routes[0]).toMatchObject({
      routeId: receiptPayload.route.routeId,
      finalTrust: "exact-computed",
      status: "verified",
      evidenceKind: "exact-arithmetic",
      proofObligations: receiptPayload.route.proofObligations.length
    });
    expect(listPayload.routes[0].routePaths.json).toBe(receiptPayload.routePaths.json);

    const routeResponse = await fetch(`${baseUrl}/api/routes/${receiptPayload.route.routeId}`);
    expect(routeResponse.status).toBe(200);
    const routePayload = await routeResponse.json();
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
    expect(casPayload.localOnly).toBe(true);
    expect(casPayload.externalCalls).toEqual([]);
    expect(casPayload.record.schemaVersion).toBe("theorem.cas-check.v0");
    expect(casPayload.record.checkId).toMatch(/^cas_[a-f0-9]{16}$/u);
    expect(casPayload.record.networkAccess).toBe("none");
    expect(["cross-checked", "unverified"]).toContain(casPayload.record.trust);
    expect(existsSync(casPayload.paths.json)).toBe(true);
    expect(existsSync(casPayload.paths.markdown)).toBe(true);

    const casListResponse = await fetch(`${baseUrl}/api/cas`);
    expect(casListResponse.status).toBe(200);
    const casListPayload = await casListResponse.json();
    expect(casListPayload.localOnly).toBe(true);
    expect(casListPayload.externalCalls).toEqual([]);
    expect(casListPayload.checks).toContainEqual(
      expect.objectContaining({
        checkId: casPayload.record.checkId,
        path: expect.stringContaining(".theorem-workbench")
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
    expect(smtPayload.localOnly).toBe(true);
    expect(smtPayload.externalCalls).toEqual([]);
    expect(smtPayload.problem.problemId).toMatch(/^smt_problem_[a-f0-9]{16}$/u);
    expect(smtPayload.sourceRef).toContain(".theorem-workbench/smt/sources/");
    expect(smtPayload.record.schemaVersion).toBe("theorem.smt-check.v0");
    expect(smtPayload.record.checkId).toMatch(/^smt_[a-f0-9]{16}$/u);
    expect(smtPayload.record.networkAccess).toBe("none");
    expect(["smt-checked", "unverified"]).toContain(smtPayload.record.trust);
    expect(existsSync(smtPayload.sourcePath)).toBe(true);
    expect(existsSync(smtPayload.paths.json)).toBe(true);
    expect(existsSync(smtPayload.paths.markdown)).toBe(true);

    const smtListResponse = await fetch(`${baseUrl}/api/smt`);
    expect(smtListResponse.status).toBe(200);
    const smtListPayload = await smtListResponse.json();
    expect(smtListPayload.localOnly).toBe(true);
    expect(smtListPayload.externalCalls).toEqual([]);
    expect(smtListPayload.checks).toContainEqual(
      expect.objectContaining({
        checkId: smtPayload.record.checkId,
        path: expect.stringContaining(".theorem-workbench")
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
    const routeRef = claimPayload.claim.evidenceRefs.find((ref: { kind: string }) => ref.kind === "route");
    expect(routeRef).toMatchObject({
      kind: "route",
      ref: receiptPayload.route.routeId,
      trust: "exact-computed"
    });
    expect(routeRef.summary).toContain(receiptPayload.route.routeId);
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
