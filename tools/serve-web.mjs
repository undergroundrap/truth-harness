import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { extname, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_JSON_BODY_BYTES = 16 * 1024;
let coreModulePromise;
const args = new Map(
  process.argv.slice(2).flatMap((arg, index, values) => {
    if (!arg.startsWith("--")) {
      return [];
    }
    const next = values[index + 1];
    return [[arg.slice(2), next && !next.startsWith("--") ? next : "true"]];
  })
);
const root = resolve(args.get("web-root") ?? "apps/web");
const projectRoot = resolve(args.get("project-root") ?? ".");
const coreModulePath = args.get("core-module") ?? process.env.TRUTH_HARNESS_WEB_CORE_MODULE ?? "packages/core/dist/index.js";
const host = args.get("host") ?? "127.0.0.1";
const port = Number(args.get("port") ?? "4180");
const allowNonLocalWeb = isTruthyEnv(process.env.TRUTH_HARNESS_WEB_ALLOW_NONLOCAL);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

const server = createServer(async (request, response) => {
  response.truthHarnessRequestId = `web_req_${randomUUID()}`;
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
    if (requestUrl.pathname.startsWith("/api/")) {
      if (!guardApiRequest(request, response)) {
        return;
      }
      await handleApiRequest(request, response, requestUrl);
      return;
    }

    const filePath = await resolveRequestPath(requestUrl.pathname);
    setWebSecurityHeaders(response);
    response.setHeader("Content-Type", mimeTypes.get(extname(filePath)) ?? "application/octet-stream");
    createReadStream(filePath).pipe(response);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) {
      console.error(error);
    }
    if (request.url?.startsWith("/api/")) {
      writeApiError(response, status, error instanceof HttpError ? error.message : "internal server error", request);
      return;
    }

    setWebSecurityHeaders(response);
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(status === 404 ? "Not found" : "Server error");
  }
});

server.listen(port, host, () => {
  console.log(`Truth Harness web: http://${host}:${port}`);
});

async function resolveRequestPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded.replace(/^\/+/, "")) || "index.html";
  let candidate = resolve(root, relative);
  if (candidate === root || decoded.endsWith("/")) {
    candidate = join(candidate, "index.html");
  }

  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (candidate !== root && !candidate.startsWith(rootWithSep)) {
    throw new HttpError(404);
  }

  const info = await stat(candidate);
  if (info.isDirectory()) {
    return join(candidate, "index.html");
  }
  if (!info.isFile()) {
    throw new HttpError(404);
  }
  return candidate;
}

async function handleApiRequest(request, response, requestUrl) {
  if (requestUrl.pathname === "/api/status" && request.method === "GET") {
    const codeRunSandbox = await readCodeRunSandboxStatus();
    const engineManifest = await readEngineManifest();
    const verification = await readVerificationEngineStatus();
    const mcpCodeRunExposed = isTruthyEnv(process.env.TRUTH_HARNESS_ALLOW_CODE_RUN);
    const unsandboxedCodeRunAllowed = isTruthyEnv(process.env.TRUTH_HARNESS_ALLOW_UNSANDBOXED_CODE_RUN);
    const webServer = webServerSafetyStatus();

    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-status.v0",
      localOnly: true,
      externalCalls: false,
      api: "local-node",
      engine: "@truth-harness/core",
      safety: {
        status: codeRunSandbox.canAttestNetworkNone ? "sandbox-attested" : "sandbox-unavailable",
        codeRunSandbox,
        mcpCodeRun: {
          exposed: mcpCodeRunExposed,
          unsandboxedAllowed: unsandboxedCodeRunAllowed,
          requiredForExecution: mcpCodeRunExposed ? "policy.allowedExecutables" : "TRUTH_HARNESS_ALLOW_CODE_RUN=1",
          recommendation: codeRunSandbox.canAttestNetworkNone
            ? "Prefer policy.requireSandbox=true for agent-triggered code runs."
            : "Keep MCP code execution disabled or require a measured sandbox before running untrusted commands."
        },
        webServer,
        privacy: {
          localApiOnly: true,
          hostedModelCalls: false,
          selectedContextRequiredForExternalModels: true
        }
      },
      engineManifest,
      verification,
      dockerVerifier: dockerVerifierGuidance(verification),
      capabilities: [
        "receipt-create",
        "claim-ledger",
        "trace-render",
        "activity-log",
        "agent-runbook",
        "research-session",
        "validation-plan",
        "engine-manifest",
        "verification-readiness",
        "workspace-review-queue",
        "docker-verifier-guidance",
        "sandbox-status",
        "safety-center"
      ]
    });
    return;
  }

  if (requestUrl.pathname === "/api/claims" && request.method === "GET") {
    const snapshot = await readClaimLedgerSnapshot();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-claims-response.v0",
      localOnly: true,
      externalCalls: [],
      ...snapshot
    });
    return;
  }

  if (requestUrl.pathname === "/api/routes" && request.method === "GET") {
    const routes = await readRouteLedgerSnapshot();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-routes-response.v0",
      localOnly: true,
      externalCalls: [],
      routes
    });
    return;
  }

  if (requestUrl.pathname === "/api/workspace-review" && request.method === "GET") {
    const { createWorkspaceReview } = await loadCoreModule();
    await ensureLocalWorkspace();
    const review = await createWorkspaceReview({ rootPath: projectRoot });
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-workspace-review-response.v0",
      localOnly: true,
      externalCalls: [],
      review
    });
    return;
  }

  if (requestUrl.pathname === "/api/cas" && request.method === "GET") {
    const checks = await readCasCheckSnapshot();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-cas-list-response.v0",
      localOnly: true,
      externalCalls: [],
      checks
    });
    return;
  }

  if (requestUrl.pathname === "/api/smt" && request.method === "GET") {
    const checks = await readSmtCheckSnapshot();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-smt-list-response.v0",
      localOnly: true,
      externalCalls: [],
      checks
    });
    return;
  }

  if (requestUrl.pathname === "/api/smt/solve" && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { solveSmtProblem } = await loadCoreModule();
      const variables = stringList(input.variables);
      const constraints = stringList(input.constraints);
      const timeoutMs = Number.isFinite(input.timeoutMs) ? Number(input.timeoutMs) : undefined;

      await ensureLocalWorkspace();
      const result = await solveSmtProblem({
        rootPath: projectRoot,
        queryName: optionalText(input.queryName),
        variables,
        constraints,
        includeModel: input.includeModel === true,
        z3Command: optionalText(input.z3Command),
        timeoutMs
      });
      const checks = await readSmtCheckSnapshot();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-smt-solve-response.v0",
        localOnly: true,
        externalCalls: [],
        problem: result.problem,
        sourcePath: result.sourcePath,
        sourceRef: result.sourceRef,
        record: result.check.record,
        paths: {
          json: result.check.jsonPath,
          markdown: result.check.markdownPath
        },
        checks,
        activity: [
          {
            actor: "local-api",
            action: "created-smt-check",
            detail: `${result.check.record.checkId} wrote ${result.check.record.status} Z3 SMT record with trust ${result.check.record.trust}.`,
            at: result.check.record.createdAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "SMT solve failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/cas/check" && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { writeSymbolicCasCheckRecord } = await loadCoreModule();
      const operation = parseCasOperation(input.operation);
      const expression = requiredText(input.expression, "expression");
      const result = requiredText(input.result, "result");
      const variable = optionalText(input.variable) ?? "x";
      const timeoutMs = Number.isFinite(input.timeoutMs) ? Number(input.timeoutMs) : undefined;

      await ensureLocalWorkspace();
      const write = await writeSymbolicCasCheckRecord({
        rootPath: projectRoot,
        prompt: {
          operation,
          expression,
          variable
        },
        result,
        maximaCommand: optionalText(input.maximaCommand),
        timeoutMs
      });
      const checks = await readCasCheckSnapshot();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-cas-check-response.v0",
        localOnly: true,
        externalCalls: [],
        record: write.record,
        paths: {
          json: write.jsonPath,
          markdown: write.markdownPath
        },
        checks,
        activity: [
          {
            actor: "local-api",
            action: "created-cas-check",
            detail: `${write.record.checkId} wrote ${write.record.status} Maxima CAS record with trust ${write.record.trust}.`,
            at: write.record.createdAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "CAS check failed.", request);
    }
    return;
  }

  const routeReadMatch = requestUrl.pathname.match(/^\/api\/routes\/([^/]+)$/u);
  if (routeReadMatch && request.method === "GET") {
    try {
      const { listVerifierRoutes, readVerifierRoute } = await loadCoreModule();
      await ensureLocalWorkspace();
      const routeRef = decodeURIComponent(routeReadMatch[1]);
      const route = await readVerifierRoute(projectRoot, routeRef);
      const summary = (await listVerifierRoutes(projectRoot)).find((item) => item.routeId === route.routeId);
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-route-response.v0",
        localOnly: true,
        externalCalls: [],
        route,
        routePaths: routePathsFor(summary?.path ?? routeRef)
      });
    } catch (error) {
      writeApiError(response, 404, error instanceof Error ? error.message : "Verifier route not found.", request);
    }
    return;
  }

  const routeSatisfyMatch = requestUrl.pathname.match(/^\/api\/routes\/([^/]+)\/obligations\/([^/]+)\/satisfy$/u);
  if (routeSatisfyMatch && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { satisfyVerifierRouteObligation } = await loadCoreModule();
      const routeRef = decodeURIComponent(routeSatisfyMatch[1]);
      const obligationId = decodeURIComponent(routeSatisfyMatch[2]);
      const routeEvidenceRef = parseRouteEvidenceRef(input.evidenceRef);
      await ensureLocalWorkspace();
      const result = await satisfyVerifierRouteObligation({
        rootPath: projectRoot,
        routeRef,
        obligationId,
        evidenceRef: routeEvidenceRef
      });
      const routes = await readRouteLedgerSnapshot();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-route-satisfy-response.v0",
        localOnly: true,
        externalCalls: [],
        route: result.route,
        obligation: result.obligation,
        evidence: result.evidence,
        message: result.message,
        routePaths: {
          json: result.jsonPath,
          markdown: result.markdownPath
        },
        routes,
        activity: [
          {
            actor: "local-api",
            action: "satisfied-route-obligation",
            detail: result.message,
            at: result.obligation.satisfiedAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Route obligation satisfaction failed.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/claims" && request.method === "POST") {
    const input = await readJsonBody(request);
    try {
      const { writeClaimLedgerRecord } = await loadCoreModule();
      const result = await writeClaimLedgerRecord({
        rootPath: projectRoot,
        title: optionalText(input.title),
        statement: String(input.statement ?? "").trim(),
        domain: optionalText(input.domain),
        status: optionalText(input.status),
        trust: optionalText(input.trust),
        tags: stringList(input.tags),
        dependsOn: stringList(input.dependsOn),
        supersedes: stringList(input.supersedes),
        derivedBy: optionalText(input.derivedBy),
        authors: stringList(input.authors),
        evidenceRefs: evidenceRefList(input.evidenceRefs),
        nextChecks: stringList(input.nextChecks)
      });
      const snapshot = await readClaimLedgerSnapshot();
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-claim-write-response.v0",
        localOnly: true,
        externalCalls: [],
        claim: result.claim,
        paths: {
          json: result.jsonPath,
          markdown: result.markdownPath
        },
        ...snapshot,
        activity: [
          {
            actor: "local-api",
            action: "created-claim-ledger-record",
            detail: `${result.claim.claimId} written to the local .truth-harness claim ledger.`,
            at: result.claim.createdAt
          }
        ]
      });
    } catch (error) {
      writeApiError(response, 400, error instanceof Error ? error.message : "Claim ledger write failed.", request);
    }
    return;
  }

  const claimReadMatch = requestUrl.pathname.match(/^\/api\/claims\/([^/]+)$/u);
  if (claimReadMatch && request.method === "GET") {
    try {
      const { readClaimRecord } = await loadCoreModule();
      await ensureLocalWorkspace();
      const claim = await readClaimRecord(projectRoot, decodeURIComponent(claimReadMatch[1]));
      writeJson(response, 200, {
        schemaVersion: "truth-harness.web-claim-response.v0",
        localOnly: true,
        externalCalls: [],
        claim
      });
    } catch (error) {
      writeApiError(response, 404, error instanceof Error ? error.message : "Claim not found.", request);
    }
    return;
  }

  if (requestUrl.pathname === "/api/receipt" && request.method === "POST") {
    const receivedAt = new Date().toISOString();
    const input = await readJsonBody(request);
    const problem = typeof input.problem === "string" ? input.problem.trim() : "";
    if (!problem) {
      writeApiError(response, 400, "problem is required", request);
      return;
    }

    const { writeVerifierRoute } = await loadCoreModule();
    await ensureLocalWorkspace();
    const routeWrite = await writeVerifierRoute({
      rootPath: projectRoot,
      problem
    });
    const route = routeWrite.route;
    const receipt = route.receipt;
    const completedAt = new Date().toISOString();
    writeJson(response, 200, {
      schemaVersion: "truth-harness.web-receipt-response.v0",
      localOnly: true,
      externalCalls: [],
      route,
      routePaths: {
        json: routeWrite.jsonPath,
        markdown: routeWrite.markdownPath
      },
      receipt,
      activity: [
        {
          actor: "web-ui",
          action: "submitted-local-problem",
          detail: "Browser submitted selected prompt text to the local Truth Harness API.",
          at: receivedAt
        },
        {
          actor: "local-api",
          action: "created-verifier-route",
          detail: `The local API selected ${route.usedCapabilities.length} verifier capabilities, recorded ${route.gaps.length} route gaps, and wrote ${route.routeId} to .truth-harness/routes.`,
          at: completedAt
        },
        {
          actor: "local-api",
          action: "created-receipt",
          detail: "The local API called @truth-harness/core createReceipt without a hosted model or external service.",
          at: completedAt
        }
      ]
    });
    return;
  }

  writeApiError(response, 404, "unknown API route", request);
}

async function readClaimLedgerSnapshot() {
  const { createClaimLedgerGraph, listClaimRecords } = await loadCoreModule();
  await ensureLocalWorkspace();
  const claims = await listClaimRecords(projectRoot);
  return {
    claims,
    graph: createClaimLedgerGraph(claims)
  };
}

async function readRouteLedgerSnapshot() {
  const { listVerifierRoutes } = await loadCoreModule();
  await ensureLocalWorkspace();
  const routes = await listVerifierRoutes(projectRoot);
  return routes.map((route) => ({
    ...route,
    routePaths: routePathsFor(route.path)
  }));
}

async function readCasCheckSnapshot() {
  const { listSymbolicCasChecks } = await loadCoreModule();
  await ensureLocalWorkspace();
  const checks = await listSymbolicCasChecks(projectRoot);
  return checks.map((check) => ({
    ...check,
    paths: artifactPathsFor(check.path)
  }));
}

async function readSmtCheckSnapshot() {
  const { listSmtChecks } = await loadCoreModule();
  await ensureLocalWorkspace();
  const checks = await listSmtChecks(projectRoot);
  return checks.map((check) => ({
    ...check,
    paths: artifactPathsFor(check.path)
  }));
}

function routePathsFor(routePathOrId) {
  if (typeof routePathOrId === "string" && routePathOrId.endsWith(".json")) {
    return artifactPathsFor(routePathOrId);
  }

  return {
    json: undefined,
    markdown: undefined
  };
}

function artifactPathsFor(relativeOrAbsoluteJsonPath) {
  const json = resolve(projectRoot, relativeOrAbsoluteJsonPath);
  return {
    json,
    markdown: json.replace(/\.json$/u, ".md")
  };
}

async function ensureLocalWorkspace() {
  const { initLocalWorkspace } = await loadCoreModule();
  await initLocalWorkspace(projectRoot, {
    displayName: "Truth Harness Local Web Session"
  });
}

function requiredText(value, fieldName) {
  const text = optionalText(value);
  if (!text) {
    throw new Error(`${fieldName} is required`);
  }

  return text;
}

function optionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseCasOperation(value) {
  const operation = optionalText(value) ?? "simplify";
  if (["simplify", "factor", "expand", "differentiate", "integrate"].includes(operation)) {
    return operation;
  }

  throw new Error(`Unsupported CAS operation: ${operation}`);
}

function stringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function evidenceRefList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      kind: optionalText(item.kind) ?? "other",
      ref: optionalText(item.ref) ?? "",
      trust: optionalText(item.trust),
      summary: optionalText(item.summary)
    }))
    .filter((item) => item.ref);
}

function parseRouteEvidenceRef(value) {
  if (!value || typeof value !== "object") {
    throw new Error("evidenceRef is required");
  }

  const kind = requiredText(value.kind, "evidenceRef.kind");
  if (!["cas", "proof", "smt", "receipt", "route"].includes(kind)) {
    throw new Error(`Unsupported route evidence kind: ${kind}`);
  }

  return {
    kind,
    ref: requiredText(value.ref, "evidenceRef.ref"),
    trust: optionalText(value.trust),
    summary: optionalText(value.summary)
  };
}

function guardApiRequest(request, response) {
  if (!isAllowedLocalHostHeader(request.headers.host)) {
    writeApiError(response, 403, "non-local API host rejected", request);
    return false;
  }

  if (!isReadMethod(request.method) && !isAllowedSameOriginWrite(request)) {
    writeApiError(response, 403, "cross-origin API write rejected", request);
    return false;
  }

  return true;
}

function isReadMethod(method) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function isAllowedLocalHostHeader(hostHeader) {
  if (allowNonLocalWeb) {
    return true;
  }

  const hostname = parseHostHeader(hostHeader);
  return isLocalHostname(hostname);
}

function isAllowedSameOriginWrite(request) {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return ["http:", "https:"].includes(originUrl.protocol)
      && originUrl.host === request.headers.host
      && isAllowedLocalHostHeader(originUrl.host);
  } catch {
    return false;
  }
}

function parseHostHeader(hostHeader) {
  if (!hostHeader) {
    return "";
  }

  if (hostHeader.startsWith("[")) {
    const end = hostHeader.indexOf("]");
    return end === -1 ? hostHeader : hostHeader.slice(1, end);
  }

  return hostHeader.split(":")[0] ?? "";
}

function isLocalHostname(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
}

function webServerSafetyStatus() {
  return {
    schemaVersion: "truth-harness.web-server-safety.v0",
    bindHost: host,
    port,
    localHostGuard: !allowNonLocalWeb,
    sameOriginWritesOnly: true,
    securityHeaders: true,
    maxJsonBodyBytes: MAX_JSON_BODY_BYTES,
    apiErrorFormat: "json",
    recommendation: allowNonLocalWeb
      ? "Non-local web access was explicitly enabled; do not expose this server to untrusted networks."
      : "The local API rejects non-local Host headers and cross-origin browser writes."
  };
}

function dockerVerifierGuidance(verification) {
  const engines = Array.isArray(verification?.engines) ? verification.engines : [];
  const totalCount = Number.isFinite(verification?.totalCount) ? verification.totalCount : engines.length;
  const readyCount = Number.isFinite(verification?.readyCount)
    ? verification.readyCount
    : engines.filter((engine) => engine.status === "available").length;
  const missingEngines = engines
    .filter((engine) => engine.status !== "available")
    .map((engine) => engine.displayName ?? engine.id ?? "Backend");
  const recommended = totalCount === 0 || readyCount < totalCount;

  return {
    schemaVersion: "truth-harness.docker-verifier-guidance.v0",
    localOnly: true,
    externalCalls: false,
    recommended,
    status: recommended ? "recommended" : "optional",
    commands: {
      proof: "npm run docker:proof",
      verify: "npm run docker:verify"
    },
    missingEngines,
    runtimeBoundary: {
      service: "truth-harness",
      composeNetworkMode: "none",
      autoRunsDocker: false,
      buildMayDownloadDependencies: true,
      repositoryBindMount: true
    },
    notes: [
      "The web UI never runs Docker automatically; it only exposes copyable commands.",
      "npm run docker:proof runs the truth-harness compose service with no external network route after the dev image exists.",
      "npm run docker:verify builds and tests the verification image; image builds may download dependencies.",
      "Docker status does not prove a claim. Trust labels still require concrete Lean, Z3, Maxima, or other accepted evidence artifacts."
    ]
  };
}

async function readCodeRunSandboxStatus() {
  try {
    const { getCodeRunSandboxStatus } = await loadCoreModule();
    return getCodeRunSandboxStatus();
  } catch (error) {
    return {
      schemaVersion: "truth-harness.code-run-sandbox-status.v0",
      platform: process.platform,
      available: false,
      provider: "none",
      processSandbox: "none",
      networkIsolation: "not-enforced",
      filesystemIsolation: "working-directory-only",
      canAttestNetworkNone: false,
      reason: `Sandbox status unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
      notes: [
        "The local web status endpoint could not load the core sandbox detector.",
        "Treat agent-triggered code execution as unavailable until the local API reports a measured sandbox.",
        "Receipt creation can still run, but code-run networkAccess none must not be claimed from this process."
      ]
    };
  }
}

async function readEngineManifest() {
  try {
    const { getEngineManifest } = await loadCoreModule();
    return getEngineManifest({ timeoutMs: 1500 });
  } catch (error) {
    return {
      schemaVersion: "truth-harness.engine-manifest.v0",
      createdAt: new Date().toISOString(),
      localOnly: true,
      networkAccess: "none",
      status: "missing",
      readyCount: 0,
      totalCount: 0,
      nativeCount: 0,
      adapterCount: 0,
      plannedCount: 0,
      capabilities: [],
      trustBoundary: {
        aiOutputIsNotEvidence: true,
        statusProbeIsNotEvidence: true,
        claimTrustRequiresResolvableEvidence: true,
        provedRequiresAcceptedProofCheckerRun: true,
        smtCheckedRequiresConcreteSolverRun: true,
        crossCheckedRequiresIndependentAgreementRun: true
      },
      warnings: [
        `Engine manifest unavailable: ${error instanceof Error ? error.message : "unknown error"}`
      ]
    };
  }
}

async function readVerificationEngineStatus() {
  try {
    const {
      getCasBackendStatus,
      getProofBackendStatus,
      getSmtBackendStatus
    } = await loadCoreModule();
    const timeoutMs = 1500;
    const cas = getCasBackendStatus({ timeoutMs });
    const proof = getProofBackendStatus({ timeoutMs });
    const smt = getSmtBackendStatus({ timeoutMs });
    const engines = [
      engineProbeRow({
        lane: "Symbolic CAS",
        command: "truth-harness cas backends",
        trustBoundary: "Can support `cross-checked` only after a concrete independent Maxima agreement run.",
        probe: cas.backends[0]
      }),
      engineProbeRow({
        lane: "Formal proof",
        command: "truth-harness proof backends",
        trustBoundary: "Can support `proved` only after Lean accepts a concrete proof artifact.",
        probe: proof.backends[0]
      }),
      engineProbeRow({
        lane: "SMT solver",
        command: "truth-harness smt backends",
        trustBoundary: "Can support `smt-checked` only after Z3 returns sat or unsat for a concrete SMT-LIB artifact.",
        probe: smt.backends[0]
      })
    ];
    const readyCount = engines.filter((engine) => engine.status === "available").length;

    return {
      schemaVersion: "truth-harness.verification-readiness.v0",
      createdAt: new Date().toISOString(),
      localOnly: true,
      networkAccess: "none",
      status: readyCount === engines.length ? "ready" : readyCount > 0 ? "partial" : "missing",
      readyCount,
      totalCount: engines.length,
      engines,
      trustBoundary: {
        statusProbeIsNotEvidence: true,
        crossCheckedRequiresIndependentAgreementRun: true,
        smtCheckedRequiresConcreteSolverRun: true,
        provedRequiresAcceptedProofCheckerRun: true
      },
      warnings: [
        ...cas.warnings,
        ...proof.warnings,
        ...smt.warnings
      ],
      reports: {
        cas,
        proof,
        smt
      }
    };
  } catch (error) {
    return {
      schemaVersion: "truth-harness.verification-readiness.v0",
      createdAt: new Date().toISOString(),
      localOnly: true,
      networkAccess: "none",
      status: "error",
      readyCount: 0,
      totalCount: 3,
      engines: [],
      trustBoundary: {
        statusProbeIsNotEvidence: true,
        crossCheckedRequiresIndependentAgreementRun: true,
        smtCheckedRequiresConcreteSolverRun: true,
        provedRequiresAcceptedProofCheckerRun: true
      },
      warnings: [
        `Verification readiness unavailable: ${error instanceof Error ? error.message : "unknown error"}`
      ]
    };
  }
}

function engineProbeRow(input) {
  const probe = input.probe ?? {};

  return {
    id: probe.backendId ?? "unknown",
    displayName: probe.displayName ?? "Unknown backend",
    lane: input.lane,
    adapter: probe.adapter ?? "unknown",
    role: probe.role ?? "checker",
    status: probe.status ?? "missing",
    command: input.command,
    executable: probe.command ?? "not configured",
    version: probe.version,
    localOnly: probe.localOnly === true,
    networkAccess: probe.networkAccess ?? "unknown",
    acceptedProofChecker: probe.acceptedProofChecker === true,
    statusProbeMintedEvidence: false,
    canRun: Boolean(probe.canCheckSymbolic ?? probe.canCheckProofs ?? probe.canCheckSmt),
    trustBoundary: input.trustBoundary,
    note: Array.isArray(probe.limitations) && probe.limitations.length > 0
      ? probe.limitations[0]
      : "Backend status probe did not return a limitation note."
  };
}

function loadCoreModule() {
  coreModulePromise ??= import(pathToFileURL(resolve(coreModulePath)).href);
  return coreModulePromise;
}

function isTruthyEnv(value) {
  return /^(1|true|yes|on)$/iu.test(value ?? "");
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let byteLength = 0;
    let bodyTooLarge = false;

    request.on("data", (chunk) => {
      byteLength += chunk.length;
      if (byteLength > MAX_JSON_BODY_BYTES) {
        bodyTooLarge = true;
        return;
      }

      if (!bodyTooLarge) {
        chunks.push(chunk);
      }
    });

    request.on("end", () => {
      if (bodyTooLarge) {
        rejectBody(new HttpError(413, "JSON body too large"));
        return;
      }

      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        rejectBody(new HttpError(400, "invalid JSON body"));
      }
    });

    request.on("error", rejectBody);
  });
}

function writeJson(response, status, payload) {
  const requestId = payload?.requestId ?? response.truthHarnessRequestId ?? `web_req_${randomUUID()}`;
  const responsePayload = payload && typeof payload === "object" && !Array.isArray(payload)
    ? {
      requestId,
      ...payload
    }
    : payload;
  const headers = {
    ...webSecurityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Truth-Harness-Request-Id": requestId
  };

  response.writeHead(status, headers);
  response.end(`${JSON.stringify(responsePayload, null, 2)}\n`);
}

function writeApiError(response, status, error, request) {
  const requestId = `web_err_${randomUUID()}`;
  writeJson(response, status, {
    schemaVersion: "truth-harness.web-error.v0",
    requestId,
    createdAt: new Date().toISOString(),
    localOnly: true,
    externalCalls: [],
    method: request?.method ?? "UNKNOWN",
    path: apiRequestPath(request),
    status,
    error
  });
}

function apiRequestPath(request) {
  if (!request?.url) {
    return "unknown";
  }

  try {
    return new URL(request.url, `http://${host}:${port}`).pathname;
  } catch {
    return request.url.split("?")[0] || "unknown";
  }
}

function setWebSecurityHeaders(response) {
  for (const [key, value] of Object.entries(webSecurityHeaders())) {
    response.setHeader(key, value);
  }
}

function webSecurityHeaders() {
  return {
    "Content-Security-Policy": "default-src 'self'; base-uri 'none'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self'; style-src 'self'",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  };
}

class HttpError extends Error {
  constructor(status, message = `HTTP ${status}`) {
    super(message);
    this.status = status;
  }
}
